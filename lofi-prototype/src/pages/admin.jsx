import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { accounts, findAccount, findHome, findPet, logs, pets, reports, requests, statusHistory, verificationQueue } from '../data'
import { AdminShell } from '../components/Layout'
import {
  Alert, Badge, Btn, Card, Check, Drawer, Field, Modal, PageHead, Ph, Radios, Tabs, useInit, useModal, useToast,
} from '../components/ui'

/* ---------------- Dashboard ---------------- */
export function Dashboard() {
  const kpis = [
    ['Active accounts', 312, '+18 this month'], ['Verification queue', 4, 'Oldest: 1 day'], ['Pets looking for a home', 87, ''], ['Pets in process', 12, ''],
    ['Open requests', 41, '3 expiring soon'], ['Meet & Greets this week', 9, ''], ['Adoptions this month', 14, '+4 vs August'], ['Avg. days to adoption', 23, '−2 days'],
  ]
  return (
    <AdminShell>
      <PageHead title="Platform dashboard" sub="Snapshot of Pawfolio activity." actions={<><select style={{ width: 'auto' }}><option>Last 30 days</option><option>This year</option></select><Btn small>Export</Btn></>} />
      <div className="stack">
        <div className="kpis">{kpis.map(([k, v, s]) => <Card key={k} className="kpi"><div className="small muted">{k}</div><div className="v">{v}</div><div className="small muted">{s}</div></Card>)}</div>
        <div className="grid-half">
          <Card title="Adoptions per month"><Ph h={190} label="Bar chart: adoptions per month" /></Card>
          <Card title="Accounts by status"><Ph h={190} label="Stacked bar: Active / Pending / Denied / Suspended / Deactivated" /></Card>
          <Card title="Pets by status"><Ph h={190} label="Bar: Draft / Looking for a Home / In Process / Hired" /></Card>
          <Card title="Requests & Meet & Greets"><Ph h={190} label="Line: requests sent vs approved vs adopted" /></Card>
        </div>
        <Card title="Needs attention">
          <div className="stack-sm">
            <div className="row between"><span>4 accounts waiting for verification</span><Btn small to="/admin/verification">Review</Btn></div>
            <div className="row between"><span>3 open reports</span><Btn small to="/admin/reports">Review</Btn></div>
            <div className="row between"><span>1 request overdue for a decision (7+ days)</span><Btn small to="/admin/monitor?tab=Overdue">Open</Btn></div>
          </div>
        </Card>
      </div>
    </AdminShell>
  )
}

