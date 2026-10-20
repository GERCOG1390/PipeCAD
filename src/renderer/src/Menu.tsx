// Выпадающее меню верхней панели: кнопка + список пунктов (команды, галочки, переключатели)
import { ChevronDown, Check } from 'lucide-react'
import { ReactNode, useEffect, useRef, useState } from 'react'

export type MenuItem =
  | { sep: true; label?: string }
  | { label: string; icon?: ReactNode; keys?: string; checked?: boolean; disabled?: boolean; danger?: boolean; onClick: () => void; sep?: false }

export function Menu({ label, icon, items, title, active }: { label?: string; icon?: ReactNode; items: MenuItem[]; title?: string; active?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', off, true)
    window.addEventListener('keydown', esc, true)
    return () => {
      window.removeEventListener('pointerdown', off, true)
      window.removeEventListener('keydown', esc, true)
    }
  }, [open])
  return (
    <div className="menu" ref={ref}>
      <button className={'tb' + (open || active ? ' on' : '')} onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setAt({ x: r.left, y: r.bottom + 6 })
          setOpen((o) => !o)
        }} title={title} aria-haspopup="menu" aria-expanded={open}>
        {icon}
        {label && <span>{label}</span>}
        <ChevronDown size={14} className="chev-dn" />
      </button>
      {open && (
        <div className="menu-list" role="menu" style={{ left: at.x, top: at.y }}>
          {items.map((it, i) =>
            it.sep ? (
              it.label ? (
                <div key={i} className="menu-sep labeled">
                  {it.label}
                </div>
              ) : (
                <div key={i} className="menu-sep" />
              )
            ) : (
              <button
                key={i}
                role="menuitem"
                className={'menu-item' + (it.danger ? ' danger' : '')}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
              >
                <span className="mi-icon">{it.checked !== undefined ? it.checked ? <Check size={16} /> : null : it.icon}</span>
                <span className="mi-label">{it.label}</span>
                {it.keys && <kbd>{it.keys}</kbd>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
