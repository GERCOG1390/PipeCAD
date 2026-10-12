// Качество картинки: суперсэмплинг, SMAA, ambient occlusion и контактные тени — по выбранному уровню
import { ContactShadows } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { ReactElement, useEffect, useMemo, useRef } from 'react'
import { setComposer } from './Snapshot'
import { useStore } from './store'
import { useMotion } from './FrameControl'
import { Quality, useViewPrefs } from './viewPrefs'

// Во сколько раз рендерим больше пикселей, чем у экрана (сглаживание краёв и тонких линий)
export const QUALITY: Record<Quality, { scale: number; msaa: number; ao: false | 'half' | 'full'; smaa: boolean; shadows: boolean; label: string; hint: string }> = {
  fast: { scale: 1, msaa: 0, ao: false, smaa: false, shadows: false, label: 'Fast', hint: 'Weak laptop or very big project' },
  balanced: { scale: 1.5, msaa: 4, ao: 'half', smaa: true, shadows: false, label: 'Balanced', hint: 'Smooth edges + soft shading in joints' },
  high: { scale: 2, msaa: 4, ao: 'full', smaa: true, shadows: true, label: 'High', hint: '2× supersampling, ambient occlusion, floor shadows' },
  ultra: { scale: 3, msaa: 8, ao: 'full', smaa: true, shadows: true, label: 'Ultra', hint: 'For screenshots, PDF and video — needs a good GPU' }
}

// Плотность пикселей канваса под уровень качества
// Пока камеру вращают — без суперсэмплинга (плавность), после остановки — полное разрешение
export function useQualityDpr(): number {
  const q = useViewPrefs((s) => s.quality)
  const moving = useMotion((s) => s.moving)
  const base = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return Math.min(3, base * (moving ? Math.min(1, QUALITY[q].scale) : QUALITY[q].scale))
}

export function Effects() {
  const q = QUALITY[useViewPrefs((s) => s.quality)]
  const moving = useMotion((s) => s.moving)
  const dpr = useQualityDpr()
  const setDpr = useThree((s) => s.setDpr)
  useEffect(() => setDpr(dpr), [dpr, setDpr])
  // тень на полу считаем один раз после каждого изменения модели или окружения, а не каждый кадр
  const parts = useStore((s) => s.parts)
  const env = useStore((s) => s.env)
  const ver = useRef(0)
  const shadowKey = useMemo(() => ++ver.current, [parts, env])
  return (
    <>
      {q.shadows && <ContactShadows key={shadowKey} frames={1} position={[0, -0.01, 0]} scale={1200} far={120} blur={2.4} opacity={0.45} resolution={1024} color="#000000" />}
      {(q.ao || q.smaa) && !moving && (
        <EffectComposer ref={setComposer} multisampling={q.msaa} enableNormalPass={false}>
          {[
            q.ao ? <N8AO key="ao" aoRadius={4} distanceFalloff={1.5} intensity={2.2} halfRes={q.ao === 'half'} quality={q.ao === 'half' ? 'medium' : 'high'} /> : null,
            q.smaa ? <SMAA key="smaa" /> : null,
            <ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />
          ].filter((x): x is ReactElement => !!x)}
        </EffectComposer>
      )}
    </>
  )
}