/* ---------------- Verification ---------------- */
export function Verification() {
  const [tab, setTab] = useState('All')
  const list = verificationQueue.filter((v) => tab === 'All' || v.type === tab)
  return (
    <AdminShell>
      <PageHead title="Verification queue" sub="New Human and Pet accounts waiting for review. Oldest first." actions={<input placeholder="Search by name" style={{ width: 220 }} />} />
      <Card>
        <Tabs tabs={['All', 'Pet', 'Human']} value={tab} onChange={setTab} />
        <div className="table-wrap"><table>
          <thead><tr><th>Account</th><th>Type</th><th>Submitted</th><th>Documents</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((v) => (
            <tr key={v.id}>
              <td><div className="row" style={{ flexWrap: 'nowrap' }}><Ph w={36} h={36} round label="" /><div><strong>{v.name}</strong>{v.caretaker && <div className="small muted">Caretaker: {v.caretaker}</div>}</div></div></td>
              <td>{v.type}</td><td>{v.submitted}</td><td>{v.docs}</td>
              <td><Badge>{v.resubmitted ? 'Resubmitted' : 'Pending'}</Badge></td>
              <td><Btn small to={`/admin/verification/${v.id}`}>Review</Btn></td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
    </AdminShell>
  )
}

export function VerificationDetail() {
  const { id } = useParams()
  const v = verificationQueue.find((x) => x.id === id) || verificationQueue[0]
  const [result, setResult] = useState(useInit('result'))
  const [modal, setModal] = useModal()
  const [toastEl, toast] = useToast()
  const close = () => setModal(null)
  const isPet = v.type === 'Pet'
  const idx = verificationQueue.indexOf(v)
  return (
    <AdminShell>
      <div className="row between" style={{ marginBottom: 12 }}>
        <Link className="small" to="/admin/verification">← Verification queue</Link>
        <span className="small muted">{idx + 1} of {verificationQueue.length} · <Link to={`/admin/verification/${verificationQueue[(idx + 1) % verificationQueue.length].id}`}>Next</Link></span>
      </div>
      <PageHead title={`Review: ${v.name}`} sub={`${v.type} account · submitted ${v.submitted}`} actions={<Badge solid={!!result}>{result || (v.resubmitted ? 'Resubmitted' : 'Pending Verification')}</Badge>} />
      <div className="grid2">
        <div className="stack">
          {v.resubmitted && <Alert><b>Resubmitted after a denial.</b> Previous reason: “ID photo unreadable.”</Alert>}
          <Card title="Submitted details">
            {isPet ? (
              <dl className="kv"><dt>Pet name</dt><dd>{v.name}</dd><dt>Species / breed</dt><dd>Dog · Shih Tzu mix</dd><dt>Approx. age</dt><dd>5 yrs</dd><dt>Staying at</dt><dd>Foster home, Quezon City</dd><dt>Caretaker</dt><dd>{v.caretaker} · 0917 XXX XXXX</dd></dl>
            ) : (
              <dl className="kv"><dt>Full name</dt><dd>{v.name}</dd><dt>Birthdate</dt><dd>Jan 12, 1995 (31 yrs) · 18+ ✓</dd><dt>Contact</dt><dd>0918 XXX XXXX</dd><dt>Address</dt><dd>Pasig, Metro Manila</dd></dl>
            )}
          </Card>
          <Card title="Documents (visible to admins only)">
            <div className="photo-grid">
              <div className="stack-sm"><Ph h={130} label="Valid ID (front)" /><span className="small muted">Open full size</span></div>
              {isPet && <div className="stack-sm"><Ph h={130} label="Pet photo" /><span className="small muted">Open full size</span></div>}
              {isPet && <div className="stack-sm"><Ph h={130} label="Vet record" /><span className="small muted">Open full size</span></div>}
            </div>
          </Card>
        </div>
        <Card title="Decision">
          <div className="stack">
            <strong className="small">Checklist</strong>
            <div className="stack-sm">
              <Check label="ID is readable and not expired" />
              <Check label="Name matches the ID" />
              <Check label={isPet ? 'Pet photo is clear' : 'Age is 18 or older'} />
              <Check label="No duplicate account found" />
            </div>
            <div className="row">
              <Btn variant="primary" onClick={() => { setResult('Active'); toast('approved') }}>Approve</Btn>
              <Btn onClick={() => setModal('deny')}>Deny…</Btn>
            </div>
            <p className="small muted">Every decision is written to the activity log with your name.</p>
          </div>
        </Card>
      </div>
      {modal === 'deny' && (
        <Modal title={`Deny ${v.name}?`} sub="The owner sees your reason and can correct their details and resubmit." onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => { setResult('Denied'); close(); toast('denied') }}>Deny account</Btn></>}>
          <strong className="small">Reason (required)</strong>
          <Radios name="deny" options={['ID photo is blurry or unreadable', 'Name doesn’t match the ID', 'ID is expired', 'Under 18', 'Other']} />
          <Field label="Message to the owner" as="textarea" rows={3} defaultValue="The ID photo is blurry and the name can’t be read. Please upload a clearer photo." />
        </Modal>
      )}
      {toastEl}
    </AdminShell>
  )
}

