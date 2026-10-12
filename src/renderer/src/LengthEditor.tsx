// Поле длины прямо у трубы: появляется после добавления трубы или при наборе цифр, Enter — применить
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { Model } from './geometry'
import { useStore } from './store'
import { formatLength, parseLength } from './units'

const LENGTH_CHARS = /^[0-9'"\-/ .]$/

// Внутри Canvas: держит поле над серединой трубы
export function LengthEditAnchor({ model }: { model: Model }) {
  const edit = useStore((s) => s.lengthEdit)
  const parts = useStore((s) => s.parts)
  const { camera, size } = useThree()
  const v = useMemo(() => new Vector3(), [])
  const part = edit ? parts.find((p) => p.id === edit.id && p.kind === 'pipe') : undefined
  const xf = part ? model.xfs.get(part.id) : undefined
  useFrame(() => {
    const el = document.getElementById('length-editor')
    if (!el || !part || !xf) return
    v.set(0, 0, (part.length ?? 0) / 2).applyQuaternion(xf.quat).add(xf.pos).project(camera)
    el.style.transform = `translate(-50%, -130%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`
  })
  return null
}

// DOM-поле поверх вьюпорта
export function LengthEditor() {
  const edit = useStore((s) => s.lengthEdit)
  const part = useStore((s) => (edit ? s.parts.find((p) => p.id === edit.id && p.kind === 'pipe') : undefined))
  const [text, setText] = useState('')
  const [bad, setBad] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!edit || !part) return
    setText(edit.text ?? formatLength(part.length ?? 0))
    setBad(false)
    // фокус сразу, чтобы первые же нажатия попали в поле (а не в горячие клавиши)
    const el = input.current
    if (el) {
      el.value = edit.text ?? formatLength(part.length ?? 0)
      el.focus()
      if (edit.text) el.setSelectionRange(el.value.length, el.value.length)
      else el.select()
    }
  }, [edit?.id, edit?.n])
  if (!edit || !part) return null
  const close = (): void => useStore.setState({ lengthEdit: null })
  const commit = (): boolean => {
    const v = parseLength(text)
    if (v === null || v < 0.25 || v > 12000) {
      setBad(true)
      return false
    }
    if (Math.abs(v - (part.length ?? 0)) > 1e-6) useStore.getState().updatePart(part.id, { length: v })
    close()
    return true
  }
  return (
    <div id="length-editor" className="length-editor">
      <input
        ref={input}
        className={bad ? 'bad' : ''}
        value={text}
        onChange={(e) => {
          setText(e.target.value.replace(/[^0-9'"\-/ .′″]/g, ''))
          setBad(false)
        }}
        // ушли с поля — применяем, если набрано что-то верное
        onBlur={() => {
          if (!commit()) close()
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') return (e.preventDefault(), void commit())
          if (e.key === 'Escape') return (e.preventDefault(), close())
          // буква — это горячая клавиша: закрываем поле и передаём клавишу приложению
          if (e.key.length === 1 && !LENGTH_CHARS.test(e.key) && !e.ctrlKey) {
            e.preventDefault()
            if (!commit()) close()
            window.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, code: e.code, shiftKey: e.shiftKey }))
          }
        }}
      />
      <div className="hint">Enter — set length · Esc — keep {formatLength(part.length ?? 0)}</div>
    </div>
  )
}
