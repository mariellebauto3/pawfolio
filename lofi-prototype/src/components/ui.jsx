import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

// Reads a starting value from the URL (?name=value) so any screen state can be linked to directly.
export function useInit(name, fallback = null) {
  const [sp] = useSearchParams()
  return sp.get(name) ?? fallback
}

// Which dialog is open. Starts from ?modal=… so dialogs are linkable.
export function useModal() {
  return useState(useInit('modal'))
}

export const TOASTS = {
  saved: 'Saved to Bookmarks.',
  removed: 'Removed from Bookmarks.',
  invite: 'Invite to Apply sent. You’ll be notified if they apply.',
  report: 'Thanks for reporting. An admin will review it.',
  approved: 'Account approved. The owner has been notified.',
  denied: 'Account denied. The owner can see your reason.',
  posted: 'Your post is live on the feed.',
  deleted: 'Post deleted.',
  dismissed: 'Invite dismissed.',
  slot: 'Slot added. Pets with an approved request can book it.',
  password: 'Password updated.',
  change: 'Change request sent to an admin.',
  published: 'Announcement published.',
  resolved: 'Change applied and written to the activity log.',
  action: 'Action applied. The account owner has been notified.',
  suspended: 'Account suspended and logged.',
  reactivated: 'Account reactivated and logged.',
  deactivated: 'Account deactivated and logged.',
  intro: 'Profile updated.',
  photo: 'Photo added to your résumé.',
  details: 'Details updated. Your account is still pending review.',
  reminder: 'Reminder sent to both sides.',
  reset: 'Password reset. Sign in with your new password.',
}

export function useToast() {
  const [key, setKey] = useState(useInit('toast'))
  const el = key ? <Toast onClose={() => setKey(null)}>{TOASTS[key] || key}</Toast> : null
  return [el, setKey]
}

export function Ph({ w = '100%', h = 120, label = 'Photo', round, className = '', style }) {
  return (
    <div className={`ph ${round ? 'round' : ''} ${className}`} style={{ width: w, height: h, ...style }}>
      {label && <span>{label}</span>}
    </div>
  )
}

export function Btn({ to, variant = '', small, block, className = '', children, ...rest }) {
  const cls = ['btn', variant, small && 'sm', block && 'block', className].filter(Boolean).join(' ')
  if (to) return <Link className={cls} to={to} {...rest}>{children}</Link>
  return <button type="button" className={cls} {...rest}>{children}</button>
}

export const Tag = ({ children }) => <span className="tag">{children}</span>
export const Badge = ({ children, solid }) => <span className={`badge ${solid ? 'solid' : ''}`}>{children}</span>

export function Card({ title, action, className = '', style, children }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || action) && (
        <div className="card-head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export const Note = ({ children }) => <div className="note"><b>NOTE</b>{children}</div>

export function Alert({ children }) {
  return <div className="alert">{children}</div>
}

export function Lines({ n = 3 }) {
  return <div className="lines">{Array.from({ length: n }, (_, i) => <i key={i} style={{ width: `${95 - i * 15}%` }} />)}</div>
}

export function Stepper({ steps, current }) {
  return (
    <ol className="stepper">
      {steps.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'now' : ''}>{s}</li>
      ))}
    </ol>
  )
}