/* ---------------- Reports ---------------- */
export function Reports() {
  const [tab, setTab] = useState('Open')
  return (
    <AdminShell>
      <PageHead title="Reports & moderation" sub="Reported profiles, posts, comments and accounts. Most reported first." />
      <Card>
        <Tabs tabs={['Open', 'Resolved']} value={tab} onChange={setTab} />
        {tab === 'Open' ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Reported</th><th>Reason</th><th>Reports</th><th>Latest</th><th /></tr></thead>
            <tbody>{reports.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.item}</strong><div className="small muted">{r.type} · first reported by {r.reporter}</div></td>
                <td>{r.reason}</td><td>{r.count}</td><td>{r.when}</td>
                <td><Btn small to={`/admin/reports/${r.id}`}>Review</Btn></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : (
          <p className="small muted">Resolved reports show the action taken, by whom and when.</p>
        )}
      </Card>
    </AdminShell>
  )
}

export function ReportDetail() {
  const { id } = useParams()
  const r = reports.find((x) => x.id === id) || reports[0]
  const [modal, setModal] = useModal()
  const [done, setDone] = useState(null)
  const [toastEl, toast] = useToast()
  const close = () => setModal(null)
  return (
    <AdminShell>
      <p className="small" style={{ marginBottom: 12 }}><Link to="/admin/reports">← Reports</Link></p>
      <PageHead title={`Report: ${r.item}`} sub={`${r.type} · ${r.count} reports · latest ${r.when}`} actions={<Badge solid={!!done}>{done || 'Open'}</Badge>} />
      <div className="grid2">
        <div className="stack">
          <Card title="Reported content">
            <div className="card" style={{ padding: 12 }}>
              <div className="row" style={{ flexWrap: 'nowrap' }}><Ph w={40} h={40} round label="" /><div><strong>{r.account}</strong><div className="small muted">{r.type}</div></div></div>
              <p style={{ marginTop: 10 }}>{r.content}</p>
              {r.type !== 'Comment' && <Ph h={140} label="Attached photos" style={{ marginTop: 10 }} />}
            </div>
          </Card>
          <Card title={`Reports (${r.count})`}>
            <div className="table-wrap"><table>
              <thead><tr><th>Reporter</th><th>Reason</th><th>Details</th><th>When</th></tr></thead>
              <tbody>
                <tr><td>{r.reporter}</td><td>{r.reason}</td><td className="small">“This looks like a sale, not an adoption.”</td><td>{r.when}</td></tr>
                {r.count > 1 && <tr><td>Kulit</td><td>{r.reason}</td><td className="small">—</td><td>Sep 25</td></tr>}
                {r.count > 2 && <tr><td className="muted" colSpan={4}>+ {r.count - 2} more</td></tr>}
              </tbody>
            </table></div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Reported account">
            <dl className="kv small"><dt>Account</dt><dd>{r.account}</dd><dt>Status</dt><dd>Active</dd><dt>Prior reports</dt><dd>{r.prior}</dd><dt>Joined</dt><dd>Aug 2026</dd></dl>
            <Btn small style={{ marginTop: 10 }} to="/admin/accounts/maxdealer">Open account</Btn>
          </Card>
          <Card title="Take action">
            <div className="stack">
              <Btn variant="primary" onClick={() => setModal('action')}>Choose action…</Btn>
              <Btn onClick={() => { setDone('Dismissed'); toast('action') }}>Dismiss report</Btn>
              <p className="small muted">Removing hides the content for everyone. It can be restored later from Resolved.</p>
            </div>
          </Card>
        </div>
      </div>
      {modal === 'action' && (
        <Modal title="Take action on this report" onClose={close} width={580}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => { setDone('Action taken'); close(); toast('action') }}>Apply action</Btn></>}>
          <Radios name="act" options={[
            ['Remove the content', 'Hides the post, comment or profile. Can be restored.'],
            ['Suspend the account', 'Profile hidden; the owner sees the reason. Can be reactivated.'],
            ['Remove content and suspend', 'Both of the above.'],
            ['Dismiss', 'No violation found. Reporters are told the report was reviewed.'],
          ]} initial="Remove content and suspend" />
          <Field label="Reason (required, shown to the owner)" as="textarea" rows={3} defaultValue="Selling animals is not allowed on Pawfolio." />
          <Check label="Notify the reporters that action was taken" defaultChecked />
        </Modal>
      )}
      {toastEl}
    </AdminShell>
  )
}

