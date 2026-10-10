// Длины в дюймах; показываем как 4' 6-1/2" с точностью до 1/16".

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a
}

export function formatLength(inches: number): string {
  const n16 = Math.round(inches * 16)
  const ft = Math.floor(n16 / 192)
  const rest = n16 - ft * 192
  const whole = Math.floor(rest / 16)
  const frac = rest % 16
  let inchStr = String(whole)
  if (frac) {
    const g = gcd(frac, 16)
    inchStr = `${whole ? whole + '-' : ''}${frac / g}/${16 / g}`
  }
  if (!ft) return `${inchStr}"`
  return `${ft}' ${inchStr}"`
}

// Понимает: 48 | 48.5 | 6 1/2 | 6-1/2 | 1/2 | 4' | 4'6 | 4' 6-1/2"
export function parseLength(input: string): number | null {
  let s = input.trim().replace(/[″”]/g, '"').replace(/[′’]/g, "'").replace(',', '.')
  if (!s) return null
  let ft = 0
  const fm = s.match(/^(\d+(?:\.\d+)?)\s*'\s*(.*)$/)
  if (fm) {
    ft = parseFloat(fm[1])
    s = fm[2]
  }
  s = s.replace(/"/g, '').trim()
  let inch = 0
  if (s) {
    const m = s.match(/^(?:(\d+(?:\.\d+)?)(?:[\s-]+|$))?(?:(\d+)\/(\d+))?$/)
    if (!m || (!m[1] && !m[2])) return null
    if (m[1]) inch += parseFloat(m[1])
    if (m[2]) {
      const den = parseInt(m[3])
      if (!den) return null
      inch += parseInt(m[2]) / den
    }
  }
  const total = ft * 12 + inch
  return Number.isFinite(total) ? total : null
}
