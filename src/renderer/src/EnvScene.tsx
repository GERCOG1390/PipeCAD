import { TransformControls } from '@react-three/drei'
import { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Group, Material, Matrix4, Mesh, Object3D, Path, Quaternion, Shape, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Part, V3, basinDims, sizeSpec } from './catalog'
import { Board, EnvItem, Mat, Penetration, boardsOf, findPenetrations, itemMatrix } from './environment'
import { Model } from './geometry'
import { busyPlacing } from './Scene'
import { useStore } from './store'
import { EnvLook, TILE, envMaterial } from './textures'

// Коробка с UV по мировым координатам: текстура непрерывна между досками, волокна — вдоль длинной стороны
function boxGeo(b: Board, grain: boolean): BufferGeometry {
  const g = new BoxGeometry(...b.s)
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const uv = g.attributes.uv
  const tile = TILE[b.mat]
  for (let i = 0; i < pos.count; i++) {
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))]
    const k = n.indexOf(Math.max(...n))
    let [ua, va] = [0, 1, 2].filter((x) => x !== k)
    if (grain && b.s[va] > b.s[ua]) [ua, va] = [va, ua]
    const p = [pos.getX(i) + b.c[0], pos.getY(i) + b.c[1], pos.getZ(i) + b.c[2]]
    uv.setXY(i, p[ua] / tile, p[va] / tile)
  }
  g.translate(...b.c)
  return g
}

// Отверстие под приямок в локальных осях объекта: центр x/z, радиус, диапазон высот
interface Hole {
  x: number
  z: number
  r: number
  y0: number
  y1: number
}

// UV по мировым координатам для произвольной геометрии (проекция по главной оси нормали)
function worldUV(g: BufferGeometry, tile: number): void {
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))]
    const k = n.indexOf(Math.max(...n))
    const [ua, va] = [0, 1, 2].filter((x) => x !== k)
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)]
    uv.setXY(i, p[ua] / tile, p[va] / tile)
  }
}

// Плита/грунт с круглыми вырезами: прямоугольник в плане, выдавленный по высоте
function holedGeo(b: Board, holes: Hole[]): BufferGeometry | null {
  const [cx, cy, cz] = b.c
  const [sx, sy, sz] = b.s
  const inside = holes.filter((h) => h.y0 < cy + sy / 2 && h.y1 > cy - sy / 2 && h.x - h.r > cx - sx / 2 && h.x + h.r < cx + sx / 2 && h.z - h.r > cz - sz / 2 && h.z + h.r < cz + sz / 2)
  if (!inside.length) return null
  // контур в плоскости XY формы: y формы = −z объекта (после поворота выдавливание идёт по +Y)
  const sh = new Shape()
  sh.moveTo(cx - sx / 2, -(cz + sz / 2))
  sh.lineTo(cx + sx / 2, -(cz + sz / 2))
  sh.lineTo(cx + sx / 2, -(cz - sz / 2))
  sh.lineTo(cx - sx / 2, -(cz - sz / 2))
  sh.closePath()
  for (const h of inside) {
    const p = new Path()
    p.absarc(h.x, -h.z, h.r, 0, Math.PI * 2, true)
    sh.holes.push(p)
  }
  const g = new ExtrudeGeometry(sh, { depth: sy, bevelEnabled: false, curveSegments: 64 })
  g.rotateX(-Math.PI / 2)
  g.translate(0, cy - sy / 2, 0)
  worldUV(g, TILE[b.mat])
  return g
}

interface ItemGeo {
  merged: { mat: Mat; geom: BufferGeometry }[]
  ground: { geom: BufferGeometry; side: Mat; top: Mat; cut: boolean }[]
}

