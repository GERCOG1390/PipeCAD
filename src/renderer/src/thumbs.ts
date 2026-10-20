// Миниатюры деталей для каталога: рисуем деталь нашим же движком в маленький холст (по одной, в фоне).
// Готовые картинки — в памяти на время работы программы.
import { useEffect, useState } from 'react'
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  Scene as ThreeScene,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Part, SizeId, defaultSize2 } from './catalog'
import { thumbGroups } from './Scene'

const PX = 112
const cache = new Map<string, string>()
const waiting = new Map<string, ((url: string) => void)[]>()
const queue: { key: string; part: Part }[] = []
let busy = false
let ctx: { r: WebGLRenderer; scene: ThreeScene; cam: PerspectiveCamera } | null = null

function setup(): NonNullable<typeof ctx> {
  if (ctx) return ctx
  const r = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  r.setPixelRatio(2)
  r.setSize(PX, PX, false)
  r.outputColorSpace = SRGBColorSpace
  r.toneMapping = ACESFilmicToneMapping
  r.toneMappingExposure = 0.9
  const scene = new ThreeScene()
  scene.environment = new PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.55
  scene.add(new AmbientLight('#ffffff', 0.1))
  const key = new DirectionalLight('#ffffff', 1.5)
  key.position.set(3, 5, 4)
  scene.add(key)
  const fill = new DirectionalLight('#cfe3ff', 0.4)
  fill.position.set(-4, 1, -2)
  scene.add(fill)
  ctx = { r, scene, cam: new PerspectiveCamera(30, 1, 0.01, 1000) }
  return ctx
}

function draw(part: Part): string {
  const { r, scene, cam } = setup()
  const groups = thumbGroups(part)
  const meshes = groups.map(
    (g) =>
      new Mesh(
        g.geom,
        new MeshStandardMaterial({ color: g.color, roughness: g.metal ? 0.32 : 0.48, metalness: g.metal ? 0.9 : 0, flatShading: g.flat })
      )
  )
  meshes.forEach((m) => scene.add(m))
  const box = new Box3()
  meshes.forEach((m) => box.expandByObject(m))
  const c = box.getCenter(new Vector3())
  const rad = Math.max(0.5, box.getSize(new Vector3()).length() / 2)
  // изометрия, как на чертежах каталога
  const dir = new Vector3(0.75, 1.25, 1).normalize()
  cam.position.copy(c).addScaledVector(dir, rad / Math.sin((cam.fov * Math.PI) / 360) * 1.02)
  cam.lookAt(c)
  cam.near = rad * 0.05
  cam.far = rad * 10
  cam.updateProjectionMatrix()
  r.setClearColor(0x000000, 0)
  r.render(scene, cam)
  const url = r.domElement.toDataURL('image/png')
  meshes.forEach((m) => {
    scene.remove(m)
    m.geometry.dispose()
    ;(m.material as MeshStandardMaterial).dispose()
  })
  return url
}

function pump(): void {
  if (busy) return
  const job = queue.shift()
  if (!job) return
  busy = true
  // по одной детали в свободное время, чтобы не тормозить интерфейс
  const run = (): void => {
    let url = ''
    try {
      url = draw(job.part)
    } catch {
      url = ''
    }
    cache.set(job.key, url)
    waiting.get(job.key)?.forEach((f) => f(url))
    waiting.delete(job.key)
    busy = false
    pump()
  }
  const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback
  if (ric) ric(run, { timeout: 120 })
  else setTimeout(run, 16)
}

/** Картинка детали этого вида и размера; пока рисуется — null (показываем значок) */
export function useThumb(kind: string, size: SizeId, size2?: SizeId): string | null {
  const s2 = size2 ?? defaultSize2(kind, size, undefined)
  const key = `${kind}|${size}|${s2 ?? ''}`
  const [url, setUrl] = useState<string | null>(() => cache.get(key) ?? null)
  useEffect(() => {
    const hit = cache.get(key)
    if (hit !== undefined) return setUrl(hit || null)
    setUrl(null)
    let alive = true
    const done = (u: string): void => {
      if (alive) setUrl(u || null)
    }
    const list = waiting.get(key)
    if (list) list.push(done)
    else {
      waiting.set(key, [done])
      queue.push({ key, part: { id: 'thumb', kind, size, size2: s2, attach: 0, roll: 0, length: 8 } })
      pump()
    }
    return () => {
      alive = false
    }
  }, [key])
  return url
}
