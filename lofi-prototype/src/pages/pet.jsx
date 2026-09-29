import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { findHome, invites } from '../data'
import { Btn, Card, Choice, Field, Modal, Note, PageHead, Ph, Wizard, useInit, useModal, useToast } from '../components/ui'

/* ---------------- Send adoption request ---------------- */
export function Apply() {
  const { homeId } = useParams()
  const home = findHome(homeId) || findHome('cruz')
  const [sent, setSent] = useState(!!useInit('sent'))
  if (sent) {
    return (
      <div className="container narrow">
        <Card>
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '24px 0' }}>
            <Ph w={80} h={80} round label="Sent" />
            <span className="badge">Sent</span>
            <h1>Request sent to {home.name}</h1>
            <p className="muted">{home.name} has 14 days to respond. You’ll get a notification when they approve or decline.</p>
            <dl className="kv small" style={{ textAlign: 'left' }}><dt>Open requests</dt><dd>3 of 3 (limit reached)</dd><dt>Expires</dt><dd>Oct 12, 2026 if there’s no response</dd></dl>
            <div className="row"><Btn variant="primary" to="/requests">Track my requests</Btn><Btn to="/matches">Back to Homes for You</Btn></div>
          </div>
        </Card>
      </div>
    )
  }
  return (
    <div className="container narrow">
      <p className="small" style={{ marginBottom: 12 }}><Link to={`/home/${home.id}`}>← Back to {home.name}’s Home Profile</Link></p>
      <PageHead title="Send an adoption request" sub="Like a job application: a short cover letter plus your résumé." />
      <div className="stack">
        <Card>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Ph w={56} h={56} round label="" />
            <div className="grow"><strong>To: {home.name}</strong><div className="small muted">{home.city} · {home.homeType} · {home.household}</div></div>
            <b>{home.match}% match</b>
          </div>
        </Card>
        <Card>
          <div className="stack">
            <Field label="Cover letter — “Why I’d fit your home”" as="textarea" rows={5} placeholder="Write in first person, as the pet…" hint="Tip: mention your match reasons, e.g. your energy level and their activity. 50–600 characters." />
            <Field label="Caretaker’s notes" as="textarea" rows={3} placeholder="Anything the human should know: routines, quirks, pickup details…" />
            <div className="field">
              <span>Attached automatically</span>
              <div className="row">
                <div className="card row attach"><Ph w={32} h={32} label="" /><span>Mochi’s résumé</span></div>
                <div className="card row attach"><Ph w={32} h={32} label="" /><span>Health summary</span></div>
              </div>
            </div>
            <p className="small muted">This will be open request 3 of 3. Only one request per pet + home at a time.</p>
            <div className="row between"><Btn to={`/home/${home.id}`}>Cancel</Btn><Btn variant="primary" onClick={() => setSent(true)}>Send request</Btn></div>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ---------------- Invites to Apply ---------------- */
export function Invites() {
  const [hidden, setHidden] = useState([])
  const [toastEl, toast] = useToast()
  const list = invites.filter((i) => !hidden.includes(i.id))
  return (
    <div className="container narrow">
      <PageHead title="Invites to Apply" sub="Humans who liked your résumé and want you to apply. Applying is always your choice." />
      <div className="stack">
        {list.length === 0 && <Card><p className="muted">No invites right now.</p></Card>}
        {list.map((inv) => {
          const h = findHome(inv.home)
          const cooldown = h.id === 'garcia'
          return (
            <Card key={inv.id}>
              <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <Ph w={56} h={56} round label="" />
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <Link to={`/home/${h.id}`}><strong>{h.name}</strong></Link>
                  <span className="small muted">{h.city} · {h.homeType} · {h.household} · {h.match}% match · {inv.when}</span>
                  {inv.note && <p className="small quote">“{inv.note}”</p>}
                  {cooldown && <span className="small muted">You can apply to this home again on Oct 10.</span>}
                </div>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Btn small to={`/home/${h.id}`}>View home</Btn>
                  {cooldown ? <Btn small disabled>Apply</Btn> : <Btn variant="primary" small to={`/apply/${h.id}`}>Apply</Btn>}
                  <Btn small variant="ghost" onClick={() => { setHidden([...hidden, inv.id]); toast('dismissed') }}>Dismiss</Btn>
                </div>
              </div>
            </Card>
          )
        })}
        <Note>An invite doesn’t count toward the 3-request limit until the pet actually applies.</Note>
      </div>
      {toastEl}
    </div>
  )
}

/* ---------------- Résumé editor ---------------- */
const resumeSteps = ['Basics', 'Photos', 'About & temperament', 'Skills & compatibility', 'Health', 'Review & publish']

function ResumeStep({ i, onAddPhoto }) {
  return [
    <div className="form-grid">
      <Field label="Name" defaultValue="Mochi" locked />
      <Field label="Species" defaultValue="Dog" locked />
      <Field label="Breed" defaultValue="Aspin" locked />
      <Field label="Sex" as="select" options={['Female', 'Male']} />
      <Field label="Size" as="select" options={['Medium', 'Small', 'Large']} />
      <Field label="Approximate age" defaultValue="2 years" locked />
      <Field label="Currently at" defaultValue="Happy Paws Rescue (foster home)" hint="Shown on your résumé, like a current workplace." />
      <Field label="City / Province" defaultValue="Quezon City, Metro Manila" />
    </div>,
    <>
      <p className="small muted">Add 3–10 clear photos. The first photo is your profile picture.</p>
      <div className="photo-grid">
        {[1, 2, 3].map((n) => <div key={n} className="stack-sm"><Ph h={110} label={n === 1 ? 'Profile photo' : `Photo ${n}`} /><span className="small muted">{n === 1 ? 'Main · ' : ''}Remove · Move</span></div>)}
        <button type="button" className="upload" style={{ height: 110 }} onClick={onAddPhoto}>+ Add photo</button>
      </div>
      <Field label="Cover photo" as="file" placeholder="cover photo" />
    </>,
    <>
      <Field label="Bio (first person)" as="textarea" defaultValue="Hi, I'm Mochi! I was found near a jeepney terminal and now I'm fostered by Happy Paws. I love long walks, belly rubs…" hint="Write as the pet. 50–600 characters." />
      <Choice label="Temperament tags (pick up to 5)" multi options={['Playful', 'Calm', 'Loyal', 'Curious', 'Gentle', 'Shy', 'Cuddly', 'Independent', 'Chatty']} initial={['Playful', 'Loyal', 'Curious', 'Gentle']} />
      <Choice label="Energy level" options={['Low', 'Medium', 'High']} initial={['High']} />
    </>,
    <>
      <Choice label="Skills (trained behaviors)" multi options={['Sit & stay', 'Leash-trained', 'Potty-trained', 'Crate-trained', 'Litter-trained', 'Comes when called']} initial={['Sit & stay', 'Leash-trained', 'Potty-trained', 'Crate-trained']} />
      <div className="form-grid">
        <Choice label="Good with kids" options={['Yes', 'No', 'Unknown']} initial={['Yes']} />
        <Choice label="Good with dogs" options={['Yes', 'No', 'Unknown']} initial={['Yes']} />
        <Choice label="Good with cats" options={['Yes', 'No', 'Unknown']} initial={['Unknown']} />
        <Choice label="Can be left alone" options={['Up to 2 hrs', 'Up to 4 hrs', 'Up to 6 hrs', '8+ hrs']} initial={['Up to 6 hrs']} />
      </div>
      <Choice label="Space needs" options={['Apartment OK', 'Needs a yard or daily walks', 'Ground floor']} initial={['Needs a yard or daily walks']} />
      <Choice label="Owner experience needed" options={['First-time OK', 'Some experience', 'Experienced only']} initial={['First-time OK']} />
    </>,
    <>
      <Field label="Health & vet notes" as="textarea" defaultValue="Fully vaccinated (Aug 2026), dewormed, spayed." />
      <Choice label="Special needs or medical care" options={['None', 'Daily meds', 'Special diet', 'Mobility support']} multi initial={['None']} />
      <Field label="Vet records (optional)" as="file" placeholder="vet record" hint="Visible to humans only after a request is approved." />
    </>,
    <>
      <Card><div className="row" style={{ flexWrap: 'nowrap' }}><Ph w={80} h={80} round label="" /><div className="stack-sm"><strong>Mochi</strong><span className="small muted">Aspin · 2 yrs · Medium · Quezon City</span><span className="small">3 photos · 4 temperament tags · 4 skills · Health notes ✓</span></div></div></Card>
      <div className="checklist small"><span>✓ Basics</span><span>✓ Photos (3)</span><span>✓ Bio & temperament</span><span>✓ Compatibility</span><span>✓ Health</span></div>
      <p className="small muted">Publishing moves your status from Draft to Looking for a Home automatically and posts a “For Hire” update to the feed.</p>
    </>,
  ][i]
}

export function ResumeEditor() {
  const [done, setDone] = useState(!!useInit('done'))
  const [modal, setModal] = useModal()
  const [toastEl, toast] = useToast()
  const nav = useNavigate()
  const close = () => setModal(null)
  if (done) {
    return (
      <div className="container narrow">
        <Card>
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '24px 0' }}>
            <span className="badge">Draft → Looking for a Home</span>
            <h1>Your résumé is live!</h1>
            <p className="muted">You now appear in search and in humans’ Pets for You. A “For Hire” post was added to the feed.</p>
            <div className="row"><Btn variant="primary" to="/matches">See Homes for You</Btn><Btn to="/me">View my résumé</Btn><Btn variant="ghost" to="/feed">See my For Hire post</Btn></div>
          </div>
        </Card>
      </div>
    )
  }
  return (
    <div className="container narrow">
      <PageHead title="Edit résumé" sub="Fields marked Locked were verified by an admin. Everything else goes live when you save." actions={<Btn small variant="ghost" onClick={() => nav('/me')}>Preview résumé</Btn>} />
      <Card><Wizard steps={resumeSteps} render={(i) => <ResumeStep i={i} onAddPhoto={() => setModal('photo')} />} finish={() => setDone(true)} finishLabel="Publish résumé" saveDraft /></Card>
      {modal === 'photo' && (
        <Modal title="Add a photo" onClose={close} width={600}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => { close(); toast('photo') }}>Add photo</Btn></>}>
          <div className="upload" style={{ padding: 28 }}>Drag a photo here or <u>browse</u><div className="small">JPG or PNG · max 5 MB · images are compressed automatically</div></div>
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <Ph w={260} h={180} label="Crop preview" />
            <div className="stack grow">
              <Field label="Caption (optional)" placeholder="e.g. Beach day with my foster" />
              <Choice label="Use as" options={['Gallery photo', 'Profile photo']} initial={['Gallery photo']} />
            </div>
          </div>
        </Modal>
      )}
      {toastEl}
    </div>
  )
}
