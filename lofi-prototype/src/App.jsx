import { useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Proto, useProto } from './proto'
import { me } from './data'
import { ProtoBar, TopNav } from './components/Layout'
import { AccountStatus, EditSubmission, ForgotPassword, Landing, Login, ResetPassword, Signup, SignupPick } from './pages/auth'
import {
  Bookmarks, Browse, Feed, HomeProfile, Matches, MyActivity, NotFound, Notifications, PetProfile, PostDetail, Search, Settings, Stats,
} from './pages/shared'
import { RequestDetail, Requests } from './pages/requests'
import { Apply, Invites, ResumeEditor } from './pages/pet'
import { Availability, Quiz } from './pages/human'
import {
  AccountDetail, Accounts, AdminRequestDetail, Announcements, Dashboard, Logs, Monitor, ReportDetail, Reports, Resolve, Verification, VerificationDetail,
} from './pages/admin'
import { Card, Note, PageHead } from './components/ui'
import { MODULES, SCREENS } from './book/specs'

export default function App() {
  const [role, setRole] = useState('guest')
  const [acct, setAcct] = useState('Active')
  return (
    <Proto.Provider value={{ role, setRole, acct, setAcct }}>
      <HashRouter>
        <ProtoBar />
        <Shell />
      </HashRouter>
    </Proto.Provider>
  )
}

// Picks the route set for the current role and account status. Also used by the PDF book.
export function Shell() {
  const { role, acct } = useProto()
  const { pathname } = useLocation()
  if (pathname === '/screens') return <ScreenMap />
  if (role === 'guest') return <GuestRoutes />
  if (role === 'admin') return <AdminRoutes />
  if (acct !== 'Active') return <StatusRoutes />
  return <MemberRoutes />
}

function GuestRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/reset" element={<ResetPassword />} />
      <Route path="/signup" element={<SignupPick />} />
      <Route path="/signup/:type" element={<Signup />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// Pending, Denied and Suspended accounts only ever see these screens (Section 5.1).
function StatusRoutes() {
  return (
    <Routes>
      <Route path="/account/edit" element={<EditSubmission />} />
      <Route path="*" element={<AccountStatus />} />
    </Routes>
  )
}

function MemberRoutes() {
  const { role } = useProto()
  const isPet = role === 'pet'
  return (
    <>
      <TopNav />
      <Routes>
        <Route path="/feed" element={<Feed />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/search" element={<Search />} />
        <Route path="/pet/:id" element={<PetProfile />} />
        <Route path="/home/:id" element={<HomeProfile />} />
        <Route path="/me" element={isPet ? <PetProfile selfId={me.pet} /> : <HomeProfile selfId={me.human} />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/activity" element={<MyActivity />} />
        <Route path="/settings" element={<Settings />} />
        {isPet && <Route path="/apply/:homeId" element={<Apply />} />}
        {isPet && <Route path="/invites" element={<Invites />} />}
        {isPet && <Route path="/resume/edit" element={<ResumeEditor />} />}
        {!isPet && <Route path="/quiz" element={<Quiz />} />}
        {!isPet && <Route path="/availability" element={<Availability />} />}
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<Dashboard />} />
      <Route path="/admin/verification" element={<Verification />} />
      <Route path="/admin/verification/:id" element={<VerificationDetail />} />
      <Route path="/admin/reports" element={<Reports />} />
      <Route path="/admin/reports/:id" element={<ReportDetail />} />
      <Route path="/admin/monitor" element={<Monitor />} />
      <Route path="/admin/requests/:id" element={<AdminRequestDetail />} />
      <Route path="/admin/resolve" element={<Resolve />} />
      <Route path="/admin/accounts" element={<Accounts />} />
      <Route path="/admin/accounts/:id" element={<AccountDetail />} />
      <Route path="/admin/announcements" element={<Announcements />} />
      <Route path="/admin/logs" element={<Logs />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

// Index of every screen and dialog, grouped by module. Clicking one switches role and opens it.
function ScreenMap() {
  const { setRole, setAcct } = useProto()
  const nav = useNavigate()
  const open = (s) => { setRole(s.role); setAcct(s.acct || 'Active'); nav(s.url) }
  const groups = [{ key: 'global', no: 0, name: 'Navigation & global' }, ...MODULES]
  return (
    <div className="container">
      <PageHead title="All screens" sub={`${SCREENS.length} screens, dialogs and states. Click any one to open it as the right role.`} />
      <div className="stack">
        <Note>Grayscale on purpose: this is about layout and flow, not visual design. Blue dashed boxes are notes for reviewers and won’t exist in the real app.</Note>
        <Card>
          <div className="map-group">
            {groups.map((m) => (
              <section key={m.key}>
                <h3 style={{ marginBottom: 6 }}>{m.no ? `${m.no}. ` : ''}{m.name}</h3>
                {SCREENS.filter((s) => s.module === m.key).map((s) => (
                  <button key={s.id} onClick={() => open(s)}><b>{s.id}</b> {s.title}</button>
                ))}
              </section>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
