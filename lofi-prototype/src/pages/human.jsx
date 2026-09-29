import { useState } from 'react'
import { slots } from '../data'
import { Badge, Btn, Card, Choice, Field, Modal, PageHead, Toggle, Wizard, useInit, useModal, useToast } from '../components/ui'

/* ---------------- Home Profile & lifestyle quiz ---------------- */
const quizSteps = ['Household', 'Home & space', 'Lifestyle', 'Experience', 'Preferences', 'Review']

function QuizStep({ i }) {
  return [
    <>
      <Choice label="Who lives with you?" multi options={['Just me', 'Partner', 'Kids under 6', 'Kids 6–12', 'Teens', 'Seniors']} initial={['Partner', 'Kids 6–12']} />
      <Choice label="Other pets at home" multi options={['None', 'Dog(s)', 'Cat(s)', 'Other']} initial={['Cat(s)']} />
      <Field label="About your home (shown publicly)" as="textarea" defaultValue="We are a family of three who spend weekends at the park." />
    </>,
    <>
      <Choice label="Home type" options={['House', 'Condo', 'Apartment', 'Townhouse']} initial={['House']} />
      <Choice label="Outdoor space" options={['None', 'Balcony', 'Small yard', 'Large yard']} initial={['Small yard']} />
      <Field label="City / Province" defaultValue="Quezon City, Metro Manila" hint="Only your city is shown publicly. Matches are limited to your province." />
    </>,
    <>
      <Choice label="Activity level" options={['Relaxed', 'Moderate', 'Active', 'Very active']} initial={['Active']} />
      <Choice label="Hours away from home per day" options={['0–2', '3–5', '6–8', '9+']} initial={['3–5']} />
    </>,
    <>
      <Choice label="Pet experience" options={['First-time', 'Some', 'Experienced']} initial={['Experienced']} />
      <Choice label="Willing to handle special needs?" options={['Yes', 'Minor needs only', 'No']} initial={['Minor needs only']} />
    </>,
    <>
      <Choice label="Species you accept" multi options={['Dog', 'Cat', 'Other']} initial={['Dog', 'Cat']} />
      <Choice label="Preferred size" multi options={['Small', 'Medium', 'Large']} initial={['Medium']} />
      <Choice label="Preferred age" multi options={['Puppy/Kitten', 'Adult', 'Senior']} initial={['Adult']} />
    </>,
    <>
      <Card>
        <dl className="kv small"><dt>Household</dt><dd>2 adults, 1 child (8) · 1 cat</dd><dt>Home</dt><dd>House · small yard · Quezon City</dd><dt>Lifestyle</dt><dd>Active · away 3–5 hrs</dd><dt>Experience</dt><dd>Experienced · minor special needs OK</dd><dt>Looking for</dt><dd>Dog or cat · medium · adult</dd></dl>
      </Card>
      <p className="small muted">These answers drive the match score: activity 20, hours away 15, home & space 15, experience 15, size & age 15, kids & pets 10, special needs 10.</p>
    </>,
  ][i]
}

export function Quiz() {
  const [done, setDone] = useState(!!useInit('done'))
  const [open, setOpen] = useState(true)
  if (done) {
    return (
      <div className="container narrow">
        <Card>
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '24px 0' }}>
            <h1>Home Profile saved</h1>
            <p className="muted">Your match scores were recalculated. 14 pets match your home.</p>
            <div className="card" style={{ padding: 16 }}><Toggle on={open} onChange={setOpen} label="Open to Adopt — let pets send me adoption requests" /></div>
            <div className="row"><Btn variant="primary" to="/matches">See Pets for You</Btn><Btn to="/me">View my profile</Btn></div>
          </div>
        </Card>
      </div>
    )
  }
  return (
    <div className="container narrow">
      <PageHead title="Home Profile & lifestyle quiz" sub="Pets read this like a job posting. Takes about 5 minutes." />
      <Card><Wizard steps={quizSteps} render={(i) => <QuizStep i={i} />} finish={() => setDone(true)} finishLabel="Save Home Profile" saveDraft /></Card>
    </div>
  )
}

/* ---------------- Meet & Greet availability ---------------- */
export function Availability() {
  const [list, setList] = useState(slots)
  const [modal, setModal] = useModal()
  const [toastEl, toast] = useToast()
  const close = () => setModal(null)
  return (
    <div className="container narrow">
      <PageHead title="Meet & Greet availability" sub="Pets with an approved request can book one of these slots. You confirm each booking."
        actions={<Btn variant="primary" onClick={() => setModal('slot')}>+ Add slot</Btn>} />
      <div className="stack">
        <Card title="Upcoming slots">
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th>Time</th><th>Place</th><th>Status</th><th /></tr></thead>
            <tbody>{list.map((s, i) => (
              <tr key={i}>
                <td>{s.date}</td><td>{s.time}</td><td>{s.place}<div className="small muted">{s.kind}</div></td>
                <td>{s.taken ? <Badge solid>Booked · {s.taken}</Badge> : <Badge>Open</Badge>}</td>
                <td className="nowrap">{s.taken ? <Btn small to="/requests/r1">View request</Btn> : <><Btn small variant="ghost">Edit</Btn><Btn small variant="ghost" onClick={() => setList(list.filter((_, j) => j !== i))}>Remove</Btn></>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
        <Card title="Past Meet & Greets">
          <div className="stack-sm small">
            <div className="row between"><span>Thu, Sep 17 · 4:00 PM · BGC High Street — Bantay</span><Badge solid>Decision needed</Badge></div>
            <div className="row between"><span>Sat, Jun 13 · 3:00 PM · Paws & Claws Café — Luna</span><Badge>Adopted</Badge></div>
          </div>
        </Card>
        <p className="small muted">Meet & Greets happen in person. Phone numbers and exact addresses are shared only after both sides confirm.</p>
      </div>
      {modal === 'slot' && (
        <Modal title="Add a Meet & Greet slot" onClose={close} width={560}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => { setList([...list, { date: 'Sat, Oct 10', time: '10:00 AM', place: 'UP Diliman Academic Oval', kind: 'Public spot' }]); close(); toast('slot') }}>Add slot</Btn></>}>
          <div className="form-grid">
            <Field label="Date" type="date" defaultValue="2026-10-10" />
            <Field label="Time" type="time" defaultValue="10:00" />
          </div>
          <Choice label="Meeting place" options={['Public spot', 'Shelter', 'Caretaker’s location']} initial={['Public spot']} />
          <Field label="Place details" placeholder="e.g. UP Diliman Academic Oval, near the sunken garden" />
          <Choice label="Repeat" options={['Does not repeat', 'Weekly for 4 weeks']} initial={['Does not repeat']} />
          <p className="small muted">Tip: public places are safest for a first meeting.</p>
        </Modal>
      )}
      {toastEl}
    </div>
  )
}