/* ---------------- Monitor requests & Meet & Greets ---------------- */
export function Monitor() {
  const [tab, setTab] = useState(useInit('tab', 'All requests'))
  const list = tab === 'Overdue' ? requests.filter((r) => r.status === 'Awaiting Decision')
    : tab === 'Meet & Greets' ? requests.filter((r) => r.slot) : requests
  return (
    <AdminShell>
      <PageHead title="Requests & Meet & Greets" sub="Monitor every adoption request and meeting on the platform." actions={<select style={{ width: 'auto' }}><option>All statuses</option><option>Sent</option><option>Approved</option><option>Meet Scheduled</option><option>Awaiting Decision</option></select>} />
      <Card>
        <Tabs tabs={['All requests', 'Meet & Greets', 'Overdue']} value={tab} onChange={setTab} />
        <div className="table-wrap"><table>
          <thead><tr><th>Pet → Human</th><th>Status</th>{tab !== 'All requests' && <th>Meet & Greet</th>}<th>Sent</th><th>Updated</th><th /></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.id}>
              <td>{findPet(r.pet).name} → {findHome(r.home).name}</td>
              <td><Badge solid={tab === 'Overdue'}>{tab === 'Overdue' ? 'Overdue · 4 days' : r.status}</Badge></td>
              {tab !== 'All requests' && <td className="small">{r.slot.date} · {r.slot.time}<br />{r.slot.place}</td>}
              <td>{r.sent}</td><td>{r.updated}</td>
              <td className="nowrap"><Btn small to={`/admin/requests/${r.id}`}>View</Btn>{tab === 'Overdue' && <Btn small variant="ghost" to={`/admin/resolve?req=${r.id}`}>Resolve</Btn>}</td>
            </tr>
          ))}</tbody>
        </table></div>
        {tab === 'Overdue' && <p className="small muted" style={{ marginTop: 10 }}>Flagged after 7 days of reminders with no Adopt / Decline decision.</p>}
      </Card>
    </AdminShell>
  )
}

export function AdminRequestDetail() {
  const { id } = useParams()
  const r = requests.find((x) => x.id === id) || requests[1]
  const pet = findPet(r.pet)
  const home = findHome(r.home)
  const [toastEl, toast] = useToast()
  return (
    <AdminShell>
      <p className="small" style={{ marginBottom: 12 }}><Link to="/admin/monitor">← Requests & Meet & Greets</Link></p>
      <PageHead title={`${pet.name} → ${home.name}`} sub={`Adoption request ${r.id} · sent ${r.sent}`} actions={<><Badge>{r.status}</Badge><Btn small onClick={() => toast('reminder')}>Send reminder</Btn><Btn small variant="primary" to={`/admin/resolve?req=${r.id}`}>Resolve issue</Btn></>} />
      <div className="grid2">
        <div className="stack">
          <Card title="Timeline">
            <ol className="timeline small">
              <li><b>{r.sent}</b> · Sent by {pet.name}</li>
              {r.approved && <li><b>{r.approved}</b> · Approved by {home.name} · {pet.name} → In Process</li>}
              {r.booked && <li><b>{r.booked}</b> · Meet & Greet booked by {pet.name}</li>}
              {r.confirmed && <li><b>{r.confirmed}</b> · Confirmed by {home.name} · contact details shared</li>}
              {r.slot && r.status === 'Awaiting Decision' && <li><b>{r.slot.date.slice(5)}</b> · Meeting time passed · no decision yet · daily reminders, flagged after 7 days</li>}
              {r.status === 'Adopted' && <li><b>{r.updated}</b> · {home.name} chose Adopt · {pet.name} → Adopted — Hired</li>}
              {!r.approved && <li><b>{r.updated}</b> · Current status: {r.status}</li>}
            </ol>
          </Card>
          <Card title="Cover letter"><p>{r.letter}</p></Card>
          <p className="small muted">Admins can read request details and timelines. Thread messages are private unless attached to a report.</p>
        </div>
        <div className="stack">
          <Card title="Parties">
            <div className="stack">
              <div className="row" style={{ flexWrap: 'nowrap' }}><Ph w={40} h={40} round label="" /><div className="grow"><strong>{pet.name}</strong><div className="small muted">Pet · {pet.status}</div></div><Btn small to={`/admin/accounts/${pet.id}`}>Account</Btn></div>
              <div className="row" style={{ flexWrap: 'nowrap' }}><Ph w={40} h={40} round label="" /><div className="grow"><strong>{home.name}</strong><div className="small muted">Human · {home.furparent ? 'Furparent' : 'Open to Adopt'}</div></div><Btn small to={`/admin/accounts/${home.id}`}>Account</Btn></div>
            </div>
          </Card>
          {r.slot && <Card title="Meet & Greet"><dl className="kv small"><dt>When</dt><dd>{r.slot.date} · {r.slot.time}</dd><dt>Where</dt><dd>{r.slot.place}</dd><dt>Confirmed</dt><dd>Both sides</dd></dl></Card>}
        </div>
      </div>
      {toastEl}
    </AdminShell>
  )
}

