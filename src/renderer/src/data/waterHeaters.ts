// Bradford White — газовые бойлеры (residential gas water heaters). Дюймы.
// Spec sheets: 1101 Atmospheric Vent, 1108 Atmospheric Vent High Input, 1261 TTW Power Vent (docs.bradfordwhite.com).
// A — пол → верх патрубка дымохода / вентилятора; B — диаметр кожуха; C — дымоход; D — пол → T&P;
// E — пол → газ; F — пол → верх кожуха; G — пол → верх водяных патрубков; H — глубина (с газовым блоком);
// J — между осями водяных патрубков; K/L — пол → патрубки отопления (только H-модели); M — водяные патрубки NPT.
export interface HeaterSpec {
  model: string
  gal: number
  vent: 'atm' | 'pv'
  A: number
  B: number
  C: number
  D: number
  E: number
  F: number
  G: number
  H: number
  J: number
  K?: number
  L?: number
  M: '3/4' | '1'
  btu?: number
  note?: string
}

export const HEATERS: HeaterSpec[] = [
  // Atmospheric Vent (1101)
  { model: 'RG230T6N', gal: 30, vent: 'atm', A: 59.75, B: 18, C: 3, D: 49.75, E: 13, F: 56.25, G: 57, H: 21.5, J: 8, M: '3/4', note: 'Tall' },
  { model: 'RG230S6N', gal: 30, vent: 'atm', A: 49.25, B: 20, C: 3, D: 38.875, E: 13, F: 45.75, G: 46.5, H: 23.5, J: 8, M: '3/4', note: 'Short' },
  { model: 'RG240T6N', gal: 40, vent: 'atm', A: 60.125, B: 20, C: 3, D: 49.75, E: 13, F: 56.625, G: 57.375, H: 23.5, J: 8, M: '3/4', note: 'Tall' },
  { model: 'RG240S6N', gal: 40, vent: 'atm', A: 51.5625, B: 22, C: 3, D: 41.0625, E: 13, F: 48.0625, G: 48.8125, H: 25.5, J: 8, M: '3/4', note: 'Short' },
  { model: 'RG250T6N', gal: 50, vent: 'atm', A: 60.125, B: 22, C: 3, D: 49.9375, E: 13, F: 56.625, G: 57.375, H: 25.5, J: 8, M: '3/4', note: 'Tall' },
  { model: 'RG250L6N', gal: 48, vent: 'atm', A: 51.5625, B: 24, C: 3, D: 40.6875, E: 13, F: 48.0625, G: 48.8125, H: 27.5, J: 8, M: '3/4', note: 'Lowboy' },
  { model: 'RG250S6N', gal: 50, vent: 'atm', A: 60.125, B: 22, C: 4, D: 49.9375, E: 13, F: 56.625, G: 57.375, H: 25.5, J: 8, M: '3/4', note: '50,000 BTU' },
  // Atmospheric Vent High Input (1108)
  { model: 'RG250H6N', gal: 50, vent: 'atm', A: 60.125, B: 22, C: 4, D: 49.9375, E: 13, F: 56.625, G: 57.375, H: 25.5, J: 11, K: 13.4375, L: 49.9375, M: '3/4', btu: 65000, note: 'High Input' },
  { model: 'RG255H6N', gal: 55, vent: 'atm', A: 58.5, B: 24, C: 4, D: 48.125, E: 13.125, F: 54.75, G: 56.5, H: 27.25, J: 8, K: 13.5, L: 48.125, M: '3/4', note: 'High Input' },
  { model: 'RG275H6N', gal: 75, vent: 'atm', A: 62.625, B: 26, C: 4, D: 51.875, E: 15, F: 59.625, G: 60.0625, H: 29.25, J: 11, K: 16.625, L: 51.875, M: '1', btu: 76000, note: 'High Input' },
  // TTW Power Vent (1261)
  { model: 'RG2PV40S6N', gal: 40, vent: 'pv', A: 55.4375, B: 22, C: 3, D: 40.125, E: 11.5, F: 47.1875, G: 49, H: 27.1875, J: 8, M: '3/4', btu: 40000, note: 'Short' },
  { model: 'RG2PV50S6N', gal: 50, vent: 'pv', A: 56.4375, B: 24, C: 3, D: 40.625, E: 11.5, F: 48.1875, G: 50.5, H: 28.875, J: 8, M: '3/4', btu: 40000, note: 'Short' },
  { model: 'RG2PV40T6N', gal: 40, vent: 'pv', A: 65, B: 20, C: 3, D: 49.6875, E: 11.5, F: 56.75, G: 58, H: 26.125, J: 8, M: '3/4', btu: 40000, note: 'Tall' },
  { model: 'RG2PV50T6N', gal: 50, vent: 'pv', A: 65.8125, B: 22, C: 3, D: 50.5625, E: 11.5, F: 57.5625, G: 58, H: 27.1875, J: 8, M: '3/4', btu: 40000, note: 'Tall' },
  { model: 'RG2PV50H6N', gal: 50, vent: 'pv', A: 64.4375, B: 22, C: 3, D: 49.875, E: 11.5, F: 56.75, G: 57.75, H: 26.9375, J: 11, K: 13.375, L: 49.875, M: '3/4', btu: 65000, note: 'High Input' },
  { model: 'RG2PV75H6N', gal: 75, vent: 'pv', A: 67.4375, B: 26, C: 3, D: 51.9375, E: 13.9375, F: 59.6875, G: 60.75, H: 30.6875, J: 11, K: 16.6875, L: 51.9375, M: '3/4', btu: 76000, note: 'High Input' }
]