function buildItemGeo(it: EnvItem, holes: Hole[]): ItemGeo {
  const boards = boardsOf(it)
  const byMat = new Map<Mat, BufferGeometry[]>()
  const ground: ItemGeo['ground'] = []
  for (const b of boards) {
    const cut = b.role === 'concrete' || b.role === 'ground' ? holedGeo(b, holes) : null
    if (b.top) {
      // у выдавленной геометрии группы: 0 — верх/низ, 1 — стенки
      ground.push({ geom: cut ?? boxGeo(b, false), side: b.mat, top: b.top, cut: !!cut })
      continue
    }
    const arr = byMat.get(b.mat) ?? []
    arr.push(cut ?? boxGeo(b, b.mat === 'wood' || b.mat === 'plywood'))
    byMat.set(b.mat, arr)
  }
  const merged = [...byMat.entries()].map(([mat, gs]) => {
    const geom = gs.length === 1 ? gs[0] : mergeGeometries(gs)!
    if (gs.length > 1) gs.forEach((g) => g.dispose())
    return { mat, geom }
  })
  return { merged, ground }
}

function EnvMesh({ it, holes, look, selected, onPick }: { it: EnvItem; holes: Hole[]; look: EnvLook; selected: boolean; onPick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const holeKey = JSON.stringify(holes)
  const geo = useMemo(() => buildItemGeo(it, holes), [it.type, it.L, it.W, it.H, JSON.stringify(it.o), holeKey])
  useEffect(() => () => [...geo.merged, ...geo.ground].forEach((g) => g.geom.dispose()), [geo])
  const noRaycast = look === 'ghost' ? () => null : undefined
  return (
    <>
      {geo.merged.map((m) => (
        <mesh key={m.mat} geometry={m.geom} material={envMaterial(m.mat, look, selected)} onClick={onPick} raycast={noRaycast} />
      ))}
      {geo.ground.map((g, i) => {
        const side = envMaterial(g.side, look, selected)
        const top = envMaterial(g.top, look, selected)
        // порядок граней BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
        const mats: Material[] = g.cut ? [top, side] : [side, side, top, side, side, side]
        return <mesh key={i} geometry={g.geom} material={mats} onClick={onPick} raycast={noRaycast} />
      })}
    </>
  )
}

function EnvObject({ it, holes }: { it: EnvItem; holes: WorldHole[] }) {
  const look = useStore((s) => (s.envMode === 'ghost' ? 'ghost' : 'solid')) as EnvLook
  const selected = useStore((s) => s.selectedEnv === it.id)
  const selectEnv = useStore((s) => s.selectEnv)
  const snap = useStore((s) => s.snap)
  const [obj, setObj] = useState<Group | null>(null)
  const onPick = (e: ThreeEvent<MouseEvent>): void => {
    if (e.delta > 4 || busyPlacing()) return
    e.stopPropagation()
    selectEnv(it.id)
  }
  return (
    <>
      <group ref={setObj} position={it.pos} rotation={[0, (it.rotY * Math.PI) / 180, 0]}>
        <EnvMesh it={it} holes={holesFor(it, holes)} look={look} selected={selected} onPick={look === 'ghost' ? undefined : onPick} />
      </group>
      {selected && obj && <Mover object={obj} snap={snap} onMove={(p) => moveEnv(it.id, p)} />}
    </>
  )
}

function moveEnv(id: string, p: V3): void {
  const s = useStore.getState()
  s.dragTo({ env: s.env.map((e) => (e.id === id ? { ...e, pos: p } : e)) })
}

// Гизмо перемещения: стрелки по осям, с привязкой к шагу
function Mover({ object, snap, onMove }: { object: Object3D; snap: number; onMove: (p: V3) => void }) {
  const beginDrag = useStore((s) => s.beginDrag)
  const endDrag = useStore((s) => s.endDrag)
  return (
    <TransformControls
      object={object}
      mode="translate"
      translationSnap={snap}
      size={0.8}
      onMouseDown={beginDrag}
      onMouseUp={endDrag}
      onObjectChange={() => {
        const p = object.position
        onMove([p.x, p.y, p.z])
      }}
    />
  )
}

// Гизмо для всей системы труб (корневая деталь)
function SystemMover({ root }: { root: Part }) {
  const snap = useStore((s) => s.snap)
  const [obj, setObj] = useState<Group | null>(null)
  const pos = root.pos ?? [0, 0, 0]
  return (
    <>
      <group ref={setObj} position={pos} />
      {obj && (
        <Mover
          object={obj}
          snap={snap}
          onMove={(p) => {
            const s = useStore.getState()
            s.dragTo({ parts: s.parts.map((x) => (x.id === root.id ? { ...x, pos: p } : x)) })
          }}
        />
      )}
    </>
  )
}

export function pipeSegments(parts: Part[], model: Model): { a: Vector3; b: Vector3; r: number }[] {
  return parts
    .filter((p) => p.kind === 'pipe')
    .map((p) => {
      const xf = model.xfs.get(p.id)!
      const b = new Vector3(0, 0, p.length ?? 0).applyQuaternion(xf.quat).add(xf.pos)
      return { a: xf.pos.clone(), b, r: sizeSpec(p.size).od / 2 }
    })
}

export function usePenetrations(model: Model): Penetration[] {
  const parts = useStore((s) => s.parts)
  const env = useStore((s) => s.env)
  return useMemo(() => (env.length ? findPenetrations(env, pipeSegments(parts, model)) : []), [env, parts, model])
}

function PenetrationMarks({ list }: { list: Penetration[] }) {
  return (
    <>
      {list.map((p, i) => (
        <mesh key={i} position={p.point} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), p.dir)} renderOrder={12}>
          <torusGeometry args={[p.radius + 0.35, Math.max(0.08, p.radius * 0.08), 10, 40]} />
          <meshBasicMaterial color={p.ok ? '#f59e0b' : '#ef4444'} depthTest={false} transparent opacity={0.95} />
        </mesh>
      ))}
    </>
  )
}

