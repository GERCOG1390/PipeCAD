// Экономия видеокарты: кадры рисуются только когда что-то меняется,
// а пока камеру вращают — облегчённая картинка; после остановки дорисовывается полное качество.
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector3 } from 'three'
import { create } from 'zustand'
import { useStore } from './store'
import { useViewPrefs } from './viewPrefs'

interface Motion {
  moving: boolean
  setMoving: (v: boolean) => void
}
export const useMotion = create<Motion>((set) => ({ moving: false, setMoving: (moving) => set({ moving }) }))

const SETTLE_MS = 220 // сколько ждём после последнего движения, прежде чем включить полное качество
const KEEP_MS = 500 // сколько кадров дорисовываем после любого события

export function FrameControl() {
  const invalidate = useThree((s) => s.invalidate)
  const el = useThree((s) => s.gl.domElement)
  useEffect(() => {
    let until = 0
    let settle: ReturnType<typeof setTimeout> | null = null
    let down = false
    const kick = (): void => {
      until = performance.now() + KEEP_MS
      invalidate()
    }
    const motion = (): void => {
      if (!useMotion.getState().moving) useMotion.getState().setMoving(true)
      if (settle) clearTimeout(settle)
      settle = setTimeout(() => {
        useMotion.getState().setMoving(false)
        kick()
      }, SETTLE_MS)
      kick()
    }
    const onDown = (): void => {
      down = true
      kick()
    }
    const onUp = (): void => {
      down = false
      kick()
    }
    const onMove = (): void => (down ? motion() : kick())
    const loop = (): void => {
      if (performance.now() < until) invalidate()
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('wheel', motion, { passive: true })
    window.addEventListener('keydown', kick)
    window.addEventListener('resize', kick)
    const unsub1 = useStore.subscribe(kick)
    const unsub2 = useViewPrefs.subscribe(kick)
    const unsub3 = useMotion.subscribe(kick)
    ;(window as unknown as { __pipecadLoop: () => void }).__pipecadLoop = loop
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('wheel', motion)
      window.removeEventListener('keydown', kick)
      window.removeEventListener('resize', kick)
      unsub1()
      unsub2()
      unsub3()
      if (settle) clearTimeout(settle)
    }
  }, [el, invalidate])
  // пока окно «разогрето» событием — продолжаем рисовать (анимации, оверлеи, подсказки)
  useFrame(() => (window as unknown as { __pipecadLoop?: () => void }).__pipecadLoop?.())
  // Точность глубины: ближняя граница камеры растёт с расстоянием до модели.
  // Иначе вдали тонкие слои (наклейки на корпусе в сотых дюйма) мерцают полосками (z-fighting).
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target?: Vector3 } | null
  useFrame(() => {
    const target = controls?.target
    if (!target) return
    const d = camera.position.distanceTo(target)
    const near = Math.min(20, Math.max(0.05, d * 0.004))
    const far = Math.max(10000, d * 40)
    const cam = camera as unknown as { near: number; far: number; updateProjectionMatrix: () => void }
    if (Math.abs(cam.near - near) / near > 0.05 || cam.far !== far) {
      cam.near = near
      cam.far = far
      cam.updateProjectionMatrix()
    }
  })
  return null
}

// Повтор постройки и запись видео требуют непрерывных кадров
export function useAlwaysRender(): boolean {
  return useStore((s) => (!!s.replay && s.replay.playing) || s.recording > 0)
}
