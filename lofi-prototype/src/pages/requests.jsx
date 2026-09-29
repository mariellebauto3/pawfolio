import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useProto } from '../proto'
import { findHome, findPet, me, requests, slots } from '../data'
import {
  Badge, Btn, Card, Check, Field, Modal, Note, PageHead, Ph, Radios, Stepper, Tabs, useInit, useModal, useToast,
} from '../components/ui'

const CLOSED = ['Adopted', 'Declined', 'Not Adopted', 'Withdrawn', 'Expired']
const STEPS = ['Sent', 'Approved', 'Meet Scheduled', 'Awaiting Decision', 'Adopted — Hired']
const stepIndex = {
  Sent: 0, 'On Hold': 0, Approved: 1, 'Slot Booked': 1, 'Meet Scheduled': 2, 'Awaiting Decision': 3, Adopted: 4,
}
const THREAD_OPEN = ['Approved', 'Slot Booked', 'Meet Scheduled', 'Awaiting Decision', 'Adopted', 'Not Adopted']
const ALL_STATUSES = ['Sent', 'On Hold', 'Approved', 'Slot Booked', 'Meet Scheduled', 'Awaiting Decision', 'Adopted', 'Declined', 'Not Adopted', 'Withdrawn', 'Expired']
const label = (s) => (s === 'Slot Booked' ? 'Approved · slot pending' : s)

/* ---------------- List ---------------- */
export function Requests() {
  const { role } = useProto()
  const isPet = role === 'pet'
  const tabs = isPet ? ['Active', 'Closed'] : ['New', 'In progress', 'Closed']
  const [tab, setTab] = useState(useInit('tab', tabs[0]))
  const mine = requests.filter((r) => (isPet ? r.pet === me.pet : r.home === me.human))
  const count = (t) => mine.filter((r) => match(r, t)).length
  function match(r, t) {
    const closed = CLOSED.includes(r.status)
    if (t === 'Closed') return closed
    if (t === 'New') return r.status === 'Sent'
    if (t === 'In progress') return !closed && r.status !== 'Sent'
    return !closed
  }
  const shown = mine.filter((r) => match(r, tab))
  return (
    <div className="container narrow">
      <PageHead
        title={isPet ? 'My adoption requests' : 'Adoption requests'}
        sub={isPet ? 'Requests you sent to homes.' : 'Requests pets sent to you. You receive requests while Open to Adopt is on.'}
        actions={isPet ? <><span className="badge">2 of 3 open · 1 in process</span><Btn small variant="primary" to="/matches">Find homes</Btn></> : <Btn small to="/availability">Manage availability</Btn>}
      />
      <Card>
        <Tabs tabs={tabs.map((t) => `${t} (${count(t)})`)} value={`${tab} (${count(tab)})`} onChange={(t) => setTab(t.replace(/ \(\d+\)$/, ''))} />
        <div className="stack">
          {shown.length === 0 && <p className="muted small">Nothing here.</p>}
          {shown.map((r) => {
            const other = isPet ? findHome(r.home) : findPet(r.pet)
            const needs = !isPet && (r.status === 'Awaiting Decision' || r.status === 'Sent')
            return (
              <div key={r.id} className="row list-row" style={{ flexWrap: 'nowrap' }}>
                <Ph w={52} h={52} round={isPet} label="" />
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <strong>{other.name}</strong>
                  <span className="small muted">{isPet ? `${other.city} · ${other.homeType} · ${other.household}` : `${other.breed} · ${other.age} · ${other.city}`}</span>
                  <span className="small muted">Sent {r.sent} · Updated {r.updated}{r.status === 'Sent' ? ' · Expires in 13 days' : ''}</span>
                </div>
                <Badge solid={needs || r.status === 'Adopted'}>{!isPet && r.status === 'Awaiting Decision' ? 'Decision needed' : !isPet && r.status === 'Sent' ? 'New' : r.status}</Badge>
                <Btn small to={`/requests/${r.id}`}>{needs ? 'Review' : 'Open'}</Btn>
              </div>
            )
          })}
        </div>
      </Card>
      <div style={{ marginTop: 12 }}>
        <Note>Rules: max 3 open requests per pet, only 1 in process. One request per pet + home at a time; 30-day cooldown after Declined / Not Adopted. Sent requests expire after 14 days.</Note>
      </div>
    </div>
  )
}

