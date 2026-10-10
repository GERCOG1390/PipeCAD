import { GizmoHelper, GizmoViewport, Grid, Html, OrbitControls } from '@react-three/drei'
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
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
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Part, PathSeg, Shape, SizeId, V3, buildPart, hubR, sizeLabel, sizeSpec } from './catalog'
import { Model, WorldPort, Xf, buildModel, computeTransforms, portKey } from './geometry'
import { placementFor } from './placement'
import { EnvLayer } from './EnvScene'
import { useStore } from './store'
import { formatLength } from './units'

const UP = new Vector3(0, 1, 0)
// идёт установка детали или только что поставили (клик не должен ничего выбирать)
export const busyPlacing = (): boolean => !!useStore.getState().placing || Date.now() - useStore.getState().placedAt < 400
// Точка, куда смотрит камера — сюда ставятся новые объекты окружения
export const viewTarget = new Vector3()
const PVC = '#e8e8e1'

// ---------- материалы (общие на все детали) ----------
const mats = new Map<string, MeshStandardMaterial>()
function mat(color: string, selected: boolean, o: { metal?: boolean; flat?: boolean; ghost?: boolean } = {}): MeshStandardMaterial {
  const key = `${color}|${selected}|${o.metal}|${o.flat}|${o.ghost}`
  let m = mats.get(key)
  if (!m) {
    m = new MeshStandardMaterial({
      color: selected && color === PVC ? '#8fdcd3' : color,
      roughness: o.metal ? 0.28 : 0.48,
      metalness: o.metal ? 0.85 : 0,
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

function knurlGeometry(r: number, h: number, ribs: number): BufferGeometry {
  const g = new CylinderGeometry(r, r, h, ribs * 4, 1, false)
  const pos = g.attributes.position
  const step = (Math.PI * 2) / (ribs * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const d = Math.hypot(x, z)
    if (d < r * 0.5) continue
    const a = Math.atan2(z, x) + Math.PI
    const k = Math.floor(a / step + 1e-6) % 2 ? 0.93 : 1
    pos.setX(i, (x / d) * r * k)
    pos.setZ(i, (z / d) * r * k)
  }
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
      return { geom: new TubeGeometry(path, Math.max(6, arcs * 48 + s.segs.length * 2), s.r, 40, false), pos: new Vector3(), quat: new Quaternion(), color: PVC }
    }
    case 'lathe': {
      const pts = s.prof.map(([r, z]) => new Vector2(Math.max(0.0005, r), z))
      return { geom: new LatheGeometry(pts, 64), pos: new Vector3(...s.at), quat: quatTo(new Vector3(...s.dir)), color: s.color ?? PVC, metal: s.metal }
    }
    case 'prism': {
      const dir = new Vector3(...s.dir).normalize()
      const g = new CylinderGeometry(s.r, s.r, s.h, s.sides, 1, false, Math.PI / s.sides)
      return { geom: g, pos: new Vector3(...s.at).addScaledVector(dir, s.h / 2), quat: quatTo(dir), color: s.color ?? PVC, flat: true }
    }
    case 'knurl': {
      const dir = new Vector3(...s.dir).normalize()
      return { geom: knurlGeometry(s.r, s.h, s.ribs), pos: new Vector3(...s.at).addScaledVector(dir, s.h / 2), quat: quatTo(dir), color: s.color ?? PVC, flat: true }
    }
    case 'box':
      return { geom: new BoxGeometry(...s.size), pos: new Vector3(...s.at), quat: quatTo(new Vector3(...s.dir)), color: s.color ?? PVC, metal: s.metal }
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
  ctx.fillStyle = '#22408a'
  ctx.font = 'bold 34px Arial, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(`CHARLOTTE®  PVC SCH 40  ${sizeLabel(size)}  ASTM D1785 / D2665  NSF-pw-dwv  MADE IN USA`, 40, 0)
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
      <mesh geometry={body} material={mat(PVC, selected, { ghost })} quaternion={quatTo(new Vector3(0, 0, 1))} raycast={ghost ? () => null : undefined} />
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
        <mesh key={i} geometry={g.geom} position={g.pos} quaternion={g.quat} material={mat(g.color, selected, { metal: g.metal, flat: g.flat, ghost })} raycast={ghost ? () => null : undefined} />
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
  const show = useStore((s) => s.showPorts)
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
          onPick={() => selectPort({ id: w.partId, port: w.index })}
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
  const sel = parts.find((p) => p.id === selectedId)
  if (!sel) return null
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

function DimLabels({ model, parts }: { model: Model; parts: Part[] }) {
  return (
    <>
      {parts
        .filter((p) => p.kind === 'pipe')
        .map((p) => {
          const xf = model.xfs.get(p.id)!
          const mid = new Vector3(0, 0, (p.length ?? 0) / 2).applyQuaternion(xf.quat).add(xf.pos)
          return (
            <Html key={p.id} position={mid} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <div className="dim">{formatLength(p.length ?? 0)}</div>
            </Html>
          )
        })}
    </>
  )
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
      <PlacementLayer />
      {showDims && <DimLabels model={model} parts={parts} />}
      <OrbitControls makeDefault enableDamping={false} onChange={(e) => e && viewTarget.copy((e.target as unknown as OrbitControlsImpl).target)} />
      <CameraRig model={model} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.9} />
      </GizmoHelper>
    </Canvas>
  )
}
