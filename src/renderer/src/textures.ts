// Процедурные текстуры стройматериалов (рисуются на canvas, без загрузки из сети)
import { CanvasTexture, DoubleSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'
import type { Mat } from './environment'

// Детерминированный генератор, чтобы текстуры не менялись между запусками
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const SIZE = 512

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas')
  cv.width = SIZE
  cv.height = SIZE
  return [cv, cv.getContext('2d')!]
}

function noise(ctx: CanvasRenderingContext2D, r: () => number, n: number, colors: string[], min: number, max: number, alpha = 1): void {
  ctx.globalAlpha = alpha
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)]
    const s = min + r() * (max - min)
    ctx.fillRect(r() * SIZE, r() * SIZE, s, s)
  }
  ctx.globalAlpha = 1
}

function blotches(ctx: CanvasRenderingContext2D, r: () => number, n: number, color: string, rmin: number, rmax: number, alpha: number): void {
  for (let i = 0; i < n; i++) {
    const x = r() * SIZE
    const y = r() * SIZE
    const rad = rmin + r() * (rmax - rmin)
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = alpha
    ctx.fillStyle = g
    // рисуем со сдвигами, чтобы текстура бесшовно повторялась
    for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) ctx.fillRect(x - rad + dx, y - rad + dy, rad * 2, rad * 2)
  }
  ctx.globalAlpha = 1
}

