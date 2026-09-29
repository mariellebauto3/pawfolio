import { Link, useNavigate, useParams } from 'react-router-dom'
import { useProto } from '../proto'
import { Footer, GuestNav } from '../components/Layout'
import { Alert, Btn, Card, Check, Field, Note, PageHead, Ph, Wizard, useInit, useToast } from '../components/ui'

export function Landing() {
  return (
    <>
      <GuestNav />
      <div className="container">
        <section className="hero">
          <div className="stack">
            <h1>Every pet deserves a job offer. The job is being loved.</h1>
            <p className="muted">Pets build a résumé, apply to homes that fit their lifestyle, and get “Hired” by their future Furparent.</p>
            <div className="row">
              <Btn variant="primary" to="/signup/pet">I’m a pet looking for a home</Btn>
              <Btn to="/signup/human">I want to adopt</Btn>
            </div>
            <span className="small muted">Already on Pawfolio? <Link to="/login">Sign in</Link></span>
          </div>
          <Ph h={300} label="Hero illustration: a pet holding a résumé" />
        </section>
        <h2 id="how" style={{ marginBottom: 12 }}>How it works</h2>
        <div className="cards four">
          {[
            ['1. Build a résumé', 'Photos, bio, temperament, skills and health — in the pet’s own words.'],
            ['2. Match with homes', 'Humans take a lifestyle quiz. Both sides see a match score with reasons.'],
            ['3. Apply & meet', 'The pet sends an adoption request, then books a Meet & Greet.'],
            ['4. Get Hired', 'The human chooses Adopt. The pet gets the Hired badge; the human becomes a Furparent.'],
          ].map(([t, d]) => (
            <Card key={t}><div className="stack-sm"><Ph h={70} label="Icon" /><h3>{t}</h3><p className="small muted">{d}</p></div></Card>
          ))}
        </div>
        <h2 id="hired" style={{ margin: '28px 0 12px' }}>Recently Hired</h2>
        <div className="cards four">
          {['Luna', 'Choco Jr.', 'Brownie', 'Pancit'].map((n) => (
            <Card key={n}><div className="stack-sm"><Ph h={110} label="Alumni photo" /><div className="row between"><strong>{n}</strong><span className="badge solid">Hired</span></div></div></Card>
          ))}
        </div>
        <div className="row between card" style={{ marginTop: 28, padding: 24 }}>
          <div className="stack-sm"><h2>Every account is verified by a real person.</h2><p className="muted">Caretakers and adopters submit an ID before they can use Pawfolio.</p></div>
          <Btn variant="primary" to="/signup">Join Pawfolio</Btn>
        </div>
      </div>
      <Footer />
    </>
  )
}

export function Login() {
  const { setRole, setAcct } = useProto()
  const nav = useNavigate()
  const error = useInit('error')
  const [toastEl] = useToast()
  const go = () => { setRole('human'); setAcct('Active'); nav('/feed') }
  return (
    <>
      <GuestNav />
      <div className="container">
        <Card className="center-card">
          <div className="stack">
            <h1>Sign in</h1>
            <p className="muted small">Welcome back! Pets, humans and admins all sign in here.</p>
            {error === 'credentials' && <Alert><b>That email and password don’t match.</b> Try again or reset your password. After 5 failed tries, sign-in is paused for 15 minutes.</Alert>}
            {error === 'deactivated' && <Alert><b>This account was closed.</b> Deactivated accounts can’t sign in. Contact support to restore it.</Alert>}
            <Field label="Email" type="email" placeholder="you@email.com" defaultValue={error ? 'ana.santos@email.com' : undefined} />
            <Field label="Password" type="password" defaultValue={error ? 'wrongpass' : undefined} />
            <div className="row between"><Check label="Keep me signed in" /><Link className="small" to="/forgot">Forgot password?</Link></div>
            <Btn variant="primary" block onClick={go}>Sign in</Btn>
            <p className="small muted" style={{ textAlign: 'center' }}>New to Pawfolio? <Link to="/signup">Join now</Link></p>
            <Note>One login page for all roles. The server routes Pet, Human and Admin accounts to their own home. Admin accounts are created by the system, not by sign-up.</Note>
          </div>
        </Card>
      </div>
      {toastEl}
    </>
  )
}