export function Field({ label, type = 'text', placeholder = '', as, options = [], hint, defaultValue, locked, rows = 4 }) {
  let control
  if (as === 'select') control = <select defaultValue={defaultValue} disabled={locked}>{options.map((o) => <option key={o}>{o}</option>)}</select>
  else if (as === 'textarea') control = <textarea rows={rows} placeholder={placeholder} defaultValue={defaultValue} />
  else if (as === 'file') control = <div className="upload">+ Upload {placeholder}<div className="small">JPG, PNG or PDF · max 5 MB</div></div>
  else control = <input type={type} placeholder={placeholder} defaultValue={defaultValue} disabled={locked} />
  return (
    <label className="field">
      <span>{label}{locked && <em className="locked">Locked</em>}</span>
      {control}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function Choice({ label, options, multi, initial = [] }) {
  const [sel, setSel] = useState(initial)
  const pick = (o) => setSel(multi ? (sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]) : [o])
  return (
    <div className="field">
      {label && <span>{label}</span>}
      <div className="choices">
        {options.map((o) => (
          <button type="button" key={o} className={`choice ${sel.includes(o) ? 'on' : ''}`} onClick={() => pick(o)}>{o}</button>
        ))}
      </div>
    </div>
  )
}

export function Check({ label, defaultChecked }) {
  return <label className="check"><input type="checkbox" defaultChecked={defaultChecked} /><span>{label}</span></label>
}

// Radio options shown as selectable cards. Options are strings or [title, subtitle] pairs.
export function Radios({ name, options, initial }) {
  const first = Array.isArray(options[0]) ? options[0][0] : options[0]
  const [v, setV] = useState(initial === undefined ? first : initial)
  return (
    <div className="radios">
      {options.map((o) => {
        const [title, sub] = Array.isArray(o) ? o : [o]
        return (
          <label key={title} className={`radio-card ${v === title ? 'on' : ''}`}>
            <input type="radio" name={name} checked={v === title} onChange={() => setV(title)} />
            <div className="grow"><strong>{title}</strong>{sub && <div className="small muted">{sub}</div>}</div>
          </label>
        )
      })}
    </div>
  )
}

export function Toggle({ on, onChange, label }) {
  return (
    <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <i />{label}
    </button>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => <button type="button" key={t} className={t === value ? 'on' : ''} onClick={() => onChange(t)}>{t}</button>)}
    </div>
  )
}

export function Meter({ value }) {
  return <div className="meter"><i style={{ width: `${value}%` }} /></div>
}

export function PageHead({ title, sub, actions }) {
  return (
    <div className="row between" style={{ marginBottom: 16 }}>
      <div className="stack-sm">
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

export function Empty({ title, body, action }) {
  return (
    <div className="empty">
      <Ph w={88} h={88} round label="" />
      <h2>{title}</h2>
      <p className="muted">{body}</p>
      {action}
    </div>
  )
}

export function Pagination() {
  return (
    <div className="row" style={{ justifyContent: 'center' }}>
      <Btn small variant="ghost" disabled>Previous</Btn>
      {[1, 2, 3].map((n) => <span key={n} className={`page-no ${n === 1 ? 'on' : ''}`}>{n}</span>)}
      <span className="muted">…</span>
      <span className="page-no">8</span>
      <Btn small variant="ghost">Next</Btn>
    </div>
  )
}

// The dialog box itself, without the overlay (also used on the component sheet).
export function ModalBox({ title, sub, onClose, footer, width = 520, children }) {
  return (
    <div className="modal" style={{ width }} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head">
        <div className="stack-sm" style={{ gap: 2 }}>
          <h2>{title}</h2>
          {sub && <p className="small muted">{sub}</p>}
        </div>
        <button type="button" className="x" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </div>
  )
}

export function Modal(props) {
  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <ModalBox {...props} />
    </div>
  )
}

export function Drawer({ title, sub, onClose, footer, children }) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="stack-sm" style={{ gap: 2 }}><h2>{title}</h2>{sub && <p className="small muted">{sub}</p>}</div>
          <button type="button" className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body grow">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </aside>
    </div>
  )
}

export function Toast({ children, onClose, className = '' }) {
  useEffect(() => {
    if (!onClose || window.__BOOK__) return
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`toast ${className}`} role="status">
      <span className="toast-ico">✓</span>
      <span>{children}</span>
      {onClose && <button type="button" className="x" onClick={onClose} aria-label="Dismiss">✕</button>}
    </div>
  )
}

// Multi-step form shell used by sign-up, résumé and quiz (NFR1: steps + progress indicator).
export function Wizard({ steps, render, finish, finishLabel = 'Submit', saveDraft }) {
  const start = Math.min(Math.max(Number(useInit('step', 1)) - 1, 0), steps.length - 1)
  const [i, setI] = useState(start)
  const last = i === steps.length - 1
  return (
    <div className="stack">
      <Stepper steps={steps} current={i} />
      <p className="small muted">Step {i + 1} of {steps.length} · {steps[i]}</p>
      <div className="stack" key={i}>{render(i)}</div>
      <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <Btn disabled={i === 0} onClick={() => setI(i - 1)}>Back</Btn>
        <div className="row">
          {saveDraft && <Btn variant="ghost">Save draft</Btn>}
          {last ? <Btn variant="primary" onClick={finish}>{finishLabel}</Btn> : <Btn variant="primary" onClick={() => setI(i + 1)}>Next</Btn>}
        </div>
      </div>
    </div>
  )
}
