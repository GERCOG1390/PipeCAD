// Снимок текущего вида для листа PDF: картинка + где на ней подписать длины труб
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Color, Vector3 } from 'three'
import { Model } from './geometry'
import { dwvSlopes, slopeLabel } from './slope'
import { useStore } from './store'
import { formatLength } from './units'

export interface Shot {
  img: string // PNG data URL
  w: number
  h: number
  labels: { x: number; y: number; text: string; warn: boolean }[] // x, y — доли ширины/высоты
}

let grab: ((model: Model) => Shot) | null = null

// Внутри Canvas
export function SnapshotHook() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    ;(window as unknown as { pipecadScene: unknown }).pipecadScene = scene // для автотестов
    grab = (model) => {
      // для печати — светлый фон
      const bg = scene.background
      scene.background = new Color('#ffffff')
      const grid = scene.getObjectByName('floor-grid')
      if (grid) grid.visible = false
      gl.render(scene, camera)
      const c = gl.domElement
      const img = c.toDataURL('image/png')
      scene.background = bg
      if (grid) grid.visible = true
      gl.render(scene, camera)
      const parts = useStore.getState().parts
      const slopes = new Map(dwvSlopes(parts, model).map((s) => [s.id, s]))
      const v = new Vector3()
      const labels: Shot['labels'] = []
      for (const p of parts) {
        if (p.kind !== 'pipe') continue
        const xf = model.xfs.get(p.id)
        if (!xf) continue
        v.set(0, 0, (p.length ?? 0) / 2).applyQuaternion(xf.quat).add(xf.pos).project(camera)
        if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue
        const sl = slopes.get(p.id)
        labels.push({
          x: (v.x + 1) / 2,
          y: (1 - v.y) / 2,
          text: formatLength(p.length ?? 0) + (sl ? ` · ${sl.rise < 0.01 ? 'level' : slopeLabel(sl.rise) + '/ft'}` : ''),
          warn: !!sl && !sl.ok
        })
      }
      return { img, w: c.width, h: c.height, labels }
    }
    return () => {
      grab = null
    }
  }, [gl, scene, camera])
  return null
}

// Снять вид без колец концов, выделения и осей; потом вернуть как было
export async function captureView(model: Model): Promise<Shot | null> {
  if (!grab) return null
  const st = useStore.getState()
  const saved = { showPorts: st.showPorts, selectedId: st.selectedId, activePort: st.activePort, showAxes: st.showAxes, selectedEnv: st.selectedEnv }
  useStore.setState({ showPorts: false, selectedId: null, activePort: null, showAxes: false, selectedEnv: null })
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))
  try {
    return grab(model)
  } finally {
    useStore.setState(saved)
  }
}
