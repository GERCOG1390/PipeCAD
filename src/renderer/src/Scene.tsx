import { GizmoHelper, GizmoViewport, Grid, Html, Line, OrbitControls } from '@react-three/drei'
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Box3,
  Curve,
  CurvePath,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  Plane,
  Ray,
  LatheGeometry,
  MeshStandardMaterial,
  PMREMGenerator,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Part, PathSeg, Shape, SizeId, V3, buildPart, fittingDef, hubR, sizeLabel, sizeSpec } from './catalog'
import { Model, WorldPort, Xf, buildModel, computeTransforms, portKey } from './geometry'
import { placementFor } from './placement'
import { angleOf, withAngle } from './Panels'
import { computeGuides, mouthOf } from './axes'
import { EnvLayer } from './EnvScene'
import { useStore } from './store'
import { formatLength } from './units'

const UP = new Vector3(0, 1, 0)
// идёт установка детали или только что поставили (клик не должен ничего выбирать)
export const busyPlacing = (): boolean => !!useStore.getState().placing || Date.now() - useStore.getState().placedAt < 400
// Точка, куда смотрит камера — сюда ставятся новые объекты окружения
export const viewTarget = new Vector3()
const PVC = '#e8e8e1'
const COPPER = '#c27a52'
const COPPER_TUBE = '#b8714a'
const isCopper = (s: SizeId): boolean => sizeSpec(s).mat === 'cu'
const CAST_IRON = '#26282b'
const GALV = '#a4aaaf'
const PRINT: Record<string, { color: string; text: (sz: string) => string }> = {
  pvc: { color: '#22408a', text: (sz) => `CHARLOTTE®  PVC SCH 40  ${sz}  ASTM D1785 / D2665  NSF-pw-dwv  MADE IN USA` },
  cu: { color: '#1d4ed8', text: (sz) => `TYPE L  ${sz}  COPPER WATER TUBE  ASTM B88  NSF-61  MADE IN USA` },
  ci: { color: '#e8e8e2', text: (sz) => `CHARLOTTE  ${sz}  NO-HUB  CISPI 301  ASTM A888  USA` },
  gs: { color: '#3a3f44', text: (sz) => `${sz}  SCH 40  ASTM A53  GALV` }
}
function pipeMat(size: SizeId, selected: boolean, ghost?: boolean): MeshStandardMaterial {
  switch (sizeSpec(size).mat) {
    case 'cu':
      return mat(COPPER_TUBE, selected, { ghost, metal: true })
    case 'ci':
      return mat(CAST_IRON, selected, { ghost })
    case 'gs':
      return mat(GALV, selected, { ghost, metal: true })
    default:
      return mat(PVC, selected, { ghost })
  }
}

// ---------- материалы (общие на все детали) ----------
const mats = new Map<string, MeshStandardMaterial>()
function mat(color: string, selected: boolean, o: { metal?: boolean; flat?: boolean; ghost?: boolean } = {}): MeshStandardMaterial {
  const key = `${color}|${selected}|${o.metal}|${o.flat}|${o.ghost}`
  let m = mats.get(key)
  if (!m) {
    m = new MeshStandardMaterial({
      color: selected && (color === PVC || color === COPPER || color === COPPER_TUBE) ? '#8fdcd3' : color,
      roughness: o.metal ? 0.32 : 0.48,
      metalness: o.metal ? 0.9 : 0,
      side: DoubleSide,
      flatShading: !!o.flat,
      emissive: selected ? '#0d9488' : '#000000',
      emissiveIntensity: selected ? 0.35 : 0,
      transparent: !!o.ghost,
      opacity: o.ghost ? 0.55 : 1,
      depthWrite: !o.ghost
    })
    mats.set(key, m)
  }
  return m
}

const quatTo = (dir: Vector3): Quaternion => new Quaternion().setFromUnitVectors(UP, dir.clone().normalize())

class SegCurve extends Curve<Vector3> {
  constructor(private seg: PathSeg) {
    super()
  }
  getPoint(t: number, target = new Vector3()): Vector3 {
    const s = this.seg
    if (s.t === 'line') return target.set(...s.a).lerp(new Vector3(...s.b), t)
    const phi = s.ang * t
    return target.set(...s.a).addScaledVector(new Vector3(...s.t0), s.r * Math.sin(phi)).addScaledVector(new Vector3(...s.n), s.r * (1 - Math.cos(phi)))
  }
}

// Рифлёное кольцо (гайка под руку): скруглённые рёбра, открытые торцы, лёгкая фаска по краям
function knurlGeometry(r: number, h: number, ribs: number): BufferGeometry {
  const radial = ribs * 16
  const g = new CylinderGeometry(r, r, h, radial, 12, true)
  const pos = g.attributes.position
  const depth = 0.07
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const d = Math.hypot(x, z)
    if (d < 1e-6) continue
    const a = Math.atan2(z, x)
    // плоские вершины рёбер и скруглённые впадины
    const c = Math.cos(a * ribs)
    const groove = Math.max(0, -c - 0.15) / 0.85
    let rr = r * (1 - depth * Math.pow(groove, 0.6))
    // фаска к торцам
    const fromEnd = h / 2 - Math.abs(y)
    rr = Math.min(rr, r * (1 - depth) + fromEnd * 1.2)
    pos.setX(i, (x / d) * rr)
    pos.setZ(i, (z / d) * rr)
  }
  g.computeVertexNormals()
  return g
}

