import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useProto, roleHome } from '../proto'
import { findHome, findPet, me, notifications, verificationQueue } from '../data'
import { Btn, useInit } from './ui'

const ROLES = [['guest', 'Logged out'], ['pet', 'Pet'], ['human', 'Human'], ['admin', 'Admin']]

export function ProtoBar() {
  const { role, setRole, acct, setAcct } = useProto()
  const nav = useNavigate()
  const switchRole = (r) => {
    setRole(r)
    setAcct('Active')
    nav(roleHome[r])
  }
  return (
    <div className="protobar">
      <b>PAWFOLIO · LO-FI PROTOTYPE</b>
      <span>View as</span>
      <div className="seg">
        {ROLES.map(([r, label]) => (
          <button key={r} className={role === r ? 'on' : ''} onClick={() => switchRole(r)}>{label}</button>
        ))}
      </div>
      {(role === 'pet' || role === 'human') && (
        <label className="row">
          Account status
          <select value={acct} onChange={(e) => setAcct(e.target.value)}>
            {['Active', 'Pending Verification', 'Denied', 'Suspended'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      )}
      <span className="spacer" />
      <Link to="/screens">All screens</Link>
    </div>
  )
}

export function GuestNav() {
  return (
    <header className="topnav">
      <div className="inner">
        <Link to="/" className="logo"><i>PF</i>Pawfolio</Link>
        <nav className="row guest-links">
          <a href="#how">How it works</a>
          <a href="#hired">Success stories</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <Btn variant="ghost" to="/signup">Join now</Btn>
          <Btn to="/login">Sign in</Btn>
        </div>
      </div>
    </header>
  )
}

function NavItem({ to, label, count }) {
  return (
    <NavLink to={to}>
      <span className="ico" />
      <span className="lbl">{label}</span>
      {count ? <span className="dot">{count}</span> : null}
    </NavLink>
  )
}

const closeMenu = (e) => e.currentTarget.closest('details')?.removeAttribute('open')

export function TopNav() {
  const { role, setRole } = useProto()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const menu = useInit('menu')
  const q = useInit('q', '')
  const isPet = role === 'pet'
  const user = isPet ? findPet(me.pet) : findHome(me.human)
  const alerts = notifications[role] || []
  const logout = () => { setRole('guest'); nav('/') }
  const search = (e) => {
    e.preventDefault()
    nav(`/search?q=${encodeURIComponent(new FormData(e.currentTarget).get('q'))}`)
  }
  return (
    <header className="topnav">
      <div className="inner">
        <Link to="/feed" className="logo"><i>PF</i><span>Pawfolio</span></Link>
        <form className="search-form" onSubmit={search}>
          <input name="q" className="search" defaultValue={q} placeholder={isPet ? 'Search homes, pets, posts' : 'Search pets, people, posts'} />
        </form>
        <nav className="navlinks">
          <NavItem to="/feed" label="Home" />
          <NavItem to="/matches" label={isPet ? 'Homes for You' : 'Pets for You'} />
          <NavItem to="/browse" label="Browse" />
          <NavItem to="/requests" label="Requests" count={isPet ? 0 : 2} />
          <details className="menu" open={menu === 'alerts' || undefined}>
            <summary className={pathname.startsWith('/notifications') ? 'active' : ''}>
              <span className="ico" /><span className="lbl">Alerts</span><span className="dot">2</span>
            </summary>
            <div className="drop wide" onClick={closeMenu}>
              <div className="row between" style={{ padding: '4px 8px 8px' }}>
                <strong>Notifications</strong><span className="small muted">Mark all as read</span>
              </div>
              {alerts.slice(0, 4).map((n, i) => (
                <Link key={i} to="/notifications" className="notif">
                  <span className="ph round" style={{ width: 36, height: 36 }} />
                  <span className="grow"><b>{n.t}</b><br /><span className="small">{n.m}</span><br /><span className="small muted">{n.when} ago</span></span>
                  {n.unread && <i className="unread" />}
                </Link>
              ))}
              <Link to="/notifications" className="see-all">See all notifications</Link>
            </div>
          </details>
          <details className="menu" open={menu === 'me' || undefined}>
            <summary className={pathname === '/me' ? 'active' : ''}>
              <span className="ico" style={{ borderRadius: '50%' }} /><span className="lbl">Me ▾</span>
            </summary>
            <div className="drop" onClick={closeMenu}>
              <div className="row" style={{ padding: 8, flexWrap: 'nowrap' }}>
                <span className="ph round" style={{ width: 44, height: 44 }} />
                <div className="grow">
                  <strong>{user.name}</strong>
                  <div className="small muted">{isPet ? `${user.breed} · ${user.status}` : 'Furparent · Open to Adopt'}</div>
                </div>
              </div>
              <Link to="/me" className="btn sm" style={{ margin: '0 8px 8px' }}>View my {isPet ? 'résumé' : 'profile'}</Link>
              <div className="menu-label">{isPet ? 'Résumé' : 'Profile'}</div>
              {isPet ? <Link to="/resume/edit">Edit résumé</Link> : <Link to="/quiz">Edit Home Profile & quiz</Link>}
              {isPet ? <Link to="/invites">Invites to Apply</Link> : <Link to="/availability">Meet & Greet availability</Link>}
              <Link to="/bookmarks">Bookmarks</Link>
              <Link to="/stats">{isPet ? 'My stats' : 'Match & request history'}</Link>
              <div className="menu-label">Account</div>
              <Link to="/activity">My activity</Link>
              <Link to="/settings">Settings</Link>
              <a href="#logout" onClick={(e) => { e.preventDefault(); logout() }}>Log out</a>
            </div>
          </details>
        </nav>
      </div>
    </header>
  )
}

export const ADMIN_LINKS = [
  ['/admin', 'Dashboard'],
  ['/admin/verification', 'Verification', verificationQueue.length],
  ['/admin/reports', 'Reports', 3],
  ['/admin/monitor', 'Requests & Meets', 1],
  ['/admin/resolve', 'Resolve Issues'],
  ['/admin/accounts', 'Accounts & Alumni'],
  ['/admin/announcements', 'Announcements'],
  ['/admin/logs', 'Activity Logs'],
]

export function AdminSidebar() {
  const { setRole } = useProto()
  const nav = useNavigate()
  return (
    <aside className="sidebar">
      <div className="logo" style={{ padding: '4px 10px 12px' }}><i>PF</i>Pawfolio Admin</div>
      {ADMIN_LINKS.map(([to, label, n]) => (
        <NavLink key={to} to={to} end={to === '/admin'}>
          {label}{n ? <span className="badge">{n}</span> : null}
        </NavLink>
      ))}
      <div className="sidebar-user">
        <span className="ph round" style={{ width: 36, height: 36 }} />
        <div className="grow"><strong>admin.jess</strong><div className="small muted">Platform admin</div></div>
        <button type="button" className="btn sm ghost" onClick={() => { setRole('guest'); nav('/') }}>Log out</button>
      </div>
    </aside>
  )
}

export function AdminShell({ children }) {
  return (
    <div className="admin">
      <AdminSidebar />
      <main>{children}</main>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="inner">
        <span className="logo"><i>PF</i>Pawfolio</span>
        <nav className="row">
          <a href="#about">About</a><a href="#guidelines">Community guidelines</a><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#help">Help center</a>
        </nav>
        <span className="small muted">© 2026 Pawfolio</span>
      </div>
    </footer>
  )
}
