import { GizmoHelper, GizmoViewport, Grid, Html, OrbitControls } from '@react-three/drei'
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Box3, Quaternion, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Part, V3, hubRadius, portsOf, sizeSpec } from './catalog'
import { Model, Xf, portKey } from './geometry'
import { useStore } from './store'
import { formatLength } from './units'

const UP = new Vector3(0, 1, 0)
const PVC = '#ecebe4'
const PVC_FIT = '#dcdcd2'
const SELECTED = '#3fd0c9'

function Seg({ a, b, r, color }: { a: V3; b: V3; r: number; color: string }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new Vector3(...a)
    const vb = new Vector3(...b)
    const d = vb.clone().sub(va)
    return {
      len: d.length(),
      pos: va.clone().add(vb).multiplyScalar(0.5),
      quat: new Quaternion().setFromUnitVectors(UP, d.clone().normalize())
    }
  }, [a[0], a[1], a[2], b[0], b[1], b[2]])
  if (len < 1e-4) return null
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[r, r, len, 40]} />
      <meshStandardMaterial color={color} roughness={0.42} metalness={0.02} />
    </mesh>
  )
}

const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]

function PartBody({ part, color }: { part: Part; color: string }) {
  const ports = portsOf(part)
  if (part.kind === 'pipe') {
    return <Seg a={[0, 0, 0]} b={[0, 0, part.length ?? 0]} r={sizeSpec(part.size).od / 2} color={color} />
  }
  if (part.kind === 'cap') {
    const s = sizeSpec(part.size)
    const hr = hubRadius(part.size)
    return (
      <>
        <Seg a={[0, 0, -s.socket]} b={[0, 0, 0.2 + s.od * 0.05]} r={hr} color={color} />
        <mesh position={[0, 0, 0.2 + s.od * 0.05]} scale={[1, 1, 0.25]}>
          <sphereGeometry args={[hr, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} roughness={0.42} />
        </mesh>
      </>
    )
  }
  const hr = hubRadius(part.size)
  const isCorner = part.kind === 'elbow90' || part.kind === 'elbow45' || part.kind === 'tee' || part.kind === 'cross'
  return (
    <>
      {isCorner && (
        <mesh>
          <sphereGeometry args={[hr, 32, 24]} />
          <meshStandardMaterial color={color} roughness={0.42} />
        </mesh>
      )}
      {ports.map((pt, i) => (
        <Seg key={i} a={[0, 0, 0]} b={add(pt.pos, pt.dir, sizeSpec(pt.size).socket)} r={hubRadius(pt.size)} color={color} />
      ))}
      {part.kind === 'valve' && (
        <>
          <mesh>
            <sphereGeometry args={[hr * 1.35, 32, 24]} />
            <meshStandardMaterial color={color} roughness={0.42} />
          </mesh>
          <Seg a={[0, 0, 0]} b={[0, hr * 1.9, 0]} r={hr * 0.25} color={color} />
          <mesh position={[hr * 1.1, hr * 2.0, 0]}>
            <boxGeometry args={[hr * 3.2, hr * 0.35, hr * 0.7]} />
            <meshStandardMaterial color="#c8352e" roughness={0.5} />
          </mesh>
        </>
      )}
    </>
  )
}

function PartMesh({ part, xf }: { part: Part; xf: Xf }) {
  const selected = useStore((s) => s.selectedId === part.id)
  const select = useStore((s) => s.select)
  const onClick = (e: ThreeEvent<MouseEvent>): void => {
    if (e.delta > 4) return
    e.stopPropagation()
    select(part.id)
  }
  return (
    <group position={xf.pos} quaternion={xf.quat} onClick={onClick}>
      <PartBody part={part} color={selected ? SELECTED : part.kind === 'pipe' ? PVC : PVC_FIT} />
    </group>
  )
}

function PortMarkers({ model, parts }: { model: Model; parts: Part[] }) {
  const active = useStore((s) => s.activePort)
  const selectPort = useStore((s) => s.selectPort)
  const kinds = useMemo(() => new Map(parts.map((p) => [p.id, p.kind])), [parts])
  return (
    <>
      {model.open.map((w) => {
        const isPipe = kinds.get(w.partId) === 'pipe'
        const pos = w.pos.clone().addScaledVector(w.dir, isPipe ? 0 : sizeSpec(w.size).socket)
        const isActive = active && portKey(active.id, active.port) === portKey(w.partId, w.index)
        const r = Math.max(0.28, hubRadius(w.size) * 0.55)
        return (
          <mesh
            key={portKey(w.partId, w.index)}
            position={pos}
            renderOrder={10}
            onClick={(e) => {
              if (e.delta > 4) return
              e.stopPropagation()
              selectPort({ id: w.partId, port: w.index })
            }}
          >
            <sphereGeometry args={[isActive ? r * 1.25 : r, 20, 14]} />
            <meshBasicMaterial color={isActive ? '#f59e0b' : '#4ade80'} depthTest={false} transparent opacity={0.92} />
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

function CameraRig({ model }: { model: Model }) {
  const { camera } = useThree()
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const view = useStore((s) => s.view)
  useEffect(() => {
    if (!controls || view.tick === 0) return
    const box = new Box3()
    model.ports.forEach((w) => box.expandByPoint(w.pos))
    model.xfs.forEach((x) => box.expandByPoint(x.pos))
    if (box.isEmpty()) box.set(new Vector3(-12, -12, -12), new Vector3(12, 12, 12))
    const center = box.getCenter(new Vector3())
    const size = Math.max(box.getSize(new Vector3()).length(), 12)
    const dir = view.dir ? new Vector3(...view.dir).normalize() : camera.position.clone().sub(controls.target).normalize()
    camera.position.copy(center).addScaledVector(dir, size * 1.3 + 10)
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
      camera={{ position: [60, 45, 70], fov: 40, near: 0.1, far: 10000 }}
      dpr={[1, 2]}
      onPointerMissed={(e) => e.button === 0 && select(null)}
    >
      <color attach="background" args={['#1a1e23']} />
      <hemisphereLight args={['#ffffff', '#3a4048', 0.9]} />
      <directionalLight position={[60, 120, 40]} intensity={1.5} />
      <directionalLight position={[-80, 40, -60]} intensity={0.45} />
      <Grid
        position={[0, -8, 0]}
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
      {parts.map((p) => (
        <PartMesh key={p.id} part={p} xf={model.xfs.get(p.id)!} />
      ))}
      <PortMarkers model={model} parts={parts} />
      {showDims && <DimLabels model={model} parts={parts} />}
      <OrbitControls makeDefault enableDamping={false} />
      <CameraRig model={model} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.9} />
      </GizmoHelper>
    </Canvas>
  )
}