/* ---------------- Resolve adoption issue ---------------- */
export function Resolve() {
  const [modal, setModal] = useModal()
  const [toastEl, toast] = useToast()
  const close = () => setModal(null)
  const req = useInit('req')
  return (
    <AdminShell>
      <PageHead title="Resolve adoption issue" sub="The only way to change a pet’s status outside the normal flow. A reason is required and the change is logged." />
      <div className="grid2">
        <Card>
          <div className="stack">
            <Field label="Pet" as="select" options={pets.map((p) => `${p.name} — ${p.status}`)} defaultValue={req === 'r5' ? 'Bantay — In Process' : 'Luna — Adopted — Hired'} />
            <Field label="Related request" as="select" options={['r0 · Luna → Ana Santos · Adopted', 'r5 · Bantay → Ana Santos · Awaiting Decision', 'r1 · Mochi → Ana Santos · Meet Scheduled']} defaultValue={req === 'r5' ? 'r5 · Bantay → Ana Santos · Awaiting Decision' : undefined} />
            <strong className="small">Action</strong>
            <Radios name="fix" options={[
              ['Cancel adoption', 'The pet was returned. Pet → Looking for a Home; alumni link removed.'],
              ['Return pet to Looking for a Home', 'Ends the current process without an adoption.'],
              ['Close request', 'Closes one request; other requests are not affected.'],
              ['Reopen Meet & Greet booking', 'Request goes back to Approved.'],
            ]} />
            <Field label="Reason (required)" as="textarea" rows={3} placeholder="e.g. Furparent returned the pet on Sep 20 because of a severe allergy." />
            <Btn variant="primary" className="self-start" onClick={() => setModal('confirm')}>Review change</Btn>
          </div>
        </Card>
        <Card title="Recent resolutions">
          <div className="stack-sm small">
            <span><b>Sep 12</b> · Reopened booking for Choco → Ana Santos (no-show) · admin.mark</span>
            <span><b>Aug 30</b> · Cancelled adoption: Brownie returned (allergy) · admin.jess</span>
          </div>
        </Card>
      </div>
      {modal === 'confirm' && (
        <Modal title="Confirm status change" sub="This overrides the normal flow." onClose={close}
          footer={<><Btn onClick={close}>Back</Btn><Btn variant="primary" onClick={() => { close(); toast('resolved') }}>Apply change</Btn></>}>
          <dl className="kv small">
            <dt>Pet</dt><dd>Luna</dd>
            <dt>Status</dt><dd>Adopted — Hired → <b>Looking for a Home</b></dd>
            <dt>Furparent link</dt><dd>Removed from Ana Santos (Furparent label stays)</dd>
            <dt>Reason</dt><dd>Returned on Sep 20 because of a severe allergy.</dd>
          </dl>
          <p className="small muted">Both accounts are notified. The change is written to the activity log with your name and reason.</p>
        </Modal>
      )}
      {toastEl}
    </AdminShell>
  )
}