// Гайка с фасками: многогранник со скошенными углами (как точёная латунная гайка)
function nutGeometry(sides: number, r: number, h: number, ch: number): BufferGeometry {
  const corner = r / Math.cos(Math.PI / sides) // радиус до угла
  const g = new CylinderGeometry(corner, corner, h, sides * 24, 10, false)
  const pos = g.attributes.position
  const sector = (Math.PI * 2) / sides
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const d = Math.hypot(x, z)
    if (d < 1e-6) continue
    const a = Math.atan2(z, x)
    // радиус многогранника под этим углом
    const local = ((a % sector) + sector) % sector - sector / 2
    let rr = r / Math.cos(local)
    // фаска: конус, срезающий углы у торцов
    const fromEnd = h / 2 - Math.abs(y)
    rr = Math.min(rr, r - ch * 0.3 + fromEnd * 1.4)
    pos.setX(i, (x / d) * rr)
    pos.setZ(i, (z / d) * rr)
  }
  g.computeVertexNormals()
  return g
}

// Протяжка скруглённого прямоугольника вдоль сглаженной кривой (рычаг крана, ручка)
function sweepGeometry(path: V3[], w: number, th: number, rad: number, side: V3): BufferGeometry {
  const curve = new CatmullRomCurve3(path.map((p) => new Vector3(...p)), false, 'centripetal')
  const N = Math.max(24, path.length * 16)
  // сечение: скруглённый прямоугольник, x — ширина (side), y — толщина
  const sec: [number, number][] = []
  const rx = Math.min(rad, w / 2 - 1e-4)
  const ry = Math.min(rad, th / 2 - 1e-4)
  const K = 6
  const corners: [number, number, number][] = [
    [w / 2 - rx, th / 2 - ry, 0],
    [-(w / 2 - rx), th / 2 - ry, Math.PI / 2],
    [-(w / 2 - rx), -(th / 2 - ry), Math.PI],
    [w / 2 - rx, -(th / 2 - ry), (Math.PI * 3) / 2]
  ]
  for (const [cx, cy, a0] of corners) for (let j = 0; j <= K; j++) {
    const a = a0 + (j / K) * (Math.PI / 2)
    sec.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
  }
  const S = sec.length
  const sideV = new Vector3(...side).normalize()
  const verts: number[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const p = curve.getPointAt(t)
    const T = curve.getTangentAt(t).normalize()
    const U = new Vector3().crossVectors(T, sideV).normalize() // «вверх» сечения
    const Sd = new Vector3().crossVectors(U, T).normalize()
    for (const [x, y] of sec) verts.push(p.x + Sd.x * x + U.x * y, p.y + Sd.y * x + U.y * y, p.z + Sd.z * x + U.z * y)
  }
  const idx: number[] = []
  for (let i = 0; i < N; i++) for (let j = 0; j < S; j++) {
    const a = i * S + j
    const b = i * S + ((j + 1) % S)
    const c = (i + 1) * S + j
    const d = (i + 1) * S + ((j + 1) % S)
    idx.push(a, c, b, b, c, d)
  }
  // торцы
  for (const [ring, flip] of [[0, true], [N, false]] as [number, boolean][]) {
    const p = curve.getPointAt(ring / N)
    const ci = verts.length / 3
    verts.push(p.x, p.y, p.z)
    for (let j = 0; j < S; j++) {
      const a = ring * S + j
      const b = ring * S + ((j + 1) % S)
      if (flip) idx.push(ci, b, a)
      else idx.push(ci, a, b)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(verts, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ---------- геометрия формы (в координатах детали) ----------
interface Geo {
  geom: BufferGeometry
  pos: Vector3
  quat: Quaternion
  color: string
  metal?: boolean
  flat?: boolean
}

function shapeGeo(s: Shape): Geo | null {
  switch (s.t) {
    case 'tube': {
      const path = new CurvePath<Vector3>()
      s.segs.forEach((seg) => {
        if (seg.t === 'line' && new Vector3(...seg.a).distanceTo(new Vector3(...seg.b)) < 1e-4) return
        path.add(new SegCurve(seg))
      })
      if (!path.curves.length) return null
      const arcs = s.segs.filter((x) => x.t === 'arc').length
      return { geom: new TubeGeometry(path, Math.max(6, arcs * 48 + s.segs.length * 2), s.r, 40, false), pos: new Vector3(), quat: new Quaternion(), color: s.color ?? PVC, metal: s.metal }
    }
    case 'lathe': {
      const pts = s.prof.map(([r, z]) => new Vector2(Math.max(0.0005, r), z))
      // phi в градусах; 0° — направление +Z детали (перед)
      const geom = s.phi ? new LatheGeometry(pts, s.seg ?? 64, (s.phi[0] * Math.PI) / 180, (s.phi[1] * Math.PI) / 180) : new LatheGeometry(pts, s.seg ?? 64)
      return { geom, pos: new Vector3(...s.at), quat: quatTo(new Vector3(...s.dir)), color: s.color ?? PVC, metal: s.metal }
    }
    case 'prism': {
      const dir = new Vector3(...s.dir).normalize()
      const g = new CylinderGeometry(s.r, s.r, s.h, s.sides, 1, false, Math.PI / s.sides)
      return { geom: g, pos: new Vector3(...s.at).addScaledVector(dir, s.h / 2), quat: quatTo(dir), color: s.color ?? PVC, flat: true }
    }
    case 'knurl': {
      const dir = new Vector3(...s.dir).normalize()
      return { geom: knurlGeometry(s.r, s.h, s.ribs), pos: new Vector3(...s.at).addScaledVector(dir, s.h / 2), quat: quatTo(dir), color: s.color ?? PVC }
    }
    case 'box':
      return { geom: new BoxGeometry(...s.size), pos: new Vector3(...s.at), quat: quatTo(new Vector3(...s.dir)), color: s.color ?? PVC, metal: s.metal }
    case 'nut': {
      const dir = new Vector3(...s.dir).normalize()
      return { geom: nutGeometry(s.sides, s.r, s.h, s.ch ?? s.h * 0.18), pos: new Vector3(...s.at).addScaledVector(dir, s.h / 2), quat: quatTo(dir), color: s.color ?? PVC, metal: s.metal }
    }
    case 'rbox': {
      const dir = new Vector3(...s.dir).normalize()
      const q0 = quatTo(dir)
      if (s.yaw) q0.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (s.yaw * Math.PI) / 180))
      return { geom: new RoundedBoxGeometry(s.size[0], s.size[1], s.size[2], 4, Math.min(s.r, Math.min(...s.size) / 2 - 1e-3)), pos: new Vector3(...s.at), quat: q0, color: s.color ?? PVC, metal: s.metal }
    }
    case 'sweep':
      return { geom: sweepGeometry(s.path, s.w, s.th, s.rad ?? Math.min(s.w, s.th) * 0.45, s.side), pos: new Vector3(), quat: new Quaternion(), color: s.color ?? PVC, metal: s.metal }
    case 'pipe':
      return null
  }
}

// ---------- труба: полая, с маркировкой ----------
const printCache = new Map<SizeId, CanvasTexture>()
const PRINT_REPEAT = 36 // дюймов на один повтор надписи
function printTexture(size: SizeId): CanvasTexture {
  let t = printCache.get(size)
  if (t) return t
  const W = 64
  const H = 2048
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  ctx.translate(W / 2, H)
  ctx.rotate(-Math.PI / 2)
  const m = sizeSpec(size).mat
  ctx.fillStyle = PRINT[m].color
  ctx.font = 'bold 34px Arial, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(PRINT[m].text(sizeLabel(size)), 40, 0)
  t = new CanvasTexture(cv)
  t.colorSpace = SRGBColorSpace
  t.wrapT = RepeatWrapping
  t.anisotropy = 4
  printCache.set(size, t)
  return t
}

function PipeBody({ size, len, selected, ghost }: { size: SizeId; len: number; selected: boolean; ghost?: boolean }) {
  const s = sizeSpec(size)
  const ro = s.od / 2
  const ri = ro - s.wall
  const body = useMemo(() => new LatheGeometry([new Vector2(ri, 0), new Vector2(ro, 0), new Vector2(ro, len), new Vector2(ri, len), new Vector2(ri, 0)], 64), [ri, ro, len])
  const band = Math.min(0.32 * s.od, 0.7) / ro
  const print = useMemo(() => {
    const g = new CylinderGeometry(ro + 0.003, ro + 0.003, len, 12, 1, true, Math.PI / 2 - band / 2, band)
    return g
  }, [ro, len, band])
  const tex = useMemo(() => {
    const t = printTexture(size).clone()
    t.repeat.set(1, len / PRINT_REPEAT)
    t.needsUpdate = true
    return t
  }, [size, len])
  useEffect(() => () => (body.dispose(), print.dispose(), tex.dispose()), [body, print, tex])
  return (
    <>
      <mesh geometry={body} material={pipeMat(size, selected, ghost)} quaternion={quatTo(new Vector3(0, 0, 1))} raycast={ghost ? () => null : undefined} />
      <mesh geometry={print} position={[0, 0, len / 2]} quaternion={quatTo(new Vector3(0, 0, 1))}>
        <meshStandardMaterial map={tex} transparent roughness={0.4} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </>
  )
}

function PartMesh({ part, xf, open, ghost }: { part: Part; xf: Xf; open: WorldPort[]; ghost?: boolean }) {
  const selected = useStore((s) => s.selectedId === part.id)
  const select = useStore((s) => s.select)
  const selectPort = useStore((s) => s.selectPort)
  const built = buildPart(part)
  const cu = isCopper(part.size)
  const geos = useMemo(() => built.shapes.map(shapeGeo).filter((g): g is Geo => !!g), [built])
  useEffect(() => () => geos.forEach((g) => g.geom.dispose()), [geos])
  const pipe = built.shapes.find((s): s is Extract<Shape, { t: 'pipe' }> => s.t === 'pipe')
  const onClick = (e: ThreeEvent<MouseEvent>): void => {
    if (e.delta > 4 || busyPlacing()) return
    // по метке конца (даже если она за деталью) кликаем в метку, а не в деталь
    if (e.intersections.some((i) => i.object.userData.portHit)) return
    e.stopPropagation()
    // клик рядом с открытым концом сразу выбирает этот конец
    let best: WorldPort | null = null
    let bestD = Infinity
    for (const w of open) {
      const d = w.pos.distanceTo(e.point)
      if (d < bestD) {
        bestD = d
        best = w
      }
    }
    const reach = part.kind === 'pipe' ? Math.max(3, Math.min(12, (part.length ?? 0) * 0.25)) : Infinity
    if (best && bestD <= reach) selectPort({ id: best.partId, port: best.index })
    else select(part.id)
  }
  return (
    <group position={xf.pos} quaternion={xf.quat} onClick={onClick}>
      {pipe && <PipeBody size={pipe.size} len={pipe.len} selected={selected} ghost={ghost} />}
      {geos.map((g, i) => (
        <mesh key={i} geometry={g.geom} position={g.pos} quaternion={g.quat} material={cu && g.color === PVC ? mat(COPPER, selected, { metal: true, flat: g.flat, ghost }) : mat(g.color, selected, { metal: g.metal || g.color === '#c9a64a', flat: g.flat, ghost })} raycast={ghost ? () => null : undefined} />
      ))}
    </group>
  )
}

const setCursor = (c: string): void => {
  document.body.style.cursor = c
}

// Метка свободного конца: видимое кольцо + невидимая крупная зона клика (не меньше ~20 px на экране)
function PortMarker({ w, active, onPick, disabled }: { w: WorldPort; active: boolean; onPick: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false)
  const hit = useRef<Mesh>(null)
  const { camera } = useThree()
  const face = w.def.depth ? w.def.face ?? w.def.depth : 0
  const pos = useMemo(() => w.pos.clone().addScaledVector(w.dir, face + 0.03), [w, face])
  const r = hubR(w.size, w.def.fam) * 1.04
  const thread = w.def.kind === 'fpt' || w.def.kind === 'mpt'
  useFrame(() => {
    if (!hit.current) return
    const want = Math.max(r * 1.5, camera.position.distanceTo(pos) * 0.028)
    hit.current.scale.setScalar(want)
  })
  useEffect(() => () => setCursor('auto'), [])
  const k = active ? 1.18 : hover ? 1.12 : 1
  const color = active ? '#f59e0b' : hover ? '#fde68a' : thread ? '#60a5fa' : '#4ade80'
  return (
    <group position={pos} quaternion={quatTo(w.dir)}>
      <mesh renderOrder={10}>
        <cylinderGeometry args={[r * k, r * k, Math.max(0.06, r * 0.12), 40, 1, true]} />
        <meshBasicMaterial color={color} side={DoubleSide} depthTest={false} transparent opacity={active || hover ? 0.95 : 0.75} />
      </mesh>
      {hover && !active && (
        <mesh renderOrder={10}>
          <circleGeometry args={[r * 0.9, 32]} />
          <meshBasicMaterial color="#fde68a" side={DoubleSide} depthTest={false} transparent opacity={0.25} />
        </mesh>
      )}
      <mesh
        ref={hit}
        userData={{ portHit: true }}
        raycast={disabled ? () => null : undefined}
        onClick={(e) => {
          if (e.delta > 4) return
          e.stopPropagation()
          onPick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          setCursor('pointer')
        }}
        onPointerOut={() => {
          setHover(false)
          setCursor('auto')
        }}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  )
}

function PortMarkers({ model }: { model: Model }) {
  const show = useStore((s) => s.showPorts && !s.replay)
  const placing = useStore((s) => !!s.placing)
  const active = useStore((s) => s.activePort)
  const selectPort = useStore((s) => s.selectPort)
  const badPorts = model.ports.filter((w) => model.bad.includes(portKey(w.partId, w.index)))
  if (!show) return null
  return (
    <>
      {badPorts.map((w) => (
        <mesh key={'bad' + portKey(w.partId, w.index)} position={w.pos} renderOrder={11}>
          <sphereGeometry args={[hubR(w.size, w.def.fam) * 1.15, 20, 14]} />
          <meshBasicMaterial color="#e2574c" depthTest={false} transparent opacity={0.55} />
        </mesh>
      ))}
      {model.open.map((w) => (
        <PortMarker
          key={portKey(w.partId, w.index)}
          w={w}
          active={!!active && portKey(active.id, active.port) === portKey(w.partId, w.index)}
          onPick={() => (useStore.getState().joining ? useStore.getState().joinTo({ id: w.partId, port: w.index }) : selectPort({ id: w.partId, port: w.index }))}
          disabled={placing}
        />
      ))}
    </>
  )
}

// ---------- Ручки длины ----------
// Тянем конец трубы `end` вдоль её оси. Противоположный конец трубы остаётся на месте:
// если двигается конец со стороны начала системы, вся система сдвигается на ту же величину.

const tmpZ = new Vector3(0, 0, 1)

function rootOf(parts: Part[], id: string): Part {
  const byId = new Map(parts.map((p) => [p.id, p]))
  let p = byId.get(id)!
  while (p.parent && byId.get(p.parent.id)) p = byId.get(p.parent.id)!
  return p
}

const worldPort = (parts: Part[], id: string, index: number): Vector3 | null =>
  buildModel(parts).ports.find((w) => w.partId === id && w.index === index)?.pos.clone() ?? null

// Параметр точки на прямой (o + u·t), ближайшей к лучу мыши
function rayParam(ray: Ray, o: Vector3, u: Vector3): number | null {
  const w0 = o.clone().sub(ray.origin)
  const b = u.dot(ray.direction)
  const d = u.dot(w0)
  const e = ray.direction.dot(w0)
  const den = 1 - b * b
  if (Math.abs(den) < 1e-6) return null
  return (b * e - d) / den
}

interface DragState {
  parts: Part[]
  L0: number
  t0: number
  anchor: Vector3 // мировое положение неподвижного конца
  u: Vector3 // направление от неподвижного конца к тянущемуся
}

function LengthHandle({ pipeId, end, at, dir }: { pipeId: string; end: 0 | 1; at: Vector3; dir: Vector3 }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const { camera } = useThree()
  const pipe = useStore((s) => s.parts.find((p) => p.id === pipeId))
  const [drag, setDrag] = useState<DragState | null>(null)
  const [hover, setHover] = useState(false)
  const grip = useRef<Group>(null)
  const quat = useMemo(() => new Quaternion().setFromUnitVectors(tmpZ, dir.clone().normalize()), [dir])
  useFrame(() => {
    if (grip.current) grip.current.scale.setScalar(Math.max(0.8, camera.position.distanceTo(at) * 0.022))
  })
  useEffect(() => () => setCursor('auto'), [])
  if (!pipe) return null
  const len = pipe.length ?? 0
  const color = drag || hover ? '#fde68a' : '#2dd4bf'

  const start = (ray: Ray): DragState | null => {
    const parts = useStore.getState().parts
    const anchor = worldPort(parts, pipeId, end === 1 ? 0 : 1)
    const moving = worldPort(parts, pipeId, end)
    if (!anchor || !moving) return null
    const u = moving.clone().sub(anchor).normalize()
    const t0 = rayParam(ray, anchor, u)
    if (t0 === null) return null
    return { parts, L0: len, t0, anchor, u }
  }

  const apply = (d: DragState, ray: Ray, fine: boolean): void => {
    const t = rayParam(ray, d.anchor, d.u)
    if (t === null) return
    const step = fine ? 0.125 : useStore.getState().snap
    const L = Math.max(1, Math.round((d.L0 + t - d.t0) / step) * step)
    let next = d.parts.map((p) => (p.id === pipeId ? { ...p, length: L } : p))
    // держим неподвижный конец на месте, сдвигая всю систему
    const now = worldPort(next, pipeId, end === 1 ? 0 : 1)
    if (now) {
      const shift = d.anchor.clone().sub(now)
      if (shift.lengthSq() > 1e-8) {
        const root = rootOf(next, pipeId)
        const rp = new Vector3(...(root.pos ?? [0, 0, 0])).add(shift)
        next = next.map((p) => (p.id === root.id ? { ...p, pos: [rp.x, rp.y, rp.z] as V3 } : p))
      }
    }
    useStore.getState().dragTo({ parts: next })
  }

  return (
    <group position={at} quaternion={quat}>
      <group ref={grip}>
        <mesh renderOrder={13}>
          <sphereGeometry args={[0.28, 16, 12]} />
          <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
        </mesh>
        <mesh renderOrder={13} position={[0, 0, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.3, 0.6, 20]} />
          <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
        </mesh>
        <mesh renderOrder={13} position={[0, 0, -0.7]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.3, 0.6, 20]} />
          <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
        </mesh>
        <mesh
          userData={{ portHit: true }}
          onPointerDown={(e) => {
            e.stopPropagation()
            const d = start(e.ray)
            if (!d) return
            ;(e.target as Element).setPointerCapture(e.pointerId)
            if (controls) controls.enabled = false
            useStore.getState().beginDrag()
            setDrag(d)
          }}
          onPointerMove={(e) => {
            if (!drag) return
            e.stopPropagation()
            apply(drag, e.ray, e.nativeEvent.shiftKey)
          }}
          onPointerUp={(e) => {
            if (!drag) return
            e.stopPropagation()
            ;(e.target as Element).releasePointerCapture(e.pointerId)
            if (controls) controls.enabled = true
            setDrag(null)
            useStore.getState().endDrag()
            const L = useStore.getState().parts.find((p) => p.id === pipeId)?.length
            if (L) useStore.setState({ lastPipe: L })
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerOver={() => {
            setHover(true)
            setCursor('grab')
          }}
          onPointerOut={() => {
            setHover(false)
            if (!drag) setCursor('auto')
          }}
        >
          <sphereGeometry args={[0.95, 16, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      </group>
      {(drag || hover) && (
        <Html center zIndexRange={[20, 10]} style={{ pointerEvents: 'none', transform: 'translateY(-34px)' }}>
          <div className="dim drag">{formatLength(len)}</div>
        </Html>
      )}
    </group>
  )
}

// Ручки для выбранной детали: у трубы — на обоих концах, у фитинга — вдоль каждой подключённой трубы
function LengthHandles({ model }: { model: Model }) {
  const parts = useStore((s) => s.parts)
  const selectedId = useStore((s) => s.selectedId)
  const replaying = useStore((s) => !!s.replay)
  const sel = parts.find((p) => p.id === selectedId)
  if (!sel || replaying) return null
  const handles: { pipeId: string; end: 0 | 1; at: Vector3; dir: Vector3; key: string }[] = []
  const byKey = new Map(model.ports.map((w) => [portKey(w.partId, w.index), w]))
  if (sel.kind === 'pipe') {
    for (const end of [0, 1] as const) {
      const w = byKey.get(portKey(sel.id, end))
      if (w) handles.push({ pipeId: sel.id, end, at: w.pos.clone().addScaledVector(w.dir, 0.6), dir: w.dir, key: `${sel.id}:${end}` })
    }
  } else {
    model.ports
      .filter((w) => w.partId === sel.id)
      .forEach((w) => {
        const other = model.links.get(portKey(w.partId, w.index))
        if (!other) return
        const [oid, oi] = other.split(':')
        if (parts.find((p) => p.id === oid)?.kind !== 'pipe') return
        const face = w.def.depth ? w.def.face ?? w.def.depth : 0
        // стрелка у раструба фитинга, направлена вдоль трубы (от трубы — удлинение)
        const off = face + Math.max(1.5, hubR(w.size, w.def.fam) * 1.6)
        handles.push({ pipeId: oid, end: Number(oi) as 0 | 1, at: w.pos.clone().addScaledVector(w.dir, off), dir: w.dir.clone().negate(), key: other })
      })
  }
  return (
    <>
      {handles.map((h) => (
        <LengthHandle key={h.key} pipeId={h.pipeId} end={h.end} at={h.at} dir={h.dir} />
      ))}
    </>
  )
}

// ---------- Кольцо поворота выбранного фитинга (шаг 1°, с Shift — 15°) ----------
function RotateRing({ model }: { model: Model }) {
  const parts = useStore((s) => s.parts)
  const selectedId = useStore((s) => s.selectedId)
  const replaying = useStore((s) => !!s.replay || !!s.placing)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const [drag, setDrag] = useState<{ start: number; v0: Vector3 } | null>(null)
  const [hover, setHover] = useState(false)
  const part = parts.find((p) => p.id === selectedId)
  useEffect(() => () => setCursor('auto'), [])
  if (!part || part.kind === 'pipe' || replaying) return null

  // центр и ось вращения
  let center: Vector3
  let axis: Vector3
  if (part.parent) {
    const w = model.ports.find((x) => x.partId === part.parent!.id && x.index === part.parent!.port)
    if (!w) return null
    center = w.pos.clone()
    axis = w.dir.clone()
  } else {
    const xf = model.xfs.get(part.id)
    if (!xf) return null
    center = xf.pos.clone()
    axis = new Vector3(0, 1, 0)
  }
  const R = Math.max(2.5, hubR(part.size, fittingDef(part.kind).group === 'dwv' ? 'd' : 'p') * 2.3)
  const quat = new Quaternion().setFromUnitVectors(tmpZ, axis)
  const plane = new Plane().setFromNormalAndCoplanarPoint(axis, center)
  const onPlane = (ray: Ray): Vector3 | null => {
    const p = ray.intersectPlane(plane, new Vector3())
    if (!p) return null
    const v = p.sub(center)
    return v.lengthSq() < 1e-6 ? null : v.normalize()
  }
  const angle = Math.round(angleOf(part))
  const color = drag || hover ? '#fde68a' : '#a78bfa'

  return (
    <group position={center} quaternion={quat}>
      <mesh renderOrder={13}>
        <torusGeometry args={[R, Math.max(0.07, R * 0.025), 10, 96]} />
        <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.9} />
      </mesh>
      {/* риски каждые 45° */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
        <mesh key={d} renderOrder={13} position={[Math.cos((d * Math.PI) / 180) * R, Math.sin((d * Math.PI) / 180) * R, 0]}>
          <sphereGeometry args={[Math.max(0.1, R * 0.04), 10, 8]} />
          <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.9} />
        </mesh>
      ))}
      <mesh
        userData={{ portHit: true }}
        onPointerDown={(e) => {
          e.stopPropagation()
          const v0 = onPlane(e.ray)
          if (!v0) return
          ;(e.target as Element).setPointerCapture(e.pointerId)
          if (controls) controls.enabled = false
          useStore.getState().beginDrag()
          setDrag({ start: angleOf(part), v0 })
        }}
        onPointerMove={(e) => {
          if (!drag) return
          e.stopPropagation()
          const v = onPlane(e.ray)
          if (!v) return
          const a = (Math.atan2(drag.v0.clone().cross(v).dot(axis), drag.v0.dot(v)) * 180) / Math.PI
          const step = e.nativeEvent.shiftKey ? 15 : 1
          const deg = Math.round((drag.start + a) / step) * step
          const s = useStore.getState()
          s.dragTo({ parts: s.parts.map((p) => (p.id === part.id ? withAngle(p, deg) : p)) })
        }}
        onPointerUp={(e) => {
          if (!drag) return
          e.stopPropagation()
          ;(e.target as Element).releasePointerCapture(e.pointerId)
          if (controls) controls.enabled = true
          setDrag(null)
          useStore.getState().endDrag()
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerOver={() => {
          setHover(true)
          setCursor('grab')
        }}
        onPointerOut={() => {
          setHover(false)
          if (!drag) setCursor('auto')
        }}
      >
        <torusGeometry args={[R, Math.max(0.45, R * 0.12), 8, 64]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {(drag || hover) && (
        <Html position={[R, 0, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none', transform: 'translate(26px, -18px)' }}>
          <div className="dim drag">{angle}°</div>
        </Html>
      )}
    </group>
  )
}

// ---------- Оси свободных концов и пересечения ----------
function AxisGuides({ model }: { model: Model }) {
  const show = useStore((s) => s.showAxes)
  const parts = useStore((s) => s.parts)
  const active = useStore((s) => s.activePort)
  const connectAt = useStore((s) => s.connectAt)
  const guides = useMemo(() => (show ? computeGuides(model, parts, active) : []), [show, model, parts, active])
  if (!show) return null
  const activeKey = active ? portKey(active.id, active.port) : null
  // длина оси: до самого дальнего пересечения + запас
  const reach = new Map<string, number>()
  for (const g of guides) {
    for (const [w, t] of [[g.a, g.tA], [g.b, g.tB]] as const) {
      const k = portKey(w.partId, w.index)
      reach.set(k, Math.max(reach.get(k) ?? 0, t + 12))
    }
  }
  return (
    <>
      {model.open.map((w) => {
        const k = portKey(w.partId, w.index)
        const isA = k === activeKey
        const from = mouthOf(w)
        const len = Math.max(reach.get(k) ?? 0, isA ? 144 : 48)
        const to = w.pos.clone().addScaledVector(w.dir, len)
        return <Line key={k} points={[from, to]} color={isA ? '#f59e0b' : '#7dd3fc'} lineWidth={isA ? 2 : 1.2} dashed dashSize={2} gapSize={1.2} transparent opacity={isA ? 0.95 : 0.6} depthTest={false} renderOrder={9} />
      })}
      {guides.map((g, i) => {
        const X = g.pA.clone().add(g.pB).multiplyScalar(0.5)
        const hit = g.miss <= 0.5
        const cutA = g.fit ? g.tA - g.fit.takeoff : null
        const cutB = g.fit ? g.tB - g.fit.takeoff : null
        return (
          <group key={i}>
            {!hit && <Line points={[g.pA, g.pB]} color="#ef4444" lineWidth={2} dashed dashSize={0.6} gapSize={0.4} depthTest={false} renderOrder={9} />}
            <mesh position={X} renderOrder={12}>
              <sphereGeometry args={[hit ? 0.7 : 0.45, 20, 14]} />
              <meshBasicMaterial color={hit ? (g.fit ? '#22c55e' : '#eab308') : '#ef4444'} depthTest={false} transparent opacity={0.9} />
            </mesh>
            <Html position={X} zIndexRange={[30, 20]} style={{ transform: 'translate(14px, -50%)' }}>
              <div className="axis-label" onPointerDown={(e) => e.stopPropagation()}>
                {hit ? (
                  <>
                    <b>
                      Turn {Math.round(g.turn * 10) / 10}° {g.fit ? `→ ${g.fit.ru}` : '— no standard bend'}
                    </b>
                    <div>
                      To intersection: {formatLength(g.tA)} and {formatLength(g.tB)}
                    </div>
                    {g.fit && cutA !== null && cutB !== null && (
                      <div>
                        Cuts: {cutA > 0.25 ? formatLength(cutA) : '—'} and {cutB > 0.25 ? formatLength(cutB) : '—'}
                      </div>
                    )}
                    {g.fit && activeKey && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          connectAt({ id: g.a.partId, port: g.a.index }, { id: g.b.partId, port: g.b.index }, [X.x, X.y, X.z], g.fit!.kind, g.fit!.takeoff)
                        }}
                      >
                        Join here
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <b>Axes don't intersect</b>
                    <div>Offset {formatLength(g.miss)} · turn {Math.round(g.turn * 10) / 10}°</div>
                  </>
                )}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

// ---------- Установка новой ветки ----------
const floorPlane = new Plane(new Vector3(0, 1, 0), 0)
function PlacementLayer() {
  const placing = useStore((s) => s.placing)
  const turn = useStore((s) => s.placeTurn)
  const paletteSize = useStore((s) => s.paletteSize)
  const { camera, raycaster, pointer, scene, gl } = useThree()
  const [hit, setHit] = useState<V3 | null>(null)
  const hitRef = useRef<V3 | null>(null)

  useFrame(() => {
    if (!placing) return
    raycaster.setFromCamera(pointer, camera)
    const envRoot = scene.getObjectByName('env')
    const hits = envRoot ? raycaster.intersectObject(envRoot, true) : []
    let p: Vector3 | undefined = hits[0]?.point
    if (!p) {
      const q = new Vector3()
      p = raycaster.ray.intersectPlane(floorPlane, q) ?? undefined
    }
    if (!p) return
    const step = useStore.getState().snap
    const v: V3 = [Math.round(p.x / step) * step, p.y, Math.round(p.z / step) * step]
    const prev = hitRef.current
    if (!prev || prev[0] !== v[0] || Math.abs(prev[1] - v[1]) > 1e-3 || prev[2] !== v[2]) {
      hitRef.current = v
      setHit(v)
    }
  })

  // клик (без перетаскивания камеры) ставит деталь
  useEffect(() => {
    if (!placing) return
    const el = gl.domElement
    let down: [number, number] | null = null
    const onDown = (e: PointerEvent): void => {
      if (e.button === 0) down = [e.clientX, e.clientY]
    }
    const onUp = (e: PointerEvent): void => {
      if (e.button !== 0 || !down) return
      const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1])
      down = null
      if (moved < 5 && hitRef.current && useStore.getState().placing) useStore.getState().placeAt(hitRef.current)
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.style.cursor = 'crosshair'
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.style.cursor = ''
    }
  }, [placing, gl])

  const ghost = useMemo(() => {
    if (!placing || !hit) return null
    const s = useStore.getState()
    return placementFor(placing, hit, { id: '__ghost', size: paletteSize, reducerTo: s.reducerTo, lastPipe: s.lastPipe, turn })
  }, [placing, hit, turn, paletteSize])
  if (!placing || !ghost || !hit) return null
  const xf = computeTransforms([ghost]).get(ghost.id)!
  return (
    <>
      <PartMesh part={ghost} xf={xf} open={[]} ghost />
      <mesh position={[hit[0], hit[1] + 0.02, hit[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={12}>
        <ringGeometry args={[1.6, 2, 40]} />
        <meshBasicMaterial color="#f59e0b" depthTest={false} transparent opacity={0.9} side={DoubleSide} />
      </mesh>
    </>
  )
}

// Подписи длин труб: свой слой поверх холста, без React-порталов (drei Html при массовом удалении
// конфликтует с React 19). Элементы создаём и двигаем сами, каждый кадр.
function DimLabels({ model, parts }: { model: Model; parts: Part[] }) {
  const { camera, gl, size } = useThree()
  const layer = useRef<HTMLDivElement | null>(null)
  const items = useRef<{ el: HTMLDivElement; pos: Vector3 }[]>([])
  useEffect(() => {
    const host = gl.domElement.parentElement
    if (!host) return
    const div = document.createElement('div')
    div.className = 'dim-layer'
    host.appendChild(div)
    layer.current = div
    return () => {
      div.remove()
      layer.current = null
      items.current = []
    }
  }, [gl])
  useEffect(() => {
    const div = layer.current
    if (!div) return
    div.textContent = ''
    items.current = parts
      .filter((p) => p.kind === 'pipe')
      .map((p) => {
        const xf = model.xfs.get(p.id)!
        const el = document.createElement('div')
        el.className = 'dim'
        el.textContent = formatLength(p.length ?? 0)
        div.appendChild(el)
        return { el, pos: new Vector3(0, 0, (p.length ?? 0) / 2).applyQuaternion(xf.quat).add(xf.pos) }
      })
  }, [parts, model])
  const v = useMemo(() => new Vector3(), [])
  useFrame(() => {
    for (const it of items.current) {
      v.copy(it.pos).project(camera)
      if (v.z > 1 || v.z < -1) {
        it.el.style.display = 'none'
        continue
      }
      it.el.style.display = ''
      it.el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`
    }
  })
  return null
}

// Мягкое окружение для отражений на пластике (без загрузки HDR из сети)
function EnvSetup() {
  const { gl, scene } = useThree()
  const camera = useThree((st) => st.camera)
  // для автотестов: проекция точек на экран
  ;(window as unknown as { pipecadCamera: typeof camera }).pipecadCamera = camera
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.45
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

function CameraRig({ model }: { model: Model }) {
  const { camera, scene } = useThree()
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const view = useStore((s) => s.view)
  ;(window as unknown as { pipecadControls: unknown }).pipecadControls = controls // для автотестов
  useEffect(() => {
    if (!controls || view.tick === 0) return
    const box = new Box3()
    const root = scene.getObjectByName('parts')
    if (root) box.setFromObject(root)
    model.ports.forEach((w) => box.expandByPoint(w.pos))
    if (box.isEmpty()) box.set(new Vector3(-12, -12, -12), new Vector3(12, 12, 12))
    const center = box.getCenter(new Vector3())
    const size = Math.max(box.getSize(new Vector3()).length(), 8)
    const dir = view.dir ? new Vector3(...view.dir).normalize() : camera.position.clone().sub(controls.target).normalize()
    camera.position.copy(center).addScaledVector(dir, size * 1.45 + 2)
    if (view.dir && Math.abs(dir.y) > 0.99) camera.up.set(0, 0, -1)
    else camera.up.set(0, 1, 0)
    controls.target.copy(center)
    controls.update()
  }, [view.tick])
  return null
}

export function Scene({ model }: { model: Model }) {
  const parts = useStore((s) => s.parts)
  const showDims = useStore((s) => s.showDims)
  const select = useStore((s) => s.select)
  const autoRotate = useStore((s) => !!s.replay && s.replay.auto && s.replay.playing)
  return (
    <Canvas
      camera={{ position: [60, 45, 70], fov: 40, near: 0.05, far: 10000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, toneMappingExposure: 0.95 }}
      onPointerMissed={(e) => e.button === 0 && !busyPlacing() && select(null)}
    >
      <color attach="background" args={['#1a1e23']} />
      <EnvSetup />
      <hemisphereLight args={['#ffffff', '#2a3038', 0.25]} />
      <directionalLight position={[50, 110, 70]} intensity={1.7} />
      <directionalLight position={[-90, 30, -40]} intensity={0.35} color="#cfe3ff" />
      <directionalLight position={[0, -60, 20]} intensity={0.15} />
      <Grid
        position={[0, -0.02, 0]}
        infiniteGrid
        cellSize={12}
        sectionSize={60}
        cellThickness={0.6}
        sectionThickness={1}
        cellColor="#2b3238"
        sectionColor="#2f6f6c"
        fadeDistance={900}
        fadeStrength={1.5}
      />
      <group name="parts">
        {parts.map((p) => (
          <PartMesh key={p.id} part={p} xf={model.xfs.get(p.id)!} open={model.open.filter((w) => w.partId === p.id)} />
        ))}
      </group>
      <EnvLayer model={model} />
      <PortMarkers model={model} />
      <LengthHandles model={model} />
      <RotateRing model={model} />
      <PlacementLayer />
      <AxisGuides model={model} />
      {showDims && <DimLabels model={model} parts={parts} />}
      <OrbitControls makeDefault enableDamping={false} autoRotate={autoRotate} autoRotateSpeed={0.7} onChange={(e) => e && viewTarget.copy((e.target as unknown as OrbitControlsImpl).target)} />
      <CameraRig model={model} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.9} />
      </GizmoHelper>
    </Canvas>
  )
}
