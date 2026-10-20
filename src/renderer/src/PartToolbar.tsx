// Панель у выбранной детали прямо в 3D: частые действия рядом с деталью, подробности — справа в «Свойствах»
import { useFrame, useThree } from '@react-three/fiber'
import { FlipHorizontal2, Replace, RotateCcw, RotateCw, Ruler, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Box3, Vector3 } from 'three'
import { FITTINGS, fittingDef, portsOf } from './catalog'
import { useMotion } from './FrameControl'
import { DEL } from './platform'
import { subtreeSize, useStore } from './store'
import { useUi } from './ui'
import { formatLength } from './units'

const EL = 'part-toolbar'

// Внутри Canvas: держит панель над верхом детали
export function PartToolbarAnchor() {
  const selectedId = useStore((s) => s.selectedId)
  const parts = useStore((s) => s.parts)
  const { scene, camera, size } = useThree()
  const top = useMemo(() => new Vector3(), [])
  const v = useMemo(() => new Vector3(), [])
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(false)
    if (!selectedId) return
    const t = setTimeout(() => {
      const g = scene.getObjectByName(`part:${selectedId}`)
      if (!g) return
      const b = new Box3().setFromObject(g)
      if (b.isEmpty()) return
      top.set((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2)
      setReady(true)
    }, 40)
    return () => clearTimeout(t)
  }, [selectedId, parts, scene, top])
  useFrame(() => {
    const el = document.getElementById(EL)
    if (!el) return
    if (!ready || useMotion.getState().moving) {
      el.style.visibility = 'hidden'
      return
    }
    v.copy(top).project(camera)
    const x = ((v.x + 1) / 2) * size.width
    const y = ((1 - v.y) / 2) * size.height
    const off = v.z > 1 || x < 0 || x > size.width || y < 0 || y > size.height
    el.style.visibility = off ? 'hidden' : 'visible'
    // не уезжать за верх окна
    el.style.transform = `translate(-50%, -100%) translate(${Math.round(x)}px, ${Math.round(Math.max(64, y - 18))}px)`
  })
  return null
}

// DOM-панель поверх вьюпорта
export function PartToolbar() {
  const selectedId = useStore((s) => s.selectedId)
  const part = useStore((s) => s.parts.find((p) => p.id === selectedId))
  const parts = useStore((s) => s.parts)
  const placing = useStore((s) => !!s.placing)
  const replaying = useStore((s) => !!s.replay)
  const editing = useStore((s) => !!s.lengthEdit && s.lengthEdit.id === selectedId)
  if (!part || placing || replaying || editing) return null
  const st = useStore.getState()
  const def = fittingDef(part.kind)
  const pipe = part.kind === 'pipe'
  const sub = subtreeSize(parts, part.id)
  const ports = portsOf(part)
  const canFlip = !!part.parent && (ports.length > 2 || !!def.size2?.reversible)
  // есть ли чем заменить (та же проверка — в «Свойствах»)
  const canReplace = !pipe && !def.place?.always && Object.keys(FITTINGS).some((k) => k !== part.kind && FITTINGS[k].sizes.includes(part.size) && FITTINGS[k].group === def.group)
  return (
    <div id={EL} className="part-toolbar" onPointerDown={(e) => e.stopPropagation()}>
      {pipe && (
        <button className="pt-len" onClick={() => useStore.setState({ lengthEdit: { id: part.id, n: Date.now() } })} title="Change length (or just type digits)">
          <Ruler size={15} /> {formatLength(part.length ?? 0)}
        </button>
      )}
      <button onClick={() => st.rollPart(part.id, -90)} title="Rotate −90° (Shift+R)">
        <RotateCcw size={16} />
      </button>
      <button onClick={() => st.rollPart(part.id, 90)} title="Rotate +90° (R)">
        <RotateCw size={16} />
      </button>
      {canFlip && (
        <button onClick={() => st.cycleAttach(part.id)} title={def.size2?.reversible ? 'Flip (reduce ↔ increase)' : 'Connect by another end'}>
          <FlipHorizontal2 size={16} />
        </button>
      )}
      {canReplace && (
        <button onClick={() => useUi.getState().askReplace()} title="Replace with another part, keeping connections">
          <Replace size={16} /> Replace
        </button>
      )}
      <button onClick={() => useUi.getState().setSideTab('props')} title="All properties">
        <SlidersHorizontal size={16} />
      </button>
      <span className="pt-sep" />
      <button className="pt-del" onClick={() => st.deletePart(part.id)} title={`Delete this part (${DEL}); Shift+${DEL} also removes the ${sub - 1} part(s) after it`}>
        <Trash2 size={16} />
      </button>
    </div>
  )
}
