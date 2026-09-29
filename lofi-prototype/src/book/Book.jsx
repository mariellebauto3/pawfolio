import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { Proto } from '../proto'
import { Shell } from '../App'
import { AdminSidebar, GuestNav, TopNav } from '../components/Layout'
import {
  Alert, Badge, Btn, Check, Choice, Empty, Field, Meter, ModalBox, Pagination, Ph, Radios, Stepper, Tabs, Tag, Toast, Toggle,
} from '../components/ui'
import { MatchCard, PostCard } from '../components/cards'
import { homes, pets, posts } from '../data'
import { CHAINS, CORE, FLOWS, FRS, MODULES, NFRS, ROLE_LABEL, SCREENS, SITEMAP } from './specs'

// Page geometry (CSS px). Each sheet is one 1920 × 1200 PDF page.
const PAGE_H = 1200
const HEAD = 64
const PAD = 40
const NOTES = 400
const GAP = 32
const BAR = 36
// book.html?device=mobile prints the small-screen edition.
const MOBILE = new URLSearchParams(window.location.search).get('device') === 'mobile'
const DEV = MOBILE
  ? { w: 390, h: 844, cls: 'm-frame', label: 'Phone · 390 × 844', kind: 'small-screen (phone)', other: 'desktop' }
  : { w: 1440, h: 900, cls: '', label: 'Desktop · 1440 × 900', kind: 'desktop (L-screen)', other: 'mobile' }

const AW = 1920 - PAD * 2 - NOTES - GAP // width available for the browser frame
const AH = PAGE_H - HEAD - PAD * 2 - BAR - 2 // height available for the screen itself
const S0 = AW / DEV.w // default scale for a desktop screen
const VIEW_H = DEV.h // device viewport height
const MIN_FIT = 0.66 // below this, long pages are split into parts instead
const SPLIT_SCALE = 0.74
const M_SCALE = 1.1 // phone screens are shown slightly enlarged…
const M_PER = 3 // …three phone screens per page

const byId = Object.fromEntries(SCREENS.map((s) => [s.id, s]))
const modOf = (s) => MODULES.find((m) => m.key === s.module)

/* ---------------- rendering the real prototype ---------------- */

function Screen({ spec }) {
  const [role, setRole] = useState(spec.role)
  const [acct, setAcct] = useState(spec.acct)
  return (
    <Proto.Provider value={{ role, setRole, acct, setAcct }}>
      <MemoryRouter initialEntries={[spec.url]}>
        <Shell />
      </MemoryRouter>
    </Proto.Provider>
  )
}

function Demo({ role = 'human', url = '/feed', children }) {
  return (
    <Proto.Provider value={{ role, setRole() {}, acct: 'Active', setAcct() {} }}>
      <MemoryRouter initialEntries={[url]}>
        <div className="bk-demo">{children}</div>
      </MemoryRouter>
    </Proto.Provider>
  )
}

// Prototype-only query params (modal=, step=…) are hidden from the fake address bar.
function displayUrl(url) {
  const [path, q = ''] = url.split('?')
  const kept = [...new URLSearchParams(q).entries()].filter(([k]) => k === 'q' || k === 'tab')
  return path + (kept.length ? `?${kept.map(([k, v]) => `${k}=${v}`).join('&')}` : '')
}

function Frame({ spec, scale, offset = 0, segH = VIEW_H, caption }) {
  return (
    <div className="bk-frame-wrap">
      <div className={`bk-browser ${MOBILE ? 'phone' : ''}`} style={{ width: DEV.w * scale + 2 }}>
        {MOBILE ? (
          <div className="bk-bar">
            <span>9:41</span>
            <span className="bk-url">pawfolio.app{displayUrl(spec.url)}</span>
            <span>▮▮▮</span>
          </div>
        ) : (
          <div className="bk-bar">
            <i /><i /><i />
            <span className="bk-url">pawfolio.app{displayUrl(spec.url)}</span>
            <span>{DEV.label}</span>
          </div>
        )}
        <div className="bk-window" style={{ width: DEV.w * scale, height: segH * scale }}>
          <div className="bk-scale" style={{ width: DEV.w, transform: `scale(${scale})`, top: -offset * scale }}>
            <div className={`frame-content ${DEV.cls} ${spec.viewport ? 'viewport' : ''}`}><Screen spec={spec} /></div>
          </div>
        </div>
      </div>
      {caption && <div className="bk-part">{caption}</div>}
    </div>
  )
}

// First pass: render every full-page screen off-screen to learn its height.
function Measure({ onDone }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const out = {}
    ref.current.querySelectorAll('[data-sid]').forEach((el) => { out[el.dataset.sid] = Math.ceil(el.scrollHeight) })
    onDone(out)
  }, [onDone])
  return (
    <div ref={ref} className="bk-measure">
      {SCREENS.filter((s) => !s.viewport).map((s) => (
        <div key={s.id} data-sid={s.id} className={`frame-content ${DEV.cls}`}><Screen spec={s} /></div>
      ))}
    </div>
  )
}