const DAYS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }

function threadFor(req, pet, home, slot, status) {
  const i = stepIndex[status] ?? (status === 'Not Adopted' ? 3 : 0)
  const day = DAYS[slot.date.slice(0, 3)]
  const helper = (req.caretaker || 'My caretaker').split(' ')[0]
  const all = [
    { from: 'sys', text: `${home.name} approved the request. This thread is now open.` },
    { from: 'human', text: `Hi ${pet.name}! We loved your cover letter. ${day} works best for us.` },
    { from: 'pet', text: `Yay! I booked ${day}, ${slot.time}. ${helper} will bring me along.` },
    { from: 'sys', text: `Meet & Greet confirmed · ${slot.date} · ${slot.time} · ${slot.place}. Contact details are now shared.` },
    { from: 'human', text: pet.id !== 'luna' && home.otherPets.includes('Luna') ? 'See you there! We’ll bring Luna’s blanket so you can get used to her smell.' : 'See you there — can’t wait to meet you!' },
  ]
  if (status === 'Slot Booked') return all.slice(0, 3)
  return all.slice(0, [0, 2, 5, 5, 5][i])
}

/* ---------------- Detail ---------------- */
export function RequestDetail() {
  const { id } = useParams()
  const { role } = useProto()
  const isPet = role === 'pet'
  const req = requests.find((r) => r.id === id) || requests[1]
  const pet = findPet(req.pet)
  const home = findHome(req.home)
  const [status, setStatus] = useState(useInit('status', req.status))
  const [modal, setModal] = useModal()
  const [toastEl] = useToast()
  const [extra, setExtra] = useState([])
  const [draft, setDraft] = useState('')
  const [pick, setPick] = useState(0)
  const slot = req.slot || slots[1]
  const openSlots = slots.filter((s) => !s.taken)
  const close = () => setModal(null)
  const go = (next, m = null) => { setStatus(next); setModal(m) }
  const threadOpen = THREAD_OPEN.includes(status)
  const closed = ['Declined', 'Not Adopted', 'Withdrawn', 'Expired'].includes(status)
  const msgs = [...threadFor(req, pet, home, slot, status), ...extra]
  const mine = isPet ? 'pet' : 'human'
  const send = () => {
    if (!draft.trim()) return
    setExtra([...extra, { from: mine, text: draft }])
    setDraft('')
  }
  const slotOptions = openSlots.map((s) => [`${s.date} · ${s.time}`, s.place])
  const withdraw = <Btn variant="ghost" onClick={() => setModal('withdraw')}>Withdraw request</Btn>

  const petPanel = {
    Sent: <><p>Waiting for {home.name} to respond.</p><p className="small muted">Expires on Oct 11 (14 days) if there’s no response.</p>{withdraw}</>,
    'On Hold': <><p><b>Paused.</b> Another of your requests is in process.</p><p className="small muted">If that one ends without an adoption, this request goes back to Sent with a fresh 14-day clock.</p>{withdraw}</>,
    Approved: (
      <>
        <p><b>Approved!</b> Pick one of {home.name}’s available slots.</p>
        <div className="stack-sm">
          {openSlots.map((s, i) => (
            <label key={i} className={`radio-card ${pick === i ? 'on' : ''}`}>
              <input type="radio" name="slot" checked={pick === i} onChange={() => setPick(i)} />
              <div className="grow"><strong>{s.date} · {s.time}</strong><div className="small muted">{s.place} · {s.kind}</div></div>
            </label>
          ))}
        </div>
        <Btn variant="primary" onClick={() => go('Slot Booked')}>Book this slot</Btn>
        <p className="small muted">Reminder after 7 days without booking. The request expires after 14 days.</p>
        {withdraw}
      </>
    ),
    'Slot Booked': <><p>You booked <b>{slot.date} · {slot.time}</b> at {slot.place}.</p><p className="small muted">Waiting for {home.name} to confirm. They can also propose another time.</p><div className="row"><Btn onClick={() => setModal('reschedule')}>Change slot</Btn>{withdraw}</div></>,
    'Meet Scheduled': <><MeetCard slot={slot} other={home.name} /><div className="row"><Btn onClick={() => setModal('reschedule')}>Reschedule</Btn><Btn variant="ghost" onClick={() => setModal('cancel')}>Cancel meeting</Btn></div>{withdraw}</>,
    'Awaiting Decision': <><p><b>The Meet & Greet time has passed.</b> {home.name} is deciding: Adopt or Decline.</p><p className="small muted">You’ll be notified right away. You can still withdraw before the decision.</p>{withdraw}</>,
    Adopted: <><h2>You got Hired!</h2><p>Your profile is now an alumni profile linked to {home.name}. Your other open requests were closed.</p><Btn variant="primary" onClick={() => setModal('hired')}>See what changed</Btn></>,
  }

  const humanPanel = {
    Sent: (
      <>
        <p>{pet.name} wants to join your home.</p>
        <p className="small muted">Respond by Oct 11 or the request expires.</p>
        <div className="row"><Btn variant="primary" onClick={() => setModal('approve')}>Approve</Btn><Btn onClick={() => setModal('decline')}>Decline</Btn></div>
      </>
    ),
    'On Hold': <p>Paused: {pet.name} is in process with another home. You’ll be notified if it comes back.</p>,
    Approved: <><p>Waiting for {pet.name} to book one of your slots.</p><p className="small muted">You have {openSlots.length} open slots.</p><Btn small to="/availability">Manage availability</Btn></>,
    'Slot Booked': (
      <>
        <p>{pet.name} booked <b>{slot.date} · {slot.time}</b>.</p>
        <p className="small muted">{slot.place}</p>
        <div className="row"><Btn variant="primary" onClick={() => go('Meet Scheduled')}>Confirm</Btn><Btn onClick={() => setModal('propose')}>Propose another time</Btn></div>
      </>
    ),
    'Meet Scheduled': (
      <>
        <MeetCard slot={slot} other={`${pet.name}’s caretaker (${req.caretaker})`} />
        <div className="row"><Btn onClick={() => setModal('propose')}>Reschedule</Btn><Btn variant="ghost" onClick={() => setModal('cancel')}>Cancel meeting</Btn></div>
        <Btn small className="proto-only" onClick={() => go('Awaiting Decision')}>▶ Simulate: meeting time passed</Btn>
      </>
    ),
    'Awaiting Decision': (
      <>
        <p><b>How did the Meet & Greet go?</b></p>
        <p className="small muted">Met on {slot.date} · {slot.time} at {slot.place}.</p>
        <div className="stack-sm">
          <Btn variant="primary" onClick={() => setModal('adopt')}>Adopt {pet.name}</Btn>
          <Btn onClick={() => setModal('notadopted')}>Decline</Btn>
          <Btn variant="ghost" onClick={() => setModal('didnt')}>It didn’t happen</Btn>
        </div>
        <p className="small muted">Reminders continue for 7 days, then the request is flagged for admin follow-up.</p>
      </>
    ),
    Adopted: <><h2>You’re a Furparent!</h2><p>{pet.name} is now Hired and permanently linked to your profile.</p><Btn variant="primary" to={`/pet/${pet.id}`}>View {pet.name}’s alumni profile</Btn></>,
  }

  const panel = closed
    ? <><p>This request is <b>{status}</b>.</p>{['Declined', 'Not Adopted'].includes(status) && <p className="small muted">{isPet ? `You can apply to ${home.name} again after 30 days (Oct 10).` : `${pet.name} can’t send you another request for 30 days.`}</p>}{isPet && <Btn small to="/matches">Find other homes</Btn>}</>
    : (isPet ? petPanel : humanPanel)[status]

  return (
    <div className="container">
      <p className="small" style={{ marginBottom: 12 }}><Link to="/requests">← All requests</Link></p>
      <div className="stack">
        <div className="note row">
          <b>PROTOTYPE</b> Simulate status:
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
            {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <span>Buttons below also move the request forward.</span>
        </div>
        <Card>
          <div className="stack">
            <div className="row between">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Ph w={52} h={52} round label="" />
                <span className="muted">→</span>
                <Ph w={52} h={52} round label="" />
                <div>
                  <h1 style={{ fontSize: 20 }}>{isPet ? `Your request to ${home.name}` : `${pet.name} wants to join your home`}</h1>
                  <span className="small muted">Adoption request · sent {req.sent} · {isPet ? `${home.city} · ${home.homeType}` : `${pet.breed} · ${pet.age} · ${pet.city}`}</span>
                </div>
              </div>
              <Badge solid={status === 'Adopted'}>{label(status)}</Badge>
            </div>
            {closed ? <p className="small muted">Closed on {req.updated}.</p> : <Stepper steps={STEPS} current={stepIndex[status]} />}
          </div>
        </Card>
        <div className="grid2">
          <div className="stack">
            <Card title="Cover letter — “Why I’d fit your home”"><p>{req.letter}</p></Card>
            {req.caretakerNotes && <Card title="Caretaker’s notes"><p>{req.caretakerNotes}</p></Card>}
            <Card title="Attached automatically">
              <div className="row">
                <Link className="card row attach" to={`/pet/${pet.id}`}><Ph w={36} h={36} label="" /><span>{pet.name}’s résumé</span></Link>
                <div className="card row attach"><Ph w={36} h={36} label="" /><span>Health summary</span></div>
                {!isPet && pet.match > 0 && <Link className="card row attach" to={`/pet/${pet.id}?modal=why`}><Ph w={36} h={36} label="" /><span>{pet.match}% match</span></Link>}
              </div>
            </Card>
            <Card title="Request thread" action={threadOpen ? <span className="small muted">Only you and {isPet ? home.name : `${pet.name}’s caretaker`}</span> : null}>
              {threadOpen ? (
                <div className="stack">
                  <div className="thread">
                    {msgs.map((m, i) => (
                      <div key={i} className={`bubble ${m.from === 'sys' ? 'sys' : m.from === mine ? 'mine' : ''}`}>{m.text}</div>
                    ))}
                  </div>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <input className="grow" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Write a message…" />
                    <Btn variant="primary" onClick={send}>Send</Btn>
                  </div>
                </div>
              ) : (
                <p className="muted small">The thread opens once {isPet ? home.name : 'you'} approve{isPet ? 's' : ''} the request.</p>
              )}
            </Card>
          </div>
          <div className="stack">
            <Card title={isPet ? 'Status' : 'Your action'}><div className="stack">{panel}</div></Card>
            <Card title={isPet ? `About ${home.name}` : `About ${pet.name}`}>
              <div className="stack-sm small">
                {isPet
                  ? <><span>{home.homeType} · {home.outdoor}</span><span>{home.household}</span><span>Other pets: {home.otherPets}</span><Link to={`/home/${home.id}`}>View Home Profile</Link></>
                  : <><span>{pet.species} · {pet.breed} · {pet.age}</span><span>Energy {pet.energy} · alone {pet.alone}</span><span>Currently at: {pet.currentlyAt}</span><Link to={`/pet/${pet.id}`}>View full résumé</Link></>}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {modal === 'approve' && (
        <Modal title={`Approve ${pet.name}’s request?`} sub={`${pet.name} moves to In Process and can book one of your Meet & Greet slots.`} onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => go('Approved')}>Approve request</Btn></>}>
          <ul className="small reasons">
            <li>{pet.name}’s other open requests go On Hold.</li>
            <li>A request thread opens between you and {pet.name}’s caretaker.</li>
            <li>You have {openSlots.length} open Meet & Greet slots.</li>
          </ul>
          <Field label={`Message to ${pet.name} (optional)`} as="textarea" rows={3} placeholder="e.g. We’d love to meet you! Pick any slot that works." />
        </Modal>
      )}
      {modal === 'decline' && (
        <Modal title={`Decline ${pet.name}’s request?`} onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => go('Declined')}>Decline request</Btn></>}>
          <strong className="small">Reason (optional)</strong>
          <Radios name="dr" options={['Not the right fit for our home', 'We’re not adopting right now', 'Another pet is joining our family', 'Other']} initial={null} />
          <Field label="Message (optional)" as="textarea" rows={3} placeholder="A kind note helps the pet’s caretaker." />
          <p className="small muted">{pet.name} can’t send you another request for 30 days.</p>
        </Modal>
      )}
      {modal === 'withdraw' && (
        <Modal title={`Withdraw your request to ${home.name}?`} onClose={close}
          footer={<><Btn onClick={close}>Keep request</Btn><Btn variant="primary" onClick={() => go('Withdrawn')}>Withdraw</Btn></>}>
          <p>{home.name} will be notified. {['Approved', 'Slot Booked', 'Meet Scheduled', 'Awaiting Decision'].includes(status) ? 'Your Meet & Greet is cancelled and your On Hold requests go back to Sent.' : 'This frees one of your 3 request slots.'}</p>
          <Field label="Reason (optional)" as="select" options={['Choose a reason', 'Found a better match', 'Caretaker can’t make the schedule', 'Pet is no longer available', 'Other']} />
        </Modal>
      )}
      {modal === 'propose' && (
        <Modal title="Propose another time" sub={`Offer ${pet.name} a different slot. They pick it to rebook.`} onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => { setExtra([...extra, { from: 'sys', text: `${home.name} proposed a new time. ${pet.name} can book it.` }]); go('Approved') }}>Send proposal</Btn></>}>
          <Radios name="ps" options={slotOptions} />
          <Btn small variant="ghost" to="/availability?modal=slot" className="self-start">+ Add a new slot</Btn>
          <Field label="Message (optional)" as="textarea" rows={2} placeholder="e.g. Sunday morning works better for us." />
        </Modal>
      )}
      {modal === 'reschedule' && (
        <Modal title="Reschedule Meet & Greet" sub={`Currently: ${slot.date} · ${slot.time} · ${slot.place}`} onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => go('Slot Booked')}>Request this time</Btn></>}>
          <Radios name="rs" options={slotOptions} />
          <Field label="Reason" as="textarea" rows={2} placeholder="e.g. My caretaker has a vet appointment that day." />
          <p className="small muted">{home.name} must confirm the new time.</p>
        </Modal>
      )}
      {modal === 'cancel' && (
        <Modal title="Cancel the Meet & Greet?" sub="Booking reopens so a new time can be picked." onClose={close}
          footer={<><Btn onClick={close}>Keep meeting</Btn><Btn variant="primary" onClick={() => go('Approved')}>Cancel meeting</Btn></>}>
          <Field label="Reason (required)" as="select" options={['Choose a reason', 'Schedule conflict', 'Pet is unwell', 'Weather or travel problem', 'Other']} />
          <Field label="Details" as="textarea" rows={3} placeholder="Tell the other side what happened." />
          <p className="small muted">The other side is notified with your reason.</p>
        </Modal>
      )}
      {modal === 'didnt' && (
        <Modal title="The meeting didn’t happen?" sub="Booking reopens so a new time can be picked." onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => go('Approved')}>Reopen booking</Btn></>}>
          <Radios name="dh" options={['The pet’s side didn’t show up', 'I couldn’t make it', 'We moved it to another day', 'Something else']} />
          <Field label="Details (optional)" as="textarea" rows={2} />
        </Modal>
      )}
      {modal === 'adopt' && (
        <Modal title={`Adopt ${pet.name}?`} sub="This is permanent." onClose={close}
          footer={<><Btn onClick={close}>Not yet</Btn><Btn variant="primary" onClick={() => go('Adopted', 'furparent')}>Yes, adopt {pet.name}</Btn></>}>
          <div className="row" style={{ justifyContent: 'center' }}><Ph w={72} h={72} round label="Pet" /><span className="muted">→</span><Ph w={72} h={72} round label="You" /></div>
          <ul className="small reasons">
            <li>{pet.name} is marked Adopted — Hired and becomes an alumni profile linked to you.</li>
            <li>You get the Furparent label.</li>
            <li>{pet.name}’s other open requests close automatically.</li>
          </ul>
          <Check label={`I met ${pet.name} and I’m ready to take them home.`} />
        </Modal>
      )}
      {modal === 'notadopted' && (
        <Modal title={`Decline ${pet.name} after the meeting?`} sub={`The request ends as Not Adopted and ${pet.name} goes back to Looking for a Home.`} onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => go('Not Adopted')}>Decline</Btn></>}>
          <Field label="Message to the caretaker (optional)" as="textarea" rows={3} placeholder={`e.g. Thank you for bringing ${pet.name}. We don’t think our home is the right fit.`} />
          <p className="small muted">{pet.name} can’t send you another request for 30 days.</p>
        </Modal>
      )}
      {modal === 'furparent' && (
        <Modal title="You’re a Furparent!" onClose={close} width={560}
          footer={<><Btn to={`/pet/${pet.id}`}>View {pet.name}’s alumni profile</Btn><Btn variant="primary" to="/feed?modal=story">Share your adoption story</Btn></>}>
          <div className="celebrate"><Ph w={96} h={96} round label="Pet" /><span className="badge solid">Hired</span><Ph w={96} h={96} round label="You" /></div>
          <p style={{ textAlign: 'center' }}><b>{pet.name}</b> got Hired and is now linked to your profile. Your Furparent badge is live, and {pet.name}’s other open requests were closed.</p>
        </Modal>
      )}
      {modal === 'hired' && (
        <Modal title="You got Hired!" onClose={close} width={560}
          footer={<><Btn to="/me">View my alumni profile</Btn><Btn variant="primary" to="/feed?modal=post">Post an update</Btn></>}>
          <div className="celebrate"><Ph w={96} h={96} round label="You" /><span className="badge solid">Hired</span><Ph w={96} h={96} round label="Furparent" /></div>
          <p style={{ textAlign: 'center' }}>{home.name} chose to adopt you! Your profile is now an alumni profile with the Hired badge, linked to your Furparent. Your other open requests were closed.</p>
        </Modal>
      )}
      {toastEl}
    </div>
  )
}

export function MeetCard({ slot, other }) {
  return (
    <div className="stack-sm card" style={{ padding: 12 }}>
      <strong>Meet & Greet confirmed</strong>
      <span>{slot.date} · {slot.time}</span>
      <span>{slot.place}</span>
      <hr style={{ margin: '6px 0' }} />
      <span className="small">Contact: {other} · 0917 XXX XXXX</span>
      <span className="small">Exact address: 12 Sample St., Brgy. Example</span>
      <span className="small muted">Shared after both sides confirmed. Reminders go out 1 day and 1 hour before.</span>
    </div>
  )
}