/* ---------------- Accounts & alumni ---------------- */
export function Accounts() {
  const [tab, setTab] = useState(useInit('tab', 'All'))
  const rows = accounts.map((a) => findAccount(a.id))
    .filter((r) => tab === 'All' || (tab === 'Alumni' ? r.label === 'Adopted — Hired' : r.type === tab))
  return (
    <AdminShell>
      <PageHead title={tab === 'Alumni' ? 'Alumni profiles' : 'Accounts & alumni'} sub={tab === 'Alumni' ? 'Adopted pets and their linked Furparents.' : 'All Pet and Human accounts.'} actions={<><input placeholder="Search accounts" style={{ width: 220 }} /><select style={{ width: 'auto' }}><option>All statuses</option><option>Active</option><option>Suspended</option><option>Deactivated</option></select></>} />
      <Card>
        <Tabs tabs={['All', 'Pet', 'Human', 'Alumni']} value={tab} onChange={setTab} />
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Type</th><th>Account status</th><th>{tab === 'Alumni' ? 'Furparent' : 'Label'}</th><th>City</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><div className="row" style={{ flexWrap: 'nowrap' }}><Ph w={32} h={32} round label="" /><strong>{r.name}</strong></div></td>
              <td>{r.type}</td>
              <td><Badge solid={r.status === 'Suspended'}>{r.status}</Badge></td>
              <td>{tab === 'Alumni' ? `${findHome(r.profile.hiredBy).name} · since ${r.profile.hiredOn}` : r.label}</td>
              <td>{r.city}</td>
              <td className="nowrap"><Btn small to={`/admin/accounts/${r.id}`}>View</Btn>{tab === 'Alumni' && <Btn small variant="ghost" to="/admin/resolve">Resolve issue</Btn>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
    </AdminShell>
  )
}

export function AccountDetail() {
  const { id } = useParams()
  const a = findAccount(id) || findAccount('mochi')
  const [modal, setModal] = useModal()
  const [toastEl, toast] = useToast()
  const [status, setStatus] = useState(a.status)
  const close = () => setModal(null)
  const act = (s, t) => { setStatus(s); close(); toast(t) }
  const isPet = a.type === 'Pet'
  return (
    <AdminShell>
      <p className="small" style={{ marginBottom: 12 }}><Link to="/admin/accounts">← Accounts</Link></p>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <Ph w={64} h={64} round label="" />
          <div><h1>{a.name}</h1><span className="muted">{a.type} account · {a.city}{isPet ? ` · caretaker Joy Lim` : ''}</span></div>
          <Badge solid={status !== 'Active'}>{status}</Badge>
          {a.label && <Badge>{a.label}</Badge>}
        </div>
        <div className="row">
          {a.profile && <Btn small to={isPet ? `/pet/${a.id}` : `/home/${a.id}`}>View public profile</Btn>}
          {status === 'Active' && <Btn small onClick={() => setModal('suspend')}>Suspend</Btn>}
          {status === 'Suspended' && <Btn small variant="primary" onClick={() => setModal('reactivate')}>Reactivate</Btn>}
          {status !== 'Deactivated' && <Btn small variant="ghost" onClick={() => setModal('deactivate')}>Deactivate</Btn>}
        </div>
      </div>
      <div className="grid2">
        <div className="stack">
          <Card title="Status history">
            <div className="table-wrap"><table>
              <thead><tr><th>When</th><th>Event</th><th>Status</th><th>By</th></tr></thead>
              <tbody>{(a.id === 'maxdealer'
                ? [{ when: 'Aug 30, 2026', what: 'Signed up', status: 'Pending Verification', by: 'Owner' }, { when: 'Aug 31, 2026', what: 'Verification approved', status: 'Active', by: 'admin.jess' }, { when: 'Sep 23, 2026', what: '5 confirmed reports: fake profile', status: 'Suspended', by: 'admin.mark' }]
                : statusHistory).map((h, i) => (
                <tr key={i}><td className="small nowrap">{h.when}</td><td>{h.what}</td><td><Badge>{h.status}</Badge></td><td className="small">{h.by}</td></tr>
              ))}</tbody>
            </table></div>
          </Card>
          <Card title={isPet ? 'Adoption requests' : 'Requests received'}>
            <div className="stack-sm small">
              {requests.filter((r) => r.pet === a.id || r.home === a.id).map((r) => (
                <div key={r.id} className="row between"><span>{findPet(r.pet).name} → {findHome(r.home).name}</span><span className="row"><Badge>{r.status}</Badge><Link to={`/admin/requests/${r.id}`}>View</Link></span></div>
              ))}
              {!requests.some((r) => r.pet === a.id || r.home === a.id) && <span className="muted">No requests.</span>}
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Verification">
            <dl className="kv small"><dt>Approved</dt><dd>Sep 13, 2026 by admin.jess</dd><dt>Documents</dt><dd>Valid ID{isPet ? ', vet record' : ''}</dd></dl>
            <div className="row" style={{ marginTop: 10 }}><Ph w={120} h={76} label="ID" />{isPet && <Ph w={120} h={76} label="Vet record" />}</div>
          </Card>
          <Card title="Reports against this account"><p className="small">{a.id === 'maxdealer' ? '5 reports · all confirmed' : 'None'}</p></Card>
          <Card title="Recent activity"><div className="stack-sm small"><span>Signed in · Sep 27</span><span>Edited profile · Sep 18</span><Link to="/admin/logs">Full activity log</Link></div></Card>
        </div>
      </div>
      {modal === 'suspend' && (
        <Modal title={`Suspend ${a.name}?`} sub="The profile is hidden and the owner sees only your reason." onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => act('Suspended', 'suspended')}>Suspend account</Btn></>}>
          <Field label="Reason (required, shown to the owner)" as="textarea" rows={3} placeholder="e.g. Multiple confirmed reports of misleading profile information." />
          <ul className="small reasons">
            <li>Open adoption requests are closed, and the other side is notified.</li>
            <li>Upcoming Meet & Greets are cancelled.</li>
            <li>You can reactivate the account later.</li>
          </ul>
        </Modal>
      )}
      {modal === 'reactivate' && (
        <Modal title={`Reactivate ${a.name}?`} sub="The account becomes Active and the profile is visible again." onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => act('Active', 'reactivated')}>Reactivate</Btn></>}>
          <dl className="kv small"><dt>Suspended</dt><dd>Sep 23, 2026 by admin.mark</dd><dt>Reason</dt><dd>5 confirmed reports: fake profile</dd></dl>
          <Field label="Note for the log (required)" as="textarea" rows={3} placeholder="e.g. Owner verified the photos with a vet certificate." />
        </Modal>
      )}
      {modal === 'deactivate' && (
        <Modal title={`Deactivate ${a.name}?`} sub="Removes the account from Pawfolio. Records are kept for adoption history and logs." onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => act('Deactivated', 'deactivated')}>Deactivate</Btn></>}>
          <Field label="Reason (required)" as="textarea" rows={3} placeholder="e.g. Duplicate account" />
          <Check label="I understand the owner won’t be able to sign in." />
        </Modal>
      )}
      {toastEl}
    </AdminShell>
  )
}