// Волокна древесины идут вдоль оси U (горизонтально на canvas)
function woodGrain(ctx: CanvasRenderingContext2D, r: () => number, base: string, line: string, lines: number, knots: number): void {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, SIZE, SIZE)
  blotches(ctx, r, 10, 'rgba(160,110,50,0.5)', 60, 160, 0.25)
  for (let i = 0; i < lines; i++) {
    const y0 = r() * SIZE
    const amp = 2 + r() * 6
    const ph = r() * Math.PI * 2
    ctx.strokeStyle = line
    ctx.globalAlpha = 0.12 + r() * 0.25
    ctx.lineWidth = 0.6 + r() * 1.6
    ctx.beginPath()
    for (let x = 0; x <= SIZE; x += 8) {
      const y = y0 + Math.sin((x / SIZE) * Math.PI * 2 + ph) * amp
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  for (let i = 0; i < knots; i++) {
    const x = r() * SIZE
    const y = r() * SIZE
    const g = ctx.createRadialGradient(x, y, 1, x, y, 10 + r() * 8)
    g.addColorStop(0, 'rgba(90,55,20,0.9)')
    g.addColorStop(0.5, 'rgba(120,75,30,0.5)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(x, y, 24, 9, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function draw(mat: Mat): HTMLCanvasElement {
  const [cv, ctx] = canvas()
  const r = rng(mat.length * 7919 + mat.charCodeAt(0) * 31)
  switch (mat) {
    case 'concrete':
      ctx.fillStyle = '#9b9b96'
      ctx.fillRect(0, 0, SIZE, SIZE)
      blotches(ctx, r, 120, 'rgba(125,125,120,1)', 15, 60, 0.12)
      blotches(ctx, r, 90, 'rgba(170,170,165,1)', 15, 50, 0.1)
      noise(ctx, r, 9000, ['#8a8a85', '#b0b0aa', '#7d7d78', '#c2c2bc'], 1, 2.5, 0.55)
      noise(ctx, r, 160, ['#55554f', '#606059'], 1.5, 3.5, 0.7)
      break
    case 'wood':
      woodGrain(ctx, r, '#d9b77c', '#8a5a2b', 70, 2)
      break
    case 'plywood':
      woodGrain(ctx, r, '#dcc08a', '#a06f3a', 40, 1)
      blotches(ctx, r, 6, 'rgba(190,140,80,1)', 80, 200, 0.15)
      break
    case 'osb':
      ctx.fillStyle = '#c7a066'
      ctx.fillRect(0, 0, SIZE, SIZE)
      for (let i = 0; i < 1400; i++) {
        const w = 18 + r() * 40
        const h = 5 + r() * 12
        ctx.save()
        ctx.translate(r() * SIZE, r() * SIZE)
        ctx.rotate((r() - 0.5) * 1.2)
        const tone = 140 + Math.floor(r() * 80)
        ctx.fillStyle = `rgba(${tone + 40},${tone},${Math.floor(tone * 0.55)},0.65)`
        ctx.fillRect(-w / 2, -h / 2, w, h)
        ctx.restore()
      }
      break
    case 'drywall':
      ctx.fillStyle = '#e6e3dc'
      ctx.fillRect(0, 0, SIZE, SIZE)
      noise(ctx, r, 6000, ['#dedad2', '#ece9e3'], 1, 2, 0.5)
      break
    case 'dirt':
      ctx.fillStyle = '#6a4d32'
      ctx.fillRect(0, 0, SIZE, SIZE)
      blotches(ctx, r, 120, 'rgba(85,60,38,1)', 12, 50, 0.22)
      blotches(ctx, r, 80, 'rgba(130,98,66,1)', 12, 40, 0.18)
      noise(ctx, r, 9000, ['#5a4029', '#7a5a3b', '#4d3522', '#8a6a48'], 1, 3, 0.6)
      noise(ctx, r, 260, ['#9a8a78', '#7d7468', '#6c665e'], 2, 5, 0.85)
      break
    case 'grass': {
      ctx.fillStyle = '#4a7a2c'
      ctx.fillRect(0, 0, SIZE, SIZE)
      blotches(ctx, r, 120, 'rgba(60,100,35,1)', 12, 50, 0.2)
      blotches(ctx, r, 80, 'rgba(110,140,50,1)', 12, 40, 0.15)
      const greens = ['#3f6d24', '#5b8f33', '#6fa53d', '#34581d', '#7cb246', '#4e7f2b']
      for (let i = 0; i < 9000; i++) {
        const x = r() * SIZE
        const y = r() * SIZE
        const len = 4 + r() * 9
        const ang = -Math.PI / 2 + (r() - 0.5) * 0.9
        ctx.strokeStyle = greens[Math.floor(r() * greens.length)]
        ctx.globalAlpha = 0.7
        ctx.lineWidth = 1 + r()
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      break
    }
    case 'gravel': {
      ctx.fillStyle = '#7d7b76'
      ctx.fillRect(0, 0, SIZE, SIZE)
      for (let i = 0; i < 1600; i++) {
        const x = r() * SIZE
        const y = r() * SIZE
        const rad = 3 + r() * 7
        const tone = 100 + Math.floor(r() * 110)
        const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad)
        g.addColorStop(0, `rgb(${tone + 30},${tone + 28},${tone + 24})`)
        g.addColorStop(1, `rgb(${tone - 30},${tone - 32},${tone - 34})`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.ellipse(x, y, rad, rad * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'sand':
      ctx.fillStyle = '#d4bf8c'
      ctx.fillRect(0, 0, SIZE, SIZE)
      blotches(ctx, r, 30, 'rgba(190,165,115,1)', 30, 100, 0.3)
      noise(ctx, r, 14000, ['#c9b07a', '#e2d1a3', '#b89f6a', '#efe1b8'], 1, 2, 0.6)
      break
  }
  return cv
}

// Сколько дюймов приходится на один повтор текстуры
export const TILE: Record<Mat, number> = {
  concrete: 72,
  wood: 48,
  plywood: 48,
  osb: 36,
  drywall: 48,
  dirt: 36,
  grass: 30,
  gravel: 24,
  sand: 30
}

const texCache = new Map<Mat, CanvasTexture>()
export function textureOf(mat: Mat): CanvasTexture {
  let t = texCache.get(mat)
  if (!t) {
    t = new CanvasTexture(draw(mat))
    t.colorSpace = SRGBColorSpace
    t.wrapS = RepeatWrapping
    t.wrapT = RepeatWrapping
    t.anisotropy = 8
    texCache.set(mat, t)
  }
  return t
}

const ROUGH: Record<Mat, number> = { concrete: 0.92, wood: 0.75, plywood: 0.7, osb: 0.8, drywall: 0.9, dirt: 1, grass: 0.95, gravel: 0.9, sand: 1 }

export type EnvLook = 'solid' | 'ghost'
const matCache = new Map<string, MeshStandardMaterial>()
export function envMaterial(mat: Mat, look: EnvLook, selected: boolean): MeshStandardMaterial {
  const key = `${mat}|${look}|${selected}`
  let m = matCache.get(key)
  if (!m) {
    m = new MeshStandardMaterial({
      map: textureOf(mat),
      roughness: ROUGH[mat],
      metalness: 0,
      side: DoubleSide,
      transparent: look === 'ghost',
      opacity: look === 'ghost' ? 0.28 : 1,
      depthWrite: look !== 'ghost',
      emissive: selected ? '#0d9488' : '#000000',
      emissiveIntensity: selected ? 0.35 : 0
    })
    matCache.set(key, m)
  }
  return m
}