/* ---------------- page plan ---------------- */

function screenPages(spec, heights) {
  const h = spec.viewport ? VIEW_H : Math.max(VIEW_H, heights[spec.id] || VIEW_H)
  const base = { t: 'screen', spec, fullH: h }
  if (MOBILE) {
    // The page is cut into phone-screen-sized pieces, shown side by side, three per sheet.
    const n = Math.max(1, Math.ceil((h - 40) / VIEW_H))
    const segs = Array.from({ length: n }, (_, i) => ({ i, offset: i * VIEW_H, h: i === n - 1 ? h - i * VIEW_H : VIEW_H }))
    const parts = Math.ceil(n / M_PER)
    return Array.from({ length: parts }, (_, p) => ({
      ...base, scale: M_SCALE, segCount: n, segs: segs.slice(p * M_PER, (p + 1) * M_PER), part: p + 1, parts,
    }))
  }
  const one = (scale) => [{ ...base, scale, segCount: 1, segs: [{ i: 0, offset: 0, h }], part: 1, parts: 1 }]
  if (h * S0 <= AH) return one(S0)
  if (AH / h >= MIN_FIT) return one(AH / h)
  const parts = Math.ceil(h / (AH / SPLIT_SCALE))
  const seg = Math.ceil(h / parts)
  const scale = Math.min(S0, AH / seg)
  return Array.from({ length: parts }, (_, i) => ({
    ...base, scale, segCount: 1, segs: [{ i, offset: i * seg, h: Math.min(seg, h - i * seg) }], part: i + 1, parts,
  }))
}

function planPages(heights) {
  const pages = ['cover', 'contents', 'guide', 'sitemap', 'core', 'nav', 'kit1', 'kit2'].map((t) => ({ t }))
  SCREENS.filter((s) => s.module === 'global').forEach((s) => pages.push(...screenPages(s, heights)))
  MODULES.forEach((m) => {
    pages.push({ t: 'module', m })
    SCREENS.filter((s) => s.module === m.key).forEach((s) => pages.push(...screenPages(s, heights)))
  })
  pages.push({ t: 'trace', part: 0 }, { t: 'trace', part: 1 }, { t: 'trace', part: 2 }, { t: 'index' })
  pages.forEach((p, i) => { p.n = i + 1 })
  return pages
}

function pageIndex(pages) {
  const at = {}
  pages.forEach((p) => {
    if (p.t === 'screen') { if (p.part === 1) at[p.spec.id] = p.n }
    else if (p.t === 'module') at[`mod:${p.m.key}`] = p.n
    else if (!at[p.t]) at[p.t] = p.n
  })
  return at
}

/* ---------------- shared bits ---------------- */

function Sheet({ p, section, className = '', children }) {
  return (
    <section className={`bk-sheet ${className}`} id={`p${p.n}`}>
      <header className="bk-head">
        <span className="bk-brand"><i>PF</i>Pawfolio · Low-Fidelity UI Designs</span>
        <span className="bk-section">{section}</span>
        <span className="bk-pno">{p.n}</span>
      </header>
      <div className="bk-body">{children}</div>
    </section>
  )
}

// Turns screen IDs inside a string into links to their pages.
function Ids({ text, at }) {
  return text.split(/([A-Z]{2}-\d{2})/g).map((part, i) =>
    byId[part] && at[part]
      ? <a key={i} className="bk-link bk-ref" href={`#p${at[part]}`}>{part}</a>
      : <Fragment key={i}>{part}</Fragment>)
}

function NoteList({ title, items }) {
  if (!items.length) return null
  return (
    <div className="bk-list">
      <h4>{title}</h4>
      <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  )
}

/* ---------------- sheets ---------------- */

function Cover({ p }) {
  const kinds = SCREENS.reduce((acc, s) => ({ ...acc, [s.kind === 'Screen' ? 'screens' : 'other']: (acc[s.kind === 'Screen' ? 'screens' : 'other'] || 0) + 1 }), {})
  return (
    <section className="bk-sheet bk-cover" id={`p${p.n}`}>
      <div className="bk-cover-text">
        <div className="bk-cover-logo">PF</div>
        <div className="bk-kicker">Low-fidelity UI designs · {DEV.kind} layouts</div>
        <h1>Pawfolio</h1>
        <p className="bk-cover-sub">A LinkedIn-style platform where stray and shelter pets build a résumé, apply for a home, and get “Hired” by their future Furparent.</p>
        <div className="bk-stats">
          <div><b>14</b><span>modules</span></div>
          <div><b>{kinds.screens}</b><span>screens</span></div>
          <div><b>{kinds.other}</b><span>dialogs, menus &amp; states</span></div>
          <div><b>41</b><span>requirements traced</span></div>
        </div>
        <p className="bk-cover-foot">Companion to the Pawfolio System Proposal · September 2026<br />
          {MOBILE
            ? 'All layouts are drawn for a 390 × 844 phone screen. The same screens for desktop are in the companion desktop edition.'
            : 'All layouts are drawn for a 1440 × 900 desktop browser window. The same screens for phones are in the companion mobile edition.'}
        </p>
      </div>
      {MOBILE ? (
        <div className="bk-cover-phones">
          {['FD-01', 'DS-05', 'MT-01'].map((id) => <Frame key={id} spec={{ ...byId[id], viewport: true }} scale={0.72} />)}
        </div>
      ) : (
        <div className="bk-cover-art">
          <Frame spec={{ ...byId['FD-01'], viewport: true }} scale={0.56} />
          <div className="bk-cover-art2"><Frame spec={{ ...byId['DS-05'], viewport: true }} scale={0.4} /></div>
        </div>
      )}
    </section>
  )
}

