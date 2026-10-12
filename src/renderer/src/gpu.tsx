// Графический API: WebGL (через ANGLE → DirectX 11) или экспериментальный WebGPU (Dawn → DirectX 12).
// Здесь всё, что в двух режимах делается по-разному: создание рендерера, отражения, сетка пола, пунктирные линии, замер.
import { Grid, Line } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute, LineBasicMaterial, LineDashedMaterial, Line as ThreeLine, PMREMGenerator, Vector3, WebGLRenderer } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { create } from 'zustand'
import { useViewPrefs } from './viewPrefs'
import { isMac } from './platform'

// Какой бэкенд реально заработал (WebGPU может откатиться на WebGL2, если драйвер не даёт)
export const useBackend = create<{ label: string; set: (label: string) => void }>((set) => ({ label: '', set: (label) => set({ label }) }))

export const isWebGPU = (): boolean => useViewPrefs.getState().graphics === 'webgpu'

// Фон: в WebGPU фон сцены проходит тональную коррекцию и темнеет — там задаём его цветом очистки экрана
export function applyBackground(gl: unknown, scene: { background: unknown }, hex: string): void {
  if (gl instanceof WebGLRenderer) {
    scene.background = new Color(hex)
    return
  }
  // цвет очистки WebGPU пересчитывается по-своему — делаем холст прозрачным, а фон задаёт страница (цвет точный)
  scene.background = null
  const g = gl as { setClearColor: (c: Color, a?: number) => void; domElement: HTMLCanvasElement }
  g.setClearColor(new Color(0, 0, 0), 0)
  // белый — это снимок для PDF: там нужен прозрачный фон, а цвет страницы трогать не надо
  if (hex !== '#ffffff') g.domElement.style.background = hex
}