export function ForgotPassword() {
  const sent = useInit('sent')
  return (
    <>
      <GuestNav />
      <div className="container">
        <Card className="center-card">
          {sent ? (
            <div className="stack" style={{ textAlign: 'center', alignItems: 'center' }}>
              <Ph w={72} h={72} round label="Mail" />
              <h1>Check your email</h1>
              <p className="muted">If an account exists for <b>ana.santos@email.com</b>, we sent a link to reset the password. The link expires in 30 minutes.</p>
              <Btn variant="primary" to="/reset">Open reset link (demo)</Btn>
              <p className="small muted">Didn’t get it? <a href="#resend">Resend email</a> · <Link to="/login">Back to sign in</Link></p>
            </div>
          ) : (
            <div className="stack">
              <h1>Forgot your password?</h1>
              <p className="muted small">Enter the email you signed up with and we’ll send you a reset link.</p>
              <Field label="Email" type="email" placeholder="you@email.com" />
              <Btn variant="primary" block to="/forgot?sent=1">Send reset link</Btn>
              <Link className="small" to="/login">← Back to sign in</Link>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

export function ResetPassword() {
  return (
    <>
      <GuestNav />
      <div className="container">
        <Card className="center-card">
          <div className="stack">
            <h1>Set a new password</h1>
            <Field label="New password" type="password" hint="At least 8 characters, with a number and a letter." />
            <div className="strength"><i /><i /><i /><i className="off" /><span className="small muted">Strong</span></div>
            <Field label="Confirm new password" type="password" />
            <Btn variant="primary" block to="/login?toast=reset">Save and sign in</Btn>
          </div>
        </Card>
      </div>
    </>
  )
}

export function SignupPick() {
  return (
    <>
      <GuestNav />
      <div className="container narrow">
        <div className="stack" style={{ margin: '24px 0' }}>
          <h1>Join Pawfolio</h1>
          <p className="muted">Pick the kind of account. One account = one pet, or one person.</p>
        </div>
        <div className="type-pick">
          <Link to="/signup/pet"><Card><div className="stack"><Ph h={120} label="Pet" /><h2>I’m a pet</h2><p className="small muted">A caretaker (foster, finder or shelter volunteer) signs up on the pet’s behalf and gets verified.</p><span className="btn sm" style={{ alignSelf: 'start' }}>Sign up a pet</span></div></Card></Link>
          <Link to="/signup/human"><Card><div className="stack"><Ph h={120} label="Person" /><h2>I want to adopt</h2><p className="small muted">Build a Home Profile, get matched, and review adoption requests from pets. You must be 18 or older.</p><span className="btn sm" style={{ alignSelf: 'start' }}>Sign up to adopt</span></div></Card></Link>
        </div>
        <p className="small muted" style={{ textAlign: 'center', marginTop: 20 }}>Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </>
  )
}

const petSteps = ['Account', 'Pet details', 'Photo', 'Caretaker & ID', 'Review']
const humanSteps = ['Account', 'Personal details', 'Address', 'Valid ID', 'Review']

function PetStep({ i }) {
  return [
    <>
      <Field label="Email" type="email" placeholder="caretaker@email.com" hint="Used to sign in to the pet’s account." />
      <Field label="Password" type="password" hint="At least 8 characters." />
      <Field label="Confirm password" type="password" />
    </>,
    <div className="form-grid">
      <Field label="Pet name" placeholder="e.g. Mochi" />
      <Field label="Species" as="select" options={['Dog', 'Cat', 'Other']} />
      <Field label="Breed" placeholder="e.g. Aspin" />
      <Field label="Approximate age" placeholder="e.g. 2 years" />
      <Field label="Where the pet is staying" placeholder="e.g. Happy Paws Rescue foster" />
      <Field label="City / Province" placeholder="Quezon City, Metro Manila" />
    </div>,
    <>
      <Field label="At least one clear photo of the pet" as="file" placeholder="pet photo" />
      <div className="row"><Ph w={120} h={90} label="Photo 1" /><Ph w={120} h={90} label="Photo 2" /></div>
    </>,
    <div className="form-grid">
      <Field label="Caretaker full name" />
      <Field label="Caretaker contact number" placeholder="09XX XXX XXXX" />
      <Field label="Caretaker valid ID" as="file" placeholder="ID photo" />
      <Field label="Vet record or shelter certificate (optional)" as="file" placeholder="document" hint="Optional, but speeds up review." />
    </div>,
    <>
      <Card><div className="stack-sm"><strong>Review your details</strong><dl className="kv small"><dt>Pet</dt><dd>Mochi · Dog · Aspin · ~2 yrs</dd><dt>Staying at</dt><dd>Happy Paws Rescue foster · Quezon City</dd><dt>Photos</dt><dd>2 uploaded</dd><dt>Caretaker</dt><dd>Joy Lim · 0917 XXX XXXX</dd><dt>Documents</dt><dd>Valid ID ✓ · Vet record ✓</dd></dl><Btn small variant="ghost">Edit details</Btn></div></Card>
      <Check label="I confirm the details are true and I agree to the Terms and Community Guidelines." />
      <p className="small muted">Verification documents are visible to admins only.</p>
    </>,
  ][i]
}

function HumanStep({ i }) {
  return [
    <>
      <Field label="Email" type="email" placeholder="you@email.com" />
      <Field label="Password" type="password" hint="At least 8 characters." />
      <Field label="Confirm password" type="password" />
    </>,
    <div className="form-grid">
      <Field label="Full name" placeholder="As shown on your ID" />
      <Field label="Birthdate" type="date" hint="You must be 18 or older." />
      <Field label="Contact number" placeholder="09XX XXX XXXX" hint="Shared only after a Meet & Greet is confirmed." />
    </div>,
    <div className="form-grid">
      <Field label="City" placeholder="e.g. Quezon City" /><Field label="Province" placeholder="e.g. Metro Manila" />
      <Field label="Street address" hint="Private. Only your city is shown publicly." />
    </div>,
    <>
      <Field label="ID type" as="select" options={['Driver’s license', 'Passport', 'UMID', 'National ID (PhilSys)', 'Postal ID']} />
      <Field label="Photo of your valid ID" as="file" placeholder="ID photo" hint="Visible to admins only." />
    </>,
    <>
      <Card><div className="stack-sm"><strong>Review your details</strong><dl className="kv small"><dt>Name</dt><dd>Ana Santos</dd><dt>Birthdate</dt><dd>Mar 4, 1990 (36)</dd><dt>Contact</dt><dd>0917 XXX XXXX</dd><dt>City</dt><dd>Quezon City, Metro Manila</dd><dt>ID</dt><dd>Driver’s license ✓</dd></dl><Btn small variant="ghost">Edit details</Btn></div></Card>
      <Check label="I confirm the details are true and I agree to the Terms and Community Guidelines." />
    </>,
  ][i]
}

export function Signup() {
  const { type } = useParams()
  const isPet = type === 'pet'
  const { setRole, setAcct } = useProto()
  const nav = useNavigate()
  const submit = () => { setRole(isPet ? 'pet' : 'human'); setAcct('Pending Verification'); nav('/feed') }
  return (
    <>
      <GuestNav />
      <div className="container narrow">
        <Card>
          <div className="stack">
            <div className="row between">
              <h1>{isPet ? 'Sign up a pet' : 'Sign up to adopt'}</h1>
              <span className="small muted">Have an account? <Link to="/login">Sign in</Link></span>
            </div>
            <Wizard steps={isPet ? petSteps : humanSteps} render={(i) => (isPet ? <PetStep i={i} /> : <HumanStep i={i} />)} finish={submit} finishLabel="Submit for verification" />
          </div>
        </Card>
      </div>
    </>
  )
}

function StatusHeader() {
  const { setRole } = useProto()
  const nav = useNavigate()
  return (
    <header className="topnav">
      <div className="inner">
        <span className="logo"><i>PF</i>Pawfolio</span>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <a className="small" href="#help">Help center</a>
          <Btn small onClick={() => { setRole('guest'); nav('/') }}>Log out</Btn>
        </div>
      </div>
    </header>
  )
}

// Shown instead of the whole app while the account isn't Active (Section 5.1).
export function AccountStatus() {
  const { acct, setAcct, role } = useProto()
  const nav = useNavigate()
  const [toastEl] = useToast()
  const content = {
    'Pending Verification': {
      title: 'Your account is pending approval',
      body: 'An admin is reviewing your details. This usually takes 1–2 days. You can’t browse, post, send or receive anything until you’re approved.',
      actions: <Btn onClick={() => nav('/account/edit')}>Edit submitted details</Btn>,
    },
    Denied: {
      title: 'Your account wasn’t approved',
      body: 'Correct your details and resubmit. Your account goes back to Pending Verification.',
      reason: 'The ID photo is blurry and the name can’t be read.',
      actions: <Btn variant="primary" onClick={() => { setAcct('Pending Verification'); nav('/account/edit') }}>Correct & resubmit</Btn>,
    },
    Suspended: {
      title: 'Your account is suspended',
      body: 'Your profile is hidden from everyone. Only an admin can reactivate it. If you think this is a mistake, contact support.',
      reason: 'Multiple confirmed reports of misleading profile information.',
      actions: <Btn>Contact support</Btn>,
    },
  }[acct]
  return (
    <>
      <StatusHeader />
      <div className="container">
        <Card className="center-card" style={{ maxWidth: 560 }}>
          <div className="stack" style={{ textAlign: 'center', alignItems: 'center' }}>
            <Ph w={80} h={80} round label="Status" />
            <span className="badge">{acct}</span>
            <h1>{content.title}</h1>
            <p className="muted">{content.body}</p>
            {content.reason && <Alert><b>Reason from admin:</b> “{content.reason}”</Alert>}
            {acct === 'Pending Verification' && (
              <dl className="kv small" style={{ textAlign: 'left', width: '100%' }}>
                <dt>Account</dt><dd>{role === 'pet' ? 'Pet · Mochi' : 'Human · Ana Santos'}</dd>
                <dt>Submitted</dt><dd>Sep 13, 2026 · 2:48 PM</dd>
                <dt>Documents</dt><dd>Valid ID ✓{role === 'pet' ? ' · Vet record ✓' : ''}</dd>
              </dl>
            )}
            <div className="row">{content.actions}</div>
            <Note>Blocked by the server, not just hidden in the UI (NFR2). Use the Account status dropdown in the bar above to preview each state.</Note>
          </div>
        </Card>
      </div>
      {toastEl}
    </>
  )
}

export function EditSubmission() {
  const { role } = useProto()
  const nav = useNavigate()
  const isPet = role === 'pet'
  return (
    <>
      <StatusHeader />
      <div className="container narrow">
        <PageHead title="Edit submitted details" sub="Your account stays in Pending Verification while you edit. Saving puts it back in the review queue." />
        <Card>
          <div className="stack">
            {isPet ? (
              <div className="form-grid">
                <Field label="Pet name" defaultValue="Mochi" />
                <Field label="Species" as="select" options={['Dog', 'Cat', 'Other']} />
                <Field label="Breed" defaultValue="Aspin" />
                <Field label="Approximate age" defaultValue="2 years" />
                <Field label="Caretaker full name" defaultValue="Joy Lim" />
                <Field label="Caretaker contact number" defaultValue="0917 XXX XXXX" />
              </div>
            ) : (
              <div className="form-grid">
                <Field label="Full name" defaultValue="Ana Santos" />
                <Field label="Birthdate" type="date" defaultValue="1990-03-04" />
                <Field label="Contact number" defaultValue="0917 XXX XXXX" />
                <Field label="City / Province" defaultValue="Quezon City, Metro Manila" />
              </div>
            )}
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="stack-sm"><span className="small"><b>Current ID</b></span><Ph w={200} h={120} label="ID photo (uploaded)" /></div>
              <div className="grow"><Field label="Replace ID photo" as="file" placeholder="new ID photo" /></div>
            </div>
            <div className="row between">
              <Btn onClick={() => nav('/feed')}>Cancel</Btn>
              <Btn variant="primary" onClick={() => nav('/feed?toast=details')}>Save and resubmit</Btn>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