/* ---------------- Announcements ---------------- */
export function Announcements() {
  const [modal, setModal] = useModal()
  const [toastEl, toast] = useToast()
  const close = () => setModal(null)
  return (
    <AdminShell>
      <PageHead title="Announcements" sub="Platform-wide notifications. They appear in every recipient’s Alerts and on the feed." />
      <div className="grid2">
        <Card title="New announcement">
          <div className="stack">
            <Field label="Title" defaultValue="Adoption Week starts Oct 10" />
            <Field label="Message" as="textarea" rows={4} defaultValue="Shelters and fosters get featured on the landing page all week. Update your résumé photos!" />
            <div className="form-grid">
              <Field label="Audience" as="select" options={['Everyone', 'Pets only', 'Humans only']} />
              <Field label="Publish" as="select" options={['Now', 'Schedule…']} />
            </div>
            <Btn variant="primary" className="self-start" onClick={() => setModal('publish')}>Publish…</Btn>
          </div>
        </Card>
        <Card title="Past announcements">
          <div className="stack-sm">
            {[['Pawfolio Adoption Week starts Oct 10!', 'Sep 25 · Everyone · admin.jess'], ['New: request threads are live', 'Sep 1 · Everyone · admin.mark'], ['Reminder: keep vet records up to date', 'Aug 15 · Pets only · admin.jess']].map(([t, m]) => (
              <div key={t} className="list-row"><strong className="small">{t}</strong><div className="small muted">{m}</div></div>
            ))}
          </div>
        </Card>
      </div>
      {modal === 'publish' && (
        <Modal title="Publish announcement?" onClose={close}
          footer={<><Btn onClick={close}>Back to editing</Btn><Btn variant="primary" onClick={() => { close(); toast('published') }}>Publish now</Btn></>}>
          <div className="card" style={{ padding: 12 }}><strong>Adoption Week starts Oct 10</strong><p className="small">Shelters and fosters get featured on the landing page all week. Update your résumé photos!</p></div>
          <dl className="kv small"><dt>Audience</dt><dd>Everyone (312 active accounts)</dd><dt>Delivery</dt><dd>In-app notification + feed card</dd></dl>
        </Modal>
      )}
      {toastEl}
    </AdminShell>
  )
}