function TocRows({ rows }) {
  return (
    <ol className="bk-toc">
      {rows.map(([label, n]) => (
        <li key={label}><a className="bk-link" href={`#p${n}`}><span>{label}</span><i>{n}</i></a></li>
      ))}
    </ol>
  )
}

function Contents({ p, at }) {
  const front = [
    ['How to read this document', at.guide],
    ['Sitemap by role', at.sitemap],
    ['Core adoption flow & status rules', at.core],
    ['Navigation elements', at.nav],
    ['UI kit · controls & forms', at.kit1],
    ['UI kit · content & feedback', at.kit2],
    ['Global screens · GN-01 menu, GN-02 not found', at['GN-01']],
  ]
  const back = [
    ['A · Requirements traceability (FR1–FR41, NFR1–NFR9)', at.trace],
    ['B · Screen index (every ID with its page)', at.index],
  ]
  return (
    <Sheet p={p} section="Contents">
      <div className="bk-contents">
        <div className="bk-col">
          <h1 className="bk-title">Contents</h1>
          <h3 className="bk-h3">Front matter</h3>
          <TocRows rows={front} />
          <h3 className="bk-h3">Appendices</h3>
          <TocRows rows={back} />
          <div className="bk-box">
            <b>Scope of this document</b>
            <p>Every module from Section 9 of the proposal, with its screens, dialogs, forms, menus, empty states, error states and confirmation messages, for the Visitor, Pet, Human and Admin roles.</p>
            <p>{MOBILE
              ? 'Small-screen (phone) layouts only, drawn at 390 × 844. Long pages are shown as a row of phone screens, top to bottom, left to right.'
              : 'Large-screen (desktop) layouts only, drawn at 1440 × 900.'} Each page shows the real clickable prototype, so the PDF and the prototype always match.</p>
          </div>
        </div>
        <div className="bk-col">
          <h3 className="bk-h3">Modules</h3>
          <ol className="bk-toc bk-toc-mod">
            {MODULES.map((m) => {
              const n = SCREENS.filter((s) => s.module === m.key).length
              const page = at[`mod:${m.key}`]
              return (
                <li key={m.key}>
                  <a className="bk-link" href={`#p${page}`}>
                    <b>{String(m.no).padStart(2, '0')}</b>
                    <span>{m.name}<em>{m.prefix} · {n} screens, dialogs &amp; states</em></span>
                    <i>{page}</i>
                  </a>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </Sheet>
  )
}

function Guide({ p }) {
  return (
    <Sheet p={p} section="How to read this document">
      <h1 className="bk-title">How to read this document</h1>
      <div className="bk-guide">
        <div className="bk-col">
          <h3 className="bk-h3">Anatomy of a screen page</h3>
          <div className="bk-anatomy">
            <div className="an-head"><span>1</span> Module · page number</div>
            <div className="an-body">
              <div className="an-frame"><div className="an-bar"><span>2</span> Address bar · {DEV.label.toLowerCase()}</div><div className="an-screen"><span>3</span> The screen, drawn from the live prototype</div></div>
              <div className="an-notes"><span>4</span> Screen ID, role and type<br /><br /><span>5</span> Purpose, key UI elements, interactions &amp; flow, rules<br /><br /><span>6</span> Requirements (FR) covered</div>
            </div>
          </div>
          <ol className="bk-steps">
            <li>The section and page number. Links in the contents and indexes jump to pages.</li>
            <li>The address the screen lives at. Every screen is shown in a {MOBILE ? 'phone (390 × 844)' : 'desktop browser (1440 × 900)'} frame.</li>
            <li>The wireframe. Grayscale on purpose: it shows layout, content and flow — not colours or branding.</li>
            <li>What the screen is and who sees it. Types: Screen, Dialog, Drawer, Dropdown, Toast, State, Empty state, Error state.</li>
            <li>Arrows (→) name the screen or dialog an action leads to, by ID.</li>
            <li>Functional requirements from Section 7 of the proposal that the screen fulfils.</li>
          </ol>
          <h3 className="bk-h3">Capture types</h3>
          {MOBILE ? (
            <p className="bk-p"><b>Full page</b> — the whole page, cut into phone-screen-sized pieces shown side by side (“Screen 1 of 4 · top of page”, then scrolled down). Pages longer than three screens continue on the next sheet.<br /><b>Viewport</b> — exactly what fits on one 390 × 844 phone screen. Used for dialogs, menus, toasts and states, which appear on top of the page behind them.</p>
          ) : (
            <p className="bk-p"><b>Full page</b> — the whole page from top to bottom. Short pages are shown at ~98%; longer ones are scaled to fit, and very long ones are split into numbered parts.<br /><b>Viewport</b> — exactly what fits in a 1440 × 900 window. Used for dialogs, menus, toasts and states, which appear on top of the page behind them.</p>
          )}
        </div>
        <div className="bk-col">
          <h3 className="bk-h3">Screen IDs</h3>
          <table className="bk-table">
            <tbody>
              <tr><th>GN</th><td>Navigation &amp; global</td></tr>
              {MODULES.map((m) => <tr key={m.key}><th>{m.prefix}</th><td>{m.no}. {m.name}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="bk-col">
          <h3 className="bk-h3">Notation</h3>
          <Demo>
            <div className="bk-legend">
              <div><Ph w={90} h={56} label="Photo" /><span>Image or photo placeholder</span></div>
              <div><Btn variant="primary" small>Primary</Btn><Btn small>Secondary</Btn><Btn small variant="ghost">Tertiary</Btn><span>Buttons, by emphasis</span></div>
              <div><Badge>In Process</Badge><Badge solid>Hired</Badge><span>Status badges; solid = final or highlighted</span></div>
              <div><span className="locked">Locked</span><span>Verified field that can’t be edited</span></div>
              <div><span className="bk-mini-overlay"><i /></span><span>Dark overlay = dialog on top of the page</span></div>
              <div><span className="bk-mini-toast">✓ Saved</span><span>Toast confirmation, bottom-left</span></div>
            </div>
          </Demo>
          <h3 className="bk-h3">Roles &amp; sample data</h3>
          <dl className="bk-dl">
            <dt>Visitor</dt><dd>Not signed in: landing, sign in, sign up.</dd>
            <dt>Pet</dt><dd>“Mochi”, an Aspin run by her foster caretaker. In Process with Ana.</dd>
            <dt>Human</dt><dd>“Ana Santos”, Open to Adopt and already a Furparent of Luna.</dd>
            <dt>Admin</dt><dd>“admin.jess”, platform staff. Uses a sidebar layout.</dd>
          </dl>
        </div>
      </div>
    </Sheet>
  )
}

function Sitemap({ p, at }) {
  return (
    <Sheet p={p} section="Sitemap by role">
      <h1 className="bk-title">Sitemap by role</h1>
      <p className="bk-lead">Where every screen sits, and how each role reaches it. IDs link to their pages.</p>
      <div className="bk-sitemap">
        {SITEMAP.map((r) => (
          <div key={r.role} className="bk-smcol">
            <div className="bk-smhead">{r.role}</div>
            {r.groups.map(([g, items]) => (
              <div key={g} className="bk-smgroup">
                <h4>{g}</h4>
                <ul>{items.map((it) => <li key={it}><Ids text={it} at={at} /></li>)}</ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Sheet>
  )
}

function Core({ p, at }) {
  const rows = [CORE.slice(0, 6), CORE.slice(6)]
  return (
    <Sheet p={p} section="Core adoption flow & status rules">
      <h1 className="bk-title">Core adoption flow</h1>
      <p className="bk-lead">Section 4 of the proposal, step by step, with the screens that carry each step.</p>
      <div className="bk-core">
        {rows.map((row, ri) => (
          <div className="bk-core-row" key={ri}>
            {row.map(([who, text, refs], i) => {
              const n = ri * 6 + i + 1
              return (
                <Fragment key={n}>
                  {i > 0 && <div className="bk-core-arrow">→</div>}
                  <div className="bk-core-card">
                    <div className="row between"><b className="bk-core-n">{n}</b><span className={`bk-chip ${who === 'System' ? '' : 'dark'}`}>{who}</span></div>
                    <p>{text}</p>
                    <span className="bk-core-refs"><Ids text={refs} at={at} /></span>
                  </div>
                </Fragment>
              )
            })}
          </div>
        ))}
      </div>
      <h3 className="bk-h3" style={{ marginTop: 22 }}>Status rules (Section 5)</h3>
      <div className="bk-chains">
        {CHAINS.map((c) => (
          <div key={c.title} className="bk-chain-row">
            <div className="bk-chain-title">{c.title}</div>
            <div className="bk-chain">
              {c.main.map((s, i) => (
                <Fragment key={s}>
                  {i > 0 && <span className="bk-chain-arrow">→</span>}
                  <span className={`bk-state ${i === c.main.length - 1 ? 'final' : ''}`}>{s}</span>
                </Fragment>
              ))}
            </div>
            <ul className="bk-chain-side">{c.side.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

function NavSheet({ p }) {
  return (
    <Sheet p={p} section="Navigation elements">
      <h1 className="bk-title">Navigation elements</h1>
      <div className="bk-navgrid">
        <div className="bk-col">
          <h3 className="bk-h3">Visitor top bar</h3>
          <div className="bk-navdemo"><Demo role="guest" url="/"><GuestNav /></Demo></div>
          <h3 className="bk-h3">Member top bar · Pet (Home active)</h3>
          <div className="bk-navdemo"><Demo role="pet" url="/feed"><TopNav /></Demo></div>
          <h3 className="bk-h3">Member top bar · Human (Pets for You active)</h3>
          <div className="bk-navdemo"><Demo role="human" url="/matches"><TopNav /></Demo></div>
          <p className="bk-p">Open menus are shown full-screen on <b>GN-01</b> (Me menu) and <b>NT-01</b> (Alerts). Pending, denied and suspended accounts get a minimal bar with only Help center and Log out (AU-18).</p>
          <h3 className="bk-h3">In-page navigation</h3>
          <Demo role="human" url="/requests">
            <div className="bk-navparts">
              <div><span className="bk-cap">Tabs with counts</span><Tabs tabs={['New (1)', 'In progress (2)', 'Closed (2)']} value="In progress (2)" onChange={() => {}} /></div>
              <div><span className="bk-cap">Status stepper</span><Stepper steps={['Sent', 'Approved', 'Meet Scheduled', 'Awaiting Decision', 'Adopted — Hired']} current={2} /></div>
              <div className="row" style={{ gap: 40 }}>
                <div><span className="bk-cap">Back link</span><a className="small" href="#back">← All requests</a></div>
                <div><span className="bk-cap">Pagination</span><Pagination /></div>
                <div><span className="bk-cap">Filter chips</span><div className="row small"><span className="tag">Dog ✕</span><span className="tag">Metro Manila ✕</span></div></div>
              </div>
            </div>
          </Demo>
        </div>
        <div className="bk-col">
          <h3 className="bk-h3">Admin sidebar</h3>
          <div className="bk-sidedemo"><Demo role="admin" url="/admin/verification"><AdminSidebar /></Demo></div>
        </div>
      </div>
    </Sheet>
  )
}

function NavSheetMobile({ p }) {
  const bars = [
    ['Visitor top bar', 'guest', '/', <GuestNav key="g" />],
    ['Member top bar · Pet', 'pet', '/feed', <TopNav key="p" />],
    ['Member top bar · Human', 'human', '/matches', <TopNav key="h" />],
    ['Admin tab strip (sidebar on desktop)', 'admin', '/admin/verification', <AdminSidebar key="a" />],
  ]
  return (
    <Sheet p={p} section="Navigation elements">
      <h1 className="bk-title">Navigation elements · phone</h1>
      <p className="bk-lead">On a 390 px screen the top bar keeps icon tabs with short labels and moves search to its own row. The admin sidebar becomes a wrapped tab strip.</p>
      <div className="bk-navphones">
        {bars.map(([title, role, url, el]) => (
          <div key={title}>
            <h3 className="bk-h3">{title}</h3>
            <div className={`bk-navdemo m-frame`} style={{ width: 392 }}><Demo role={role} url={url}>{el}</Demo></div>
          </div>
        ))}
      </div>
      <p className="bk-p" style={{ marginTop: 18 }}>Open menus are shown full-screen on <b>GN-01</b> (Me menu) and <b>NT-01</b> (Alerts); on phones they open as full-width panels under the top bar. Pending, denied and suspended accounts get a minimal bar with only Help center and Log out (AU-18).</p>
      <h3 className="bk-h3">In-page navigation</h3>
      <Demo role="human" url="/requests">
        <div className="bk-navparts m-frame" style={{ width: 392 * 2 + 40 }}>
          <div><span className="bk-cap">Tabs with counts (scroll sideways)</span><Tabs tabs={['New (1)', 'In progress (2)', 'Closed (2)']} value="In progress (2)" onChange={() => {}} /></div>
          <div><span className="bk-cap">Status stepper</span><Stepper steps={['Sent', 'Approved', 'Meet Scheduled', 'Awaiting Decision', 'Adopted — Hired']} current={2} /></div>
          <div className="row" style={{ gap: 40 }}>
            <div><span className="bk-cap">Back link</span><a className="small" href="#back">← All requests</a></div>
            <div><span className="bk-cap">Pagination</span><Pagination /></div>
          </div>
        </div>
      </Demo>
    </Sheet>
  )
}

function Cell({ title, children, className = '' }) {
  return (
    <div className={`bk-cell ${className}`}>
      <span className="bk-cap">{title}</span>
      {children}
    </div>
  )
}

function Kit1({ p }) {
  return (
    <Sheet p={p} section="UI kit · controls & forms">
      <h1 className="bk-title">UI kit · controls &amp; forms</h1>
      <Demo>
        <div className="bk-kit">
          <Cell title="Buttons">
            <div className="row"><Btn variant="primary">Primary</Btn><Btn>Secondary</Btn><Btn variant="ghost">Tertiary</Btn></div>
            <div className="row"><Btn variant="primary" small>Small</Btn><Btn small>Small</Btn><Btn disabled>Disabled</Btn></div>
          </Cell>
          <Cell title="Text field · select">
            <Field label="Email" placeholder="you@email.com" hint="Helper text sits under the field." />
            <Field label="Species" as="select" options={['Dog', 'Cat', 'Other']} />
          </Cell>
          <Cell title="Text area · locked field">
            <Field label="Cover letter" as="textarea" rows={2} placeholder="Write in first person…" />
            <Field label="Name" defaultValue="Mochi" locked />
          </Cell>
          <Cell title="File upload">
            <Field label="Valid ID" as="file" placeholder="ID photo" />
            <div className="row"><Ph w={90} h={60} label="Uploaded" /><Ph w={90} h={60} label="Uploaded" /></div>
          </Cell>
          <Cell title="Choice chips">
            <Choice label="Single choice" options={['Relaxed', 'Moderate', 'Active']} initial={['Active']} />
            <Choice label="Multiple choice" multi options={['Playful', 'Calm', 'Loyal', 'Curious']} initial={['Playful', 'Loyal']} />
          </Cell>
          <Cell title="Toggle · checkbox">
            <Toggle on onChange={() => {}} label="Open to Adopt (on)" />
            <Toggle on={false} onChange={() => {}} label="Open to Adopt (off)" />
            <Check label="I agree to the Terms and Community Guidelines" defaultChecked />
          </Cell>
          <Cell title="Radio cards">
            <Radios name="kit" options={[['Remove the content', 'Can be restored later'], ['Suspend the account', 'Owner sees the reason']]} />
          </Cell>
          <Cell title="Tabs · stepper">
            <Tabs tabs={['All', 'Requests', 'Meet & Greets']} value="All" onChange={() => {}} />
            <Stepper steps={['Account', 'Details', 'Photo', 'ID', 'Review']} current={2} />
          </Cell>
          <Cell title="Search · pagination">
            <input className="search" placeholder="Search pets, people, posts" />
            <Pagination />
          </Cell>
        </div>
      </Demo>
    </Sheet>
  )
}

function Kit2({ p }) {
  return (
    <Sheet p={p} section="UI kit · content & feedback">
      <h1 className="bk-title">UI kit · content &amp; feedback</h1>
      <Demo>
        <div className="bk-kit2">
          <div className="bk-col">
            <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <Cell title="Match card · pet"><div style={{ width: 250 }}><MatchCard item={pets[0]} kind="pet" onWhy={() => {}} actions={<><Btn small variant="primary">View résumé</Btn><Btn small>Bookmark</Btn></>} /></div></Cell>
              <Cell title="Match card · home"><div style={{ width: 250 }}><MatchCard item={homes[0]} kind="home" actions={<Btn small variant="primary">View home</Btn>} /></div></Cell>
            </div>
            <Cell title="Status badges">
              <div className="bk-badges">
                <b>Account</b><div className="row">{['Pending Verification', 'Active', 'Denied', 'Suspended', 'Deactivated'].map((s) => <Badge key={s}>{s}</Badge>)}</div>
                <b>Pet</b><div className="row">{['Draft', 'Looking for a Home', 'In Process'].map((s) => <Badge key={s}>{s}</Badge>)}<Badge solid>Hired</Badge></div>
                <b>Request</b><div className="row">{['Sent', 'On Hold', 'Approved', 'Meet Scheduled', 'Awaiting Decision', 'Declined', 'Not Adopted', 'Withdrawn', 'Expired'].map((s) => <Badge key={s}>{s}</Badge>)}<Badge solid>Adopted</Badge></div>
                <b>Human</b><div className="row"><Badge>Open to Adopt</Badge><Badge solid>Furparent</Badge></div>
                <b>Post</b><div className="row">{['For Hire', 'Update', 'Post', 'Adoption Story'].map((s) => <Badge key={s}>{s}</Badge>)}<Badge solid>Hired</Badge></div>
              </div>
            </Cell>
          </div>
          <div className="bk-col">
            <Cell title="Post card"><div style={{ width: 520 }}><PostCard post={{ ...posts[0], img: false }} /></div></Cell>
            <Cell title="Dialog anatomy">
              <ModalBox title="Withdraw your request?" sub="Title, optional subtitle and close button" width={500}
                footer={<><Btn>Cancel</Btn><Btn variant="primary">Confirm</Btn></>}>
                <p className="small">Body: explanation, fields or choices. The footer holds the actions — primary on the right.</p>
              </ModalBox>
            </Cell>
          </div>
          <div className="bk-col">
            <Cell title="Feedback">
              <Toast className="static">Saved to Bookmarks.</Toast>
              <Alert><b>That email and password don’t match.</b> Try again.</Alert>
              <div className="row"><Tag>Playful</Tag><Tag>Loyal</Tag><Tag>✓ Species accepted</Tag></div>
              <div><span className="small muted">Match meter</span><Meter value={92} /></div>
            </Cell>
            <Cell title="Empty state"><div className="bk-empty"><Empty title="No saved homes yet" body="Tap Bookmark on any Home Profile to keep it here." action={<Btn small variant="primary">See Homes for You</Btn>} /></div></Cell>
            <Cell title="Thread · timeline">
              <div className="thread" style={{ maxHeight: 'none' }}>
                <div className="bubble sys">Ana approved the request. Thread opened.</div>
                <div className="bubble">Hi Mochi! Saturday works for us.</div>
                <div className="bubble mine">Booked Saturday 10 AM!</div>
              </div>
              <ol className="timeline small"><li><b>Sep 20</b> · Request sent</li><li><b>Sep 22</b> · Approved</li></ol>
            </Cell>
          </div>
        </div>
      </Demo>
    </Sheet>
  )
}

function Flows({ rows }) {
  return (
    <div className="bk-flows">
      {rows.map((r, i) => (
        <div className="bk-frow" key={i}>
          <div className="bk-lane">{r.lane}</div>
          <div className="bk-chain-flow">
            {r.steps.map(([id, label, via, kind], j) => (
              <Fragment key={j}>
                {j > 0 && (via === 'or'
                  ? <div className="bk-or">or</div>
                  : <div className="bk-arrow">{via && <span>{via}</span>}</div>)}
                <div className={`bk-node ${kind || 'screen'}`}>
                  {id && <b>{id}</b>}
                  <span>{label}</span>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FlowLegend() {
  return (
    <div className="bk-flow-legend">
      <span><i className="bk-node screen" />Screen</span>
      <span><i className="bk-node dialog" />Dialog, menu or overlay</span>
      <span><i className="bk-node system" />System event / result</span>
      <span><i className="bk-node end" />End point</span>
      <span><i className="bk-arrow-mini" />User action (label above)</span>
    </div>
  )
}

function ModuleSheet({ p, at }) {
  const m = p.m
  const list = SCREENS.filter((s) => s.module === m.key)
  const frs = [...new Set(list.flatMap((s) => s.fr))].sort((a, b) => a.slice(2) - b.slice(2))
  return (
    <Sheet p={p} section={`Module ${m.no} · ${m.name}`} className="bk-module">
      <div className="bk-mod">
        <div className="bk-mod-main">
          <div className="bk-kicker">Module {String(m.no).padStart(2, '0')} · IDs {m.prefix}-xx</div>
          <h1 className="bk-title big">{m.name}</h1>
          <p className="bk-lead">{m.desc}</p>
          <h3 className="bk-h3">User flows</h3>
          <Flows rows={FLOWS[m.key]} />
          <FlowLegend />
        </div>
        <aside className="bk-mod-side">
          <h3 className="bk-h3">Who does what (Section 9)</h3>
          <table className="bk-table">
            <tbody>{Object.entries(m.roles).map(([r, v]) => <tr key={r}><th>{r}</th><td>{v}</td></tr>)}</tbody>
          </table>
          <h3 className="bk-h3">Requirements covered</h3>
          <div className="bk-frs">{frs.length ? frs.map((f) => <span key={f}>{f}</span>) : <span>Account settings (no FR)</span>}</div>
          <h3 className="bk-h3">Screens, dialogs &amp; states ({list.length})</h3>
          <ol className={`bk-index-list ${list.length > 20 ? 'dense' : ''}`}>
            {list.map((s) => (
              <li key={s.id}>
                <a className="bk-link" href={`#p${at[s.id]}`}>
                  <b>{s.id}</b><span>{s.title}{s.kind !== 'Screen' && <em> · {s.kind}</em>}</span><i>{at[s.id]}</i>
                </a>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </Sheet>
  )
}

function ScreenSheet({ p }) {
  const { spec, scale, segs, segCount: n, part, parts, fullH } = p
  const m = modOf(spec)
  const first = part === 1
  const caption = (s) => (MOBILE && n > 1 ? `Screen ${s.i + 1} of ${n} · ${s.i === 0 ? 'top of page' : 'scrolled down'}` : null)
  return (
    <Sheet p={p} section={m ? `Module ${m.no} · ${m.name}` : 'Navigation & global screens'}>
      <div className="bk-ss">
        <div className={`bk-shot ${MOBILE ? 'bk-phones' : ''}`}>
          {segs.map((s) => <Frame key={s.i} spec={spec} scale={scale} offset={s.offset} segH={s.h} caption={caption(s)} />)}
          {!MOBILE && parts > 1 && <div className="bk-part">Part {part} of {parts} — {part < parts ? 'the page continues on the next sheet' : 'continued from the previous sheet'}</div>}
        </div>
        <aside className="bk-notes">
          <div className="bk-sid">{spec.id}</div>
          <h1>{spec.title}{parts > 1 ? ` (${part}/${parts})` : ''}</h1>
          <div className="bk-chips">
            <span className="bk-chip dark">{ROLE_LABEL[spec.role]}</span>
            <span className="bk-chip">{spec.kind}</span>
            {spec.acct !== 'Active' && <span className="bk-chip">{spec.acct}</span>}
          </div>
          {first ? (
            <>
              <p className="bk-purpose">{spec.purpose}</p>
              <NoteList title="Key UI elements" items={spec.ui} />
              <NoteList title="Interactions & flow" items={spec.actions} />
              <NoteList title="Rules shown" items={spec.rules} />
            </>
          ) : (
            <p className="bk-purpose">Lower part of the same page. The notes are on the previous sheet.</p>
          )}
          <div className="bk-foot">
            {spec.fr.length > 0 && <div className="bk-frs">{spec.fr.map((f) => <span key={f}>{f}</span>)}</div>}
            <span>{spec.viewport ? `Viewport · ${DEV.w} × ${DEV.h}` : `Full page · ${DEV.w} × ${fullH}${MOBILE ? ` · ${n} screen${n > 1 ? 's' : ''} tall` : ''}`} · shown at {Math.round(scale * 100)}%</span>
          </div>
        </aside>
      </div>
    </Sheet>
  )
}

const TRACE_PARTS = [
  { title: 'Human / Furparent · FR1–FR17', from: 0, to: 17 },
  { title: 'Pet account · FR18–FR32', from: 17, to: 32 },
  { title: 'Admin · FR33–FR41 and non-functional requirements', from: 32, to: 41 },
]

function Trace({ p, at }) {
  const part = TRACE_PARTS[p.part]
  return (
    <Sheet p={p} section="Appendix A · Requirements traceability">
      <h1 className="bk-title">Requirements traceability · {part.title}</h1>
      <table className="bk-table bk-trace">
        <thead><tr><th style={{ width: 80 }}>ID</th><th style={{ width: 720 }}>Requirement (Section 7)</th><th>Designed in</th></tr></thead>
        <tbody>
          {FRS.slice(part.from, part.to).map(([id, , text]) => (
            <tr key={id}>
              <td><b>{id}</b></td>
              <td>{text}</td>
              <td><div className="bk-hits">{SCREENS.filter((s) => s.fr.includes(id)).map((s) => <a key={s.id} className="bk-link" href={`#p${at[s.id]}`}>{s.id}</a>)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.part === 2 && (
        <>
          <h3 className="bk-h3" style={{ marginTop: 24 }}>Non-functional requirements (Section 8) — how the UI supports them</h3>
          <table className="bk-table bk-trace">
            <thead><tr><th style={{ width: 80 }}>ID</th><th style={{ width: 160 }}>Quality</th><th style={{ width: 560 }}>In these designs</th><th>Where</th></tr></thead>
            <tbody>
              {NFRS.map(([id, q, how, where]) => (
                <tr key={id}><td><b>{id}</b></td><td>{q}</td><td>{id === 'NFR8' && MOBILE ? 'This document shows the phone layouts; the desktop edition shows the same screens at 1440 × 900.' : how}</td><td><Ids text={where} at={at} /></td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Sheet>
  )
}

function Index({ p, at }) {
  return (
    <Sheet p={p} section="Appendix B · Screen index">
      <h1 className="bk-title">Screen index</h1>
      <p className="bk-lead">All {SCREENS.length} screens, dialogs, menus and states, in order. Click an ID to jump to its page.</p>
      <ol className="bk-allindex">
        {SCREENS.map((s) => (
          <li key={s.id}>
            <a className="bk-link" href={`#p${at[s.id]}`}><b>{s.id}</b><span>{s.title}</span><i>{at[s.id]}</i></a>
          </li>
        ))}
      </ol>
    </Sheet>
  )
}

function PageView({ p, at }) {
  switch (p.t) {
    case 'cover': return <Cover p={p} />
    case 'contents': return <Contents p={p} at={at} />
    case 'guide': return <Guide p={p} />
    case 'sitemap': return <Sitemap p={p} at={at} />
    case 'core': return <Core p={p} at={at} />
    case 'nav': return MOBILE ? <NavSheetMobile p={p} /> : <NavSheet p={p} />
    case 'kit1': return <Kit1 p={p} />
    case 'kit2': return <Kit2 p={p} />
    case 'module': return <ModuleSheet p={p} at={at} />
    case 'screen': return <ScreenSheet p={p} />
    case 'trace': return <Trace p={p} at={at} />
    case 'index': return <Index p={p} at={at} />
    default: return null
  }
}

export default function Book() {
  const [heights, setHeights] = useState(null)
  const pages = useMemo(() => (heights ? planPages(heights) : null), [heights])
  const at = useMemo(() => (pages ? pageIndex(pages) : {}), [pages])

  useEffect(() => {
    if (!pages) return
    // The prototype's own links would point at localhost in the PDF; keep only the book's page links.
    document.querySelectorAll('.bk-root a[href]:not(.bk-link)').forEach((a) => a.removeAttribute('href'))
    window.__bookInfo = { pages: pages.length, screens: SCREENS.length, heights }
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true }))
  }, [pages, heights])

  if (!pages) return <Measure onDone={setHeights} />
  return <div className="bk-root">{pages.map((p) => <PageView key={p.n} p={p} at={at} />)}</div>
}
