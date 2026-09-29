import { useProto } from '../proto'
import { findHome, findPet, me, requests } from '../data'
import { Badge, Btn, Field, Meter, Modal, Ph, Radios } from './ui'

export function ConfirmDialog({ title, sub, children, confirm = 'Confirm', onClose, onConfirm, width }) {
  return (
    <Modal title={title} sub={sub} onClose={onClose} width={width}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={onConfirm}>{confirm}</Btn></>}>
      {children}
    </Modal>
  )
}

const REPORT_REASONS = [
  ['Fake or misleading profile', 'Photos or details that aren’t real'],
  ['Selling or trading animals', 'Pawfolio is for adoption only'],
  ['Harassment or hate', 'Insults, threats, or targeting someone'],
  ['Animal welfare concern', 'Signs of neglect or abuse'],
  ['Spam or scam', 'Ads, links, or asking for money'],
  ['Something else', 'Tell us in the details'],
]

export function ReportDialog({ target, onClose, onSubmit }) {
  return (
    <Modal title={`Report ${target}`} sub="Reports are confidential. An admin reviews every report." onClose={onClose} width={560}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={onSubmit}>Submit report</Btn></>}>
      <strong className="small">Why are you reporting this?</strong>
      <Radios name="reason" options={REPORT_REASONS} />
      <Field label="Details (optional)" as="textarea" rows={3} placeholder="Anything that helps the admin understand the problem" />
    </Modal>
  )
}

const CRITERIA = [
  ['Activity level ↔ energy level', 20],
  ['Hours away ↔ time it can be left alone', 15],
  ['Home type & outdoor space ↔ space needs', 15],
  ['Pet experience ↔ experience it needs', 15],
  ['Preferred size & age ↔ size & age', 15],
  ['Kids & other pets ↔ compatibility tags', 10],
  ['Special needs ↔ medical care', 10],
]

export function breakdown(score) {
  const pts = CRITERIA.map(([, w]) => Math.round((w * score) / 100))
  pts[0] += score - pts.reduce((a, b) => a + b, 0)
  return CRITERIA.map(([label, w], i) => ({ label, w, p: Math.min(w, pts[i]) }))
}

export function MatchBreakdown({ item, onClose }) {
  return (
    <Modal title={`${item.match}% match with ${item.name}`} sub="The same score is shown to both sides. It updates when the quiz or résumé changes." onClose={onClose} width={640}
      footer={<Btn variant="primary" onClick={onClose}>Got it</Btn>}>
      <div className="stack-sm">
        <strong className="small">Step 1 — Dealbreakers (all passed)</strong>
        <div className="row small">
          {['Species accepted', 'OK with kids at home', 'OK with pets at home', 'Same province'].map((d) => <span key={d} className="tag">✓ {d}</span>)}
        </div>
      </div>
      <div className="stack-sm">
        <strong className="small">Step 2 — Weighted score</strong>
        {breakdown(item.match).map((r) => (
          <div key={r.label} className="score-row">
            <span className="small">{r.label}</span>
            <Meter value={(r.p / r.w) * 100} />
            <b className="small">{r.p} / {r.w}</b>
          </div>
        ))}
        <div className="score-row total"><strong>Total</strong><span /><strong>{item.match} / 100</strong></div>
      </div>
      <div className="stack-sm">
        <strong className="small">Top reasons</strong>
        <ul className="small reasons">{item.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
    </Modal>
  )
}

export function PhotoViewer({ name, onClose }) {
  return (
    <div className="modal-backdrop dark" onClick={onClose}>
      <div className="viewer" onClick={(e) => e.stopPropagation()}>
        <div className="row between viewer-top">
          <span>{name} · Photo 1 of 4</span>
          <button type="button" className="x light" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="row" style={{ flexWrap: 'nowrap', justifyContent: 'center' }}>
          <button type="button" className="nav-arrow" aria-label="Previous">‹</button>
          <Ph w={760} h={540} label="Full-size photo" />
          <button type="button" className="nav-arrow" aria-label="Next">›</button>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          {[1, 2, 3, 4].map((n) => <Ph key={n} w={76} h={56} label="" className={n === 1 ? 'sel' : ''} />)}
        </div>
      </div>
    </div>
  )
}

export function AdoptionDetails({ pet, onClose }) {
  const req = requests.find((r) => r.pet === pet.id && r.status === 'Adopted')
  const home = findHome(pet.hiredBy)
  return (
    <Modal title={`Adoption details · ${pet.name}`} sub={`Hired by ${home.name} on ${pet.hiredOn}`} onClose={onClose} width={640}
      footer={<><Btn to={`/requests/${req.id}`}>Open request record</Btn><Btn variant="primary" onClick={onClose}>Close</Btn></>}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <Ph w={56} h={56} round label="" />
        <div className="grow"><strong>{pet.name}</strong><div className="small muted">{pet.species} · {pet.breed} · Alumni</div></div>
        <span className="muted">linked to</span>
        <Ph w={56} h={56} round label="" />
        <div className="grow"><strong>{home.name}</strong><div className="small muted">Furparent · {home.city}</div></div>
      </div>
      <ol className="timeline small">
        <li><b>{req.sent}, 2026</b> · {pet.name} sent an adoption request</li>
        <li><b>Jun 2, 2026</b> · {home.name} approved it</li>
        <li><b>Jun 5, 2026</b> · Meet & Greet confirmed: {req.slot.date}, {req.slot.time}, {req.slot.place}</li>
        <li><b>{pet.hiredOn}</b> · {home.name} chose Adopt — {pet.name} got Hired</li>
      </ol>
      <dl className="kv small"><dt>Days to adoption</dt><dd>15 days</dd><dt>Cover letter</dt><dd>“{req.letter}”</dd></dl>
      <Btn small to="/feed?modal=story">Write an adoption story</Btn>
    </Modal>
  )
}

export function CreatePost({ story, edit, onClose, onPost }) {
  const { role } = useProto()
  const isPet = role === 'pet'
  const author = isPet ? findPet(me.pet) : findHome(me.human)
  const title = edit ? 'Edit post' : story ? 'Write an adoption story' : 'Create a post'
  return (
    <Modal title={title} onClose={onClose} width={640}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={onPost}>{edit ? 'Save' : 'Post'}</Btn></>}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <Ph w={44} h={44} round label="" />
        <div className="grow"><strong>{author.name}</strong><div className="small muted">Visible to everyone on Pawfolio</div></div>
        <Badge>{story ? 'Adoption Story' : isPet ? 'Update' : 'Post'}</Badge>
      </div>
      {story && <Field label="Adopted pet" as="select" options={['Luna — Hired Jun 14, 2026']} />}
      {story && <Field label="Title" placeholder="e.g. How Luna applied to our home" />}
      <Field label={story ? 'Your story' : 'What’s new?'} as="textarea" rows={5}
        defaultValue={edit ? 'How Luna “applied” to our home — and why we said yes.' : undefined}
        placeholder={isPet ? 'Share an update in first person…' : 'Share something with the community…'} />
      <div className="row">
        <Ph w={110} h={80} label="Photo 1" />
        <div className="upload" style={{ padding: '26px 18px' }}>+ Add photos</div>
      </div>
    </Modal>
  )
}