// Приямки в мировых координатах: центр, радиус выреза (по фланцу), высоты
interface WorldHole {
  p: Vector3
  r: number
  y0: number
  y1: number
}
function holesFor(it: EnvItem, list: WorldHole[]): Hole[] {
  if (!list.length || !(it.type === 'slab' || it.type === 'ground' || it.type === 'footing')) return []
  const inv = new Matrix4().copy(itemMatrix(it)).invert()
  return list.map((h) => {
    const l = h.p.clone().applyMatrix4(inv)
    return { x: Math.round(l.x * 100) / 100, z: Math.round(l.z * 100) / 100, r: h.r, y0: h.y0 - it.pos[1], y1: h.y1 - it.pos[1] }
  })
}

export function EnvLayer({ model }: { model: Model }) {
  const env = useStore((s) => s.env)
  const mode = useStore((s) => s.envMode)
  const parts = useStore((s) => s.parts)
  const selectedId = useStore((s) => s.selectedId)
  const pens = usePenetrations(model)
  const moveSystem = useStore((s) => s.moveSystem)
  const sel = parts.find((p) => p.id === selectedId)
  const holes = useMemo(() => {
    const out: WorldHole[] = []
    for (const p of parts) {
      const d = basinDims(p.kind)
      const xf = model.xfs.get(p.id)
      if (d && xf) out.push({ p: xf.pos.clone(), r: d.r + 1.9, y0: xf.pos.y, y1: xf.pos.y + d.H + 0.1 })
    }
    return out
  }, [parts, model])
  const byId = new Map(parts.map((p) => [p.id, p]))
  let root = moveSystem ? sel : undefined
  while (root?.parent && byId.get(root.parent.id)) root = byId.get(root.parent.id)
  return (
    <>
      <group name="env">{mode !== 'hidden' && env.map((it) => <EnvObject key={it.id} it={it} holes={holes} />)}</group>
      {mode !== 'hidden' && <PenetrationMarks list={pens} />}
      {root && <SystemMover root={root} />}
    </>
  )
}

export type { Mesh }
