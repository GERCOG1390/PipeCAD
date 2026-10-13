// Значок PipeCAD: SVG → PNG нужных размеров → ICO (PNG внутри) + 256-px PNG
const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')
const out = process.argv[2] || __dirname

// Полный вариант (32 px и крупнее): плитка, белый PVC-отвод 90° с раструбами, бирюзовая метка открытого конца
const full = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a343d"/>
      <stop offset="1" stop-color="#12171c"/>
    </linearGradient>
    <linearGradient id="hub" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#cfd6db"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="240" height="240" rx="54" fill="url(#tile)"/>
  <rect x="9.5" y="9.5" width="237" height="237" rx="52.5" fill="none" stroke="#3fd0c9" stroke-opacity="0.45" stroke-width="3"/>
  <!-- тень трубы -->
  <path d="M40 182 H118 A60 60 0 0 0 178 122 V44" fill="none" stroke="#0a0d10" stroke-opacity="0.55" stroke-width="50" transform="translate(5 6)"/>
  <!-- труба: основной цвет, тень снизу, блик сверху -->
  <path d="M40 178 H118 A60 60 0 0 0 178 118 V44" fill="none" stroke="#8f9aa2" stroke-width="46"/>
  <path d="M40 178 H118 A60 60 0 0 0 178 118 V44" fill="none" stroke="#eef1f3" stroke-width="34" transform="translate(-3 -3)"/>
  <path d="M56 178 H118 A60 60 0 0 0 178 118 V60" fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="7" stroke-linecap="round" transform="translate(-12 -12)"/>
  <!-- раструбы отвода -->
  <rect x="58" y="146" width="30" height="64" rx="7" fill="url(#hub)" stroke="#7d8890" stroke-width="3"/>
  <rect x="146" y="70" width="64" height="30" rx="7" fill="url(#hub)" stroke="#7d8890" stroke-width="3"/>
  <!-- открытый конец: бирюзовое кольцо, как в программе -->
  <ellipse cx="178" cy="44" rx="33" ry="9" fill="#0f1418" stroke="#3fd0c9" stroke-width="6"/>
  <!-- торец слева -->
  <ellipse cx="40" cy="178" rx="9" ry="23" fill="#c4ccd2" stroke="#7d8890" stroke-width="3"/>
</svg>`

// Упрощённый вариант (16–24 px): только плитка и толстый отвод с меткой
const small = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect x="0" y="0" width="256" height="256" rx="56" fill="#1d252c"/>
  <path d="M28 186 H112 A68 68 0 0 0 180 118 V40" fill="none" stroke="#f2f4f5" stroke-width="64"/>
  <rect x="140" y="20" width="80" height="26" rx="10" fill="#3fd0c9"/>
</svg>`

const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const pngs = sizes.map((s) => ({ s, png: render(s <= 24 ? small : full, s) }))
for (const { s, png } of pngs) fs.writeFileSync(path.join(out, `icon-${s}.png`), png)
fs.writeFileSync(path.join(out, 'icon.svg'), full.trim())

// ICO: заголовок + каталог + PNG-данные
const head = Buffer.alloc(6)
head.writeUInt16LE(0, 0)
head.writeUInt16LE(1, 2)
head.writeUInt16LE(pngs.length, 4)
const dir = Buffer.alloc(16 * pngs.length)
let offset = 6 + dir.length
pngs.forEach(({ s, png }, i) => {
  const o = i * 16
  dir.writeUInt8(s >= 256 ? 0 : s, o)
  dir.writeUInt8(s >= 256 ? 0 : s, o + 1)
  dir.writeUInt8(0, o + 2)
  dir.writeUInt8(0, o + 3)
  dir.writeUInt16LE(1, o + 4)
  dir.writeUInt16LE(32, o + 6)
  dir.writeUInt32LE(png.length, o + 8)
  dir.writeUInt32LE(offset, o + 12)
  offset += png.length
})
fs.writeFileSync(path.join(out, 'icon.ico'), Buffer.concat([head, dir, ...pngs.map((p) => p.png)]))
// большой PNG: значок окна и macOS (.icns собирается из него, нужно не меньше 512 px)
fs.writeFileSync(path.join(out, 'icon.png'), render(full, 1024))
console.log('ok', out)