// Фабрика рендерера для <Canvas gl={...}>
export function rendererFactory(graphics: 'webgl' | 'webgpu') {
  return async (props: { canvas: HTMLCanvasElement | OffscreenCanvas }): Promise<unknown> => {
    if (graphics === 'webgpu') {
      const { WebGPURenderer } = await import('three/webgpu')
      const r = new WebGPURenderer({ canvas: props.canvas as HTMLCanvasElement, antialias: true, alpha: true, powerPreference: 'high-performance' })
      await r.init()
      r.toneMappingExposure = 0.95
      // drei (компас осей) спрашивает анизотропию у WebGL-рендерера — даём совместимый ответ
      const rr = r as unknown as { capabilities?: unknown; getMaxAnisotropy?: () => number }
      if (!rr.capabilities) rr.capabilities = { getMaxAnisotropy: () => rr.getMaxAnisotropy?.() ?? 16, isWebGL2: true, logarithmicDepthBuffer: false }
      const be = (r as unknown as { backend: { isWebGPUBackend?: boolean } }).backend
      useBackend.getState().set(be?.isWebGPUBackend ? `WebGPU (${isMac ? 'Metal' : 'DirectX 12'})` : 'WebGPU unavailable — fell back to WebGL 2')
      return r
    }
    const r = new WebGLRenderer({ canvas: props.canvas as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' })
    r.toneMappingExposure = 0.95
    useBackend.getState().set(`WebGL (${isMac ? 'Metal' : 'DirectX 11'})`)
    return r
  }
}

// Мягкое окружение для отражений на пластике (без загрузки HDR из сети)
export function EnvSetup() {
  const { gl, scene } = useThree()
  const camera = useThree((st) => st.camera)
  // для автотестов: проекция точек на экран
  ;(window as unknown as { pipecadCamera: typeof camera }).pipecadCamera = camera
  useEffect(() => {
    let disposed = false
    let cleanup = (): void => undefined
    void (async () => {
      const webgpu = !(gl instanceof WebGLRenderer)
      const Gen = webgpu ? (await import('three/webgpu')).PMREMGenerator : PMREMGenerator
      if (disposed) return
      const pmrem = new Gen(gl as never)
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      scene.environment = env
      scene.environmentIntensity = 0.45
      cleanup = () => {
        scene.environment = null
        env.dispose()
        pmrem.dispose()
      }
    })()
    return () => {
      disposed = true
      cleanup()
    }
  }, [gl, scene])
  return null
}

// Сетка пола: в WebGL — шейдерная бесконечная сетка drei, в WebGPU — обычные линии
export function FloorGrid({ cell, section }: { cell: string; section: string }) {
  const webgpu = useViewPrefs((s) => s.graphics) === 'webgpu'
  const lines = useMemo(() => {
    if (!webgpu) return null
    const ext = 720
    const mk = (step: number): BufferGeometry => {
      const pts: number[] = []
      for (let v = -ext; v <= ext; v += step) pts.push(-ext, 0, v, ext, 0, v, v, 0, -ext, v, 0, ext)
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(pts, 3))
      return g
    }
    return { cell: mk(12), section: mk(60) }
  }, [webgpu])
  useEffect(() => () => {
    lines?.cell.dispose()
    lines?.section.dispose()
  }, [lines])
  if (!webgpu || !lines) {
    return <Grid name="floor-grid" position={[0, -0.02, 0]} infiniteGrid cellSize={12} sectionSize={60} cellThickness={0.6} sectionThickness={1} cellColor={cell} sectionColor={section} fadeDistance={900} fadeStrength={1.5} />
  }
  return (
    <group name="floor-grid" position={[0, -0.02, 0]}>
      <lineSegments geometry={lines.cell}>
        <lineBasicMaterial color={cell} transparent opacity={0.35} />
      </lineSegments>
      <lineSegments geometry={lines.section}>
        <lineBasicMaterial color={section} transparent opacity={0.55} />
      </lineSegments>
    </group>
  )
}

// Пунктирная линия осей: в WebGL — толстая линия drei, в WebGPU — обычная пунктирная (толщина 1 px)
export function GuideLine({ points, color, lineWidth, dashSize, gapSize, opacity = 1, renderOrder }: { points: Vector3[]; color: string; lineWidth: number; dashSize: number; gapSize: number; opacity?: number; renderOrder?: number }) {
  const webgpu = useViewPrefs((s) => s.graphics) === 'webgpu'
  const obj = useMemo(() => {
    if (!webgpu) return null
    const g = new BufferGeometry().setFromPoints(points)
    const m = new LineDashedMaterial({ color, dashSize, gapSize, transparent: true, opacity, depthTest: false })
    const l = new ThreeLine(g, m)
    l.computeLineDistances()
    l.renderOrder = renderOrder ?? 0
    return l
  }, [webgpu, points[0].x, points[0].y, points[0].z, points[1].x, points[1].y, points[1].z, color, dashSize, gapSize, opacity, renderOrder])
  useEffect(() => () => {
    obj?.geometry.dispose()
    ;(obj?.material as LineBasicMaterial | undefined)?.dispose()
  }, [obj])
  if (obj) return <primitive object={obj} />
  return <Line points={points} color={color} lineWidth={lineWidth} dashed dashSize={dashSize} gapSize={gapSize} transparent opacity={opacity} depthTest={false} renderOrder={renderOrder} />
}

// Замер полной стоимости кадра: N отрисовок подряд с ожиданием готовности на видеокарте
export function BenchHook() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    ;(window as unknown as { pipecadBench: (n: number) => Promise<number> }).pipecadBench = async (n) => {
      const webgpu = !(gl instanceof WebGLRenderer)
      const r = gl as unknown as { render: (s: unknown, c: unknown) => void; backend?: { device?: GPUDevice } }
      // разогрев
      r.render(scene, camera)
      const t0 = performance.now()
      for (let i = 0; i < n; i++) r.render(scene, camera)
      if (webgpu && r.backend?.device) await r.backend.device.queue.onSubmittedWorkDone()
      else {
        const ctx = (gl as WebGLRenderer).getContext()
        ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, new Uint8Array(4))
      }
      return (performance.now() - t0) / n
    }
  }, [gl, scene, camera])
  return null
}
