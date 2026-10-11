// Mueller Streamline (Mueller Industries) — Series 7700S, Lead Free Brass Ball Valve, Solder, Full Port.
// Spec sheet «Brass Full Port Ball Valves» (Sept 2023), muellerstreamline.com. Дюймы.
// A — проход (полнопроходной), B — от оси штока до торца раструба, C — общая длина,
// D — от оси трубы до верха рычага, E — длина рычага от оси штока, F — глубина раструба.
import type { SizeId } from './sizes'

export interface BallValveDims {
  pn: string
  A: number
  B: number
  C: number
  D: number
  E: number
  F: number
}

export const MUELLER_7700S: Partial<Record<SizeId, BallValveDims>> = {
  'cu1/2': { pn: '117-843', A: 0.551, B: 0.992, C: 1.984, D: 1.77, E: 3.46, F: 0.504 },
  'cu3/4': { pn: '117-844', A: 0.748, B: 1.421, C: 2.81, D: 2.09, E: 4.29, F: 0.752 },
  cu1: { pn: '117-845', A: 0.984, B: 1.66, C: 3.34, D: 2.25, E: 4.29, F: 0.909 },
  'cu1-1/4': { pn: '117-846', A: 1.259, B: 1.996, C: 3.91, D: 2.52, E: 5.63, F: 0.972 },
  'cu1-1/2': { pn: '117-847', A: 1.574, B: 2.252, C: 4.46, D: 2.74, E: 5.63, F: 1.091 },
  cu2: { pn: '117-848', A: 1.941, B: 2.756, C: 5.45, D: 3.03, E: 6.1, F: 1.343 }
}
