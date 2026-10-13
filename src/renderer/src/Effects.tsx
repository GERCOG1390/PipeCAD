// Качество картинки: только сглаживание (рендер в повышенном разрешении + MSAA). Теней и затенения нет — программа рабочая.
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { useMotion } from './FrameControl'
import { usePower } from './power'
import { Quality, useViewPrefs } from './viewPrefs'

// Во сколько раз рендерим больше пикселей, чем у экрана (сглаживание краёв и тонких линий)
type QualityDef = Record<Quality, { scale: number; label: string; hint: string }>
export const QUALITY: QualityDef = {
  fast: { scale: 1, label: 'Fast', hint: 'Screen resolution — weak laptop or very big project' },
  balanced: { scale: 1.5, label: 'Balanced', hint: '1.5× supersampling — smoother edges' },
  high: { scale: 2, label: 'High', hint: '2× supersampling — clean edges and thin lines' },
  ultra: { scale: 3, label: 'Ultra', hint: '3× supersampling — for screenshots, PDF and video' }
}

// Retina (плотность 2 и выше): экран и так чёткий, а суперсэмплинг поверх него только тратит видеокарту и батарею.
// Здесь масштаб — от родного разрешения экрана; края сглаживает MSAA, который на видеокартах Apple почти бесплатен.
export const QUALITY_HIDPI: QualityDef = {
  fast: { scale: 0.5, label: 'Fast', hint: 'Half the Retina resolution — longest battery, very big projects' },
  balanced: { scale: 0.75, label: 'Balanced', hint: '3/4 of the Retina resolution' },
  high: { scale: 1, label: 'High', hint: 'Native Retina resolution with MSAA — sharp, nothing extra to draw' },
  ultra: { scale: 1.5, label: 'Ultra', hint: '1.5× the Retina resolution — for screenshots and PDF' }
}

const screenDpr = (): number => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
export const isHiDpi = (): boolean => screenDpr() >= 2
export const qualityDefs = (): QualityDef => (isHiDpi() ? QUALITY_HIDPI : QUALITY)

// Пока камеру вращают или компьютер на батарее (если включена экономия) — без суперсэмплинга;
// после остановки и от сети — полное разрешение выбранного режима
export function useQualityDpr(): number {
  const q = useViewPrefs((s) => s.quality)
  const moving = useMotion((s) => s.moving)
  const saving = usePower((s) => s.saving)
  const scale = qualityDefs()[q].scale
  return Math.min(3, screenDpr() * (moving || saving ? Math.min(1, scale) : scale))
}

export function Effects() {
  const dpr = useQualityDpr()
  const setDpr = useThree((s) => s.setDpr)
  useEffect(() => setDpr(dpr), [dpr, setDpr])
  return null
}
