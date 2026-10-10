import { GizmoHelper, GizmoViewport, Grid, Html, OrbitControls } from '@react-three/drei'
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Box3,
  Curve,
  CurvePath,
  CylinderGeometry,
  DoubleSide,
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
import { Part, PathSeg, Shape, SizeId, buildPart, hubR, sizeLabel, sizeSpec } from './catalog'
import { Model, Xf, portKey } from './geometry'
import { EnvLayer } from './EnvScene'
import { useStore } from './store'
import { formatLength } from './units'

const UP = new Vector3(0, 1, 0)
// Точка, куда смотрит камера — сюда ставятся новые объекты окружения
export const viewTarget = new Vector3()
const PVC = '#e8e8e1'

// ---------- материалы (общие на все детали) ----------
const mats = new Map<string, MeshStandardMaterial>()
function mat(color: string, selected: boolean, o: { metal?: boolean; flat?: boolean } = {}): MeshStandardMaterial {
  const key = `${color}|${selected}|${o.metal}|${o.flat}`
  let m = mats.get(key)
  if (!m) {
    m = new MeshStandardMaterial({
      color: selected && color === PVC ? '#8fdcd3' : color,
      roughness: o.metal ? 0.28 : 0.48,
      metalness: o.metal ? 0.85 : 0,
      side: DoubleSide,
      flatShading: !!o.flat,
      emissive: selected ? '#0d9488' : '#000000',
      emissiveIntensity: selected ? 0.35 : 0
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

function PipeBody({ size, len, selected }: { size: SizeId; len: number; selected: boolean }) {
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
      <mesh geometry={body} material={mat(PVC, selected)} quaternion={quatTo(new Vector3(0, 0, 1))} />
      <mesh geometry={print} position={[0, 0, len / 2]} quaternion={quatTo(new Vector3(0, 0, 1))}>
        <meshStandardMaterial map={tex} transparent roughness={0.4} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </>
  )
}

function PartMesh({ part, xf }: { part: Part; xf: Xf }) {
  const selected = useStore((s) => s.selectedId === part.id)
  const select = useStore((s) => s.select)
  const built = buildPart(part)
  const geos = useMemo(() => built.shapes.map(shapeGeo).filter((g): g is Geo => !!g), [built])
  useEffect(() => () => geos.forEach((g) => g.geom.dispose()), [geos])
  const pipe = built.shapes.find((s): s is Extract<Shape, { t: 'pipe' }> => s.t === 'pipe')
  const onClick = (e: ThreeEvent<MouseEvent>): void => {
    if (e.delta > 4) return
    e.stopPropagation()
    select(part.id)
  }
  return (
    <group position={xf.pos} quaternion={xf.quat} onClick={onClick}>
      {pipe && <PipeBody size={pipe.size} len={pipe.len} selected={selected} />}
      {geos.map((g, i) => (
        <mesh key={i} geometry={g.geom} position={g.pos} quaternion={g.quat} material={mat(g.color, selected, { metal: g.metal, flat: g.flat })} />
      ))}
    </group>
  )
}

function PortMarkers({ model }: { model: Model }) {
  const show = useStore((s) => s.showPorts)
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
      {model.open.map((w) => {
        const face = w.def.depth ? w.def.face ?? w.def.depth : 0
        const pos = w.pos.clone().addScaledVector(w.dir, face + 0.03)
        const isActive = active && portKey(active.id, active.port) === portKey(w.partId, w.index)
        const r = hubR(w.size, w.def.fam) * 1.04
        const thread = w.def.kind === 'fpt' || w.def.kind === 'mpt'
        return (
          <mesh
            key={portKey(w.partId, w.index)}
            position={pos}
            quaternion={quatTo(w.dir)}
            renderOrder={10}
            onClick={(e) => {
              if (e.delta > 4) return
              e.stopPropagation()
              selectPort({ id: w.partId, port: w.index })
            }}
          >
            <cylinderGeometry args={[r * (isActive ? 1.18 : 1), r * (isActive ? 1.18 : 1), Math.max(0.06, r * 0.12), 40, 1, true]} />
            <meshBasicMaterial color={isActive ? '#f59e0b' : thread ? '#60a5fa' : '#4ade80'} side={DoubleSide} depthTest={false} transparent opacity={isActive ? 0.95 : 0.75} />
          </mesh>
        )
      })}
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
      onPointerMissed={(e) => e.button === 0 && select(null)}
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
          <PartMesh key={p.id} part={p} xf={model.xfs.get(p.id)!} />
        ))}
      </group>
      <EnvLayer model={model} />
      <PortMarkers model={model} />
      {showDims && <DimLabels model={model} parts={parts} />}
      <OrbitControls makeDefault enableDamping={false} onChange={(e) => e && viewTarget.copy((e.target as unknown as OrbitControlsImpl).target)} />
      <CameraRig model={model} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.9} />
      </GizmoHelper>
    </Canvas>
  )
}
