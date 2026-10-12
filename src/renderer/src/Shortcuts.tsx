// Шпаргалка горячих клавиш: «?» или кнопка в панели
import { KIND_KEYS, fittingDef } from './catalog'

const GENERAL: [string, string][] = [
  ['Right-click an open end', 'Quick menu: common parts for that end'],
  ['0–9 on a selected pipe', 'Type the length right away (3\'6, 42, 3-1/2)'],
  ['J', 'Join the selected end to another end'],
  ['R / Shift+R', 'Rotate selected part (or the part being placed) 90°'],
  ['Del / Shift+Del', 'Delete this part only / with everything after it'],
  ['Esc', 'Cancel placing, joining or selection'],
  ['L', 'Show / hide pipe lengths'],
  ['A', 'Centerlines and intersections of open ends'],
  ['Home', 'Fit everything in view'],
  ['Ctrl+Z / Ctrl+Y', 'Undo / redo'],
  ['Ctrl+S / Ctrl+Shift+S', 'Save / save as'],
  ['Ctrl+O', 'Open project'],
  ['?', 'This help']
]
const MOUSE: [string, string][] = [
  ['Left drag', 'Orbit'],
  ['Right drag', 'Pan'],
  ['Wheel', 'Zoom'],
  ['Drag a pipe end arrow', 'Change pipe length'],
  ['Drag the ring around a part', 'Rotate (Shift — 15° steps)']
]
const REPLAY: [string, string][] = [
  ['Space', 'Play / pause'],
  ['← / →', 'Step back / forward'],
  ['Esc', 'Exit replay']
]

export function Shortcuts({ onClose }: { onClose: () => void }) {
  const table = (rows: [string, string][]) => (
    <table>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>
              <kbd>{k}</kbd>
            </td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal shortcuts" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>Keyboard & mouse</b>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="sc-cols">
          <div>
            <h4>Add a part to the selected end</h4>
            {table(KIND_KEYS.map((k) => [k.key, fittingDef(k.kind).ru] as [string, string]))}
            <h4>Mouse</h4>
            {table(MOUSE)}
          </div>
          <div>
            <h4>General</h4>
            {table(GENERAL)}
            <h4>Replay</h4>
            {table(REPLAY)}
          </div>
        </div>
      </div>
    </div>
  )
}
