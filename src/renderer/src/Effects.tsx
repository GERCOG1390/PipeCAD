// Качество картинки: только сглаживание (рендер в повышенном разрешении + MSAA). Теней и затенения нет — программа рабочая.
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { useMotion } from './FrameControl'
import { Quality, useViewPrefs } from './viewPrefs'

// Во сколько раз рендерим больше пикселей, чем у экрана (сглаживание краёв и тонких линий)
export const QUALITY: Record<Quality, { scale: number; label: string; hint: string }> = {
  fast: { scale: 1, label: 'Fast', hint: 'Screen resolution — weak laptop or very big project' },
  balanced: { scale: 1.5, label: 'Balanced', hint: '1.5× supersampling — smoother edges' },
  high: { scale: 2, label: 'High', hint: '2× supersampling — clean edges and thin lines' },
  ultra: { scale: 3, label: 'Ultra', hint: '3× supersampling — for screenshots, PDF and video' }
}

// Пока камеру вращают — без суперсэмплинга (плавность), после остановки — полное разрешение
export function useQualityDpr(): number {
  const q = useViewPrefs((s) => s.quality)
  const moving = useMotion((s) => s.moving)
  const base = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return Math.min(3, base * (moving ? Math.min(1, QUALITY[q].scale) : QUALITY[q].scale))
}

export function Effects() {
  const dpr = useQualityDpr()
  const setDpr = useThree((s) => s.setDpr)
  useEffect(() => setDpr(dpr), [dpr, setDpr])
  return null
}