/* ---------------- Activity logs ---------------- */
export function Logs() {
  const modalParam = useInit('modal')
  const iParam = useInit('i', 0)
  const [open, setOpen] = useState(modalParam === 'log' ? Number(iParam) : null)
  const l = open !== null ? logs[open] : null
  return (
    <AdminShell>
      <PageHead title="Activity logs" sub="Every admin action and status change: who, what, when and why." actions={<><select style={{ width: 'auto' }}><option>All actors</option><option>Admins</option><option>System</option></select><select style={{ width: 'auto' }}><option>All types</option><option>Verification</option><option>Status change</option><option>Moderation</option><option>Account action</option></select><Btn small>Export CSV</Btn></>} />
      <Card>
        <div className="table-wrap"><table>
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Type</th><th>Why</th></tr></thead>
          <tbody>{logs.map((row, i) => (
            <tr key={i} className="clickable" onClick={() => setOpen(i)}>
              <td className="small nowrap">{row.when}</td><td>{row.who}</td><td>{row.what}</td><td><Badge>{row.type}</Badge></td><td className="small muted">{row.why}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {l && (
        <Drawer title="Log entry" sub={l.when} onClose={() => setOpen(null)} footer={<Btn onClick={() => setOpen(null)}>Close</Btn>}>
          <dl className="kv small">
            <dt>Actor</dt><dd>{l.who}</dd>
            <dt>Action</dt><dd>{l.what}</dd>
            <dt>Type</dt><dd>{l.type}</dd>
            <dt>Target</dt><dd>{l.target}</dd>
            <dt>Before</dt><dd><Badge>{l.before}</Badge></dd>
            <dt>After</dt><dd><Badge solid>{l.after}</Badge></dd>
            <dt>Reason</dt><dd>{l.why}</dd>
          </dl>
          <p className="small muted">Log entries can’t be edited or deleted.</p>
        </Drawer>
      )}
    </AdminShell>
  )
}
