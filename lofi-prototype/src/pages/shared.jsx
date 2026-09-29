import { Fragment, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useProto } from '../proto'
import { activity, findAuthor, findHome, findPet, homes, invites, me, notifications, pets, posts, requests } from '../data'
import {
  Badge, Btn, Card, Choice, Empty, Field, Meter, Modal, Note, PageHead, Pagination, Ph, Tabs, Toggle,
  useInit, useModal, useToast,
} from '../components/ui'
import { MatchCard, MiniProfile, PostCard, StatusBadge, Tags } from '../components/cards'
import { AdoptionDetails, ConfirmDialog, CreatePost, MatchBreakdown, PhotoViewer, ReportDialog } from '../components/dialogs'

const CLOSED = ['Declined', 'Not Adopted', 'Withdrawn', 'Expired', 'Adopted']

/* ---------------- Feed ---------------- */
export function Feed() {
  const { role } = useProto()
  const isPet = role === 'pet'
  const myId = isPet ? me.pet : me.human
  const [modal, setModal] = useModal()
  const [toastEl, toast] = useToast()
  const close = () => setModal(null)
  const suggestions = isPet ? homes.slice(0, 3) : pets.filter((p) => p.status !== 'Adopted — Hired').slice(0, 3)
  return (
    <div className="container">
      <div className="grid3">
        <div><MiniProfile id={myId} /></div>
        <div className="stack">
          <Card>
            <div className="stack">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Ph w={44} h={44} round label="" />
                <button type="button" className="fake-input grow" onClick={() => setModal('post')}>
                  {isPet ? 'Share an update, Mochi…' : 'Start a post…'}
                </button>
              </div>
              <div className="row">
                <Btn variant="ghost" small onClick={() => setModal('post')}>Photo</Btn>
                {!isPet && <Btn variant="ghost" small onClick={() => setModal('story')}>Write an adoption story</Btn>}
              </div>
            </div>
          </Card>
          <div className="row between small muted"><span>Showing: everyone · shuffled</span><span>For Hire posts, pet updates, stories</span></div>
          <Note>One shuffled feed for everyone: auto “For Hire” posts, pet updates (including Hired pets), human posts and adoption stories. Separate from the ranked matches.</Note>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onReport={() => setModal('report')} onDelete={() => setModal('delete')} onEdit={() => setModal('edit')} />
          ))}
        </div>
        <div className="stack">
          <Card title={isPet ? 'Homes for You' : 'Pets for You'} action={<Link className="small" to="/matches">See all</Link>}>
            <div className="stack">
              {suggestions.map((s) => (
                <div className="row" key={s.id} style={{ flexWrap: 'nowrap' }}>
                  <Ph w={44} h={44} round={!isPet} label="" />
                  <div className="grow stack-sm" style={{ gap: 0 }}>
                    <Link to={isPet ? `/home/${s.id}` : `/pet/${s.id}`}><strong>{s.name}</strong></Link>
                    <span className="small muted">{s.city}</span>
                  </div>
                  <b>{s.match}%</b>
                </div>
              ))}
            </div>
          </Card>
          {isPet && (
            <Card title="Invites to Apply" action={<Link className="small" to="/invites">View</Link>}>
              <p className="small">{invites.length} homes invited you to apply.</p>
            </Card>
          )}
          <Card title="Announcement"><p className="small">Pawfolio Adoption Week starts Oct 10! Shelters and fosters get featured on the landing page.</p></Card>
        </div>
      </div>
      {modal === 'post' && <CreatePost onClose={close} onPost={() => { close(); toast('posted') }} />}
      {modal === 'story' && <CreatePost story onClose={close} onPost={() => { close(); toast('posted') }} />}
      {modal === 'edit' && <CreatePost edit onClose={close} onPost={close} />}
      {modal === 'report' && <ReportDialog target="this post" onClose={close} onSubmit={() => { close(); toast('report') }} />}
      {modal === 'delete' && (
        <ConfirmDialog title="Delete this post?" confirm="Delete post" onClose={close} onConfirm={() => { close(); toast('deleted') }}>
          <p>This can’t be undone. Reactions and comments on the post are removed too.</p>
        </ConfirmDialog>
      )}
      {toastEl}
    </div>
  )
}

/* ---------------- Post detail ---------------- */
export function PostDetail() {
  const { id } = useParams()
  const post = posts.find((p) => p.id === id) || posts[0]
  const a = findAuthor(post.author)
  const menu = useInit('menu')
  const [modal, setModal] = useModal()
  const [toastEl, toast] = useToast()
  const nav = useNavigate()
  const close = () => setModal(null)
  const others = posts.filter((p) => p.id !== post.id).slice(0, 2)
  return (
    <div className="container">
      <p className="small" style={{ marginBottom: 12 }}><Link to="/feed">← Back to feed</Link></p>
      <div className="grid2">
        <PostCard post={post} expanded menuOpen={menu === 'post'} onReport={() => setModal('report')} onDelete={() => setModal('delete')} onEdit={() => setModal('edit')} />
        <div className="stack">
          <Card title="About the author">
            <div className="stack" style={{ alignItems: 'flex-start' }}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Ph w={56} h={56} round label="" />
                <div><strong>{a.name}</strong><div className="small muted">{post.kind === 'pet' ? `${a.breed} · ${a.city}` : `${a.furparent ? 'Furparent · ' : ''}${a.city}`}</div></div>
              </div>
              <Btn small to={findPet(post.author) ? `/pet/${a.id}` : `/home/${a.id}`}>View {post.kind === 'pet' ? 'résumé' : 'profile'}</Btn>
            </div>
          </Card>
          <Card title="More posts">
            <div className="stack">{others.map((p) => (
              <Link key={p.id} to={`/post/${p.id}`} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <Ph w={40} h={40} label="" /><span className="small">{p.text.slice(0, 70)}…</span>
              </Link>
            ))}</div>
          </Card>
        </div>
      </div>
      {modal === 'report' && <ReportDialog target="this post" onClose={close} onSubmit={() => { close(); toast('report') }} />}
      {modal === 'edit' && <CreatePost edit story={post.type === 'Adoption Story'} onClose={close} onPost={close} />}
      {modal === 'delete' && (
        <ConfirmDialog title="Delete this post?" confirm="Delete post" onClose={close} onConfirm={() => nav('/feed?toast=deleted')}>
          <p>This can’t be undone. {post.reactions} reactions and {post.comments} comments will be removed too.</p>
        </ConfirmDialog>
      )}
      {toastEl}
    </div>
  )
}

/* ---------------- Pet résumé (profile) ---------------- */
export function PetProfile({ selfId }) {
  const params = useParams()
  const id = selfId || params.id
  const pet = findPet(id) || findPet('mochi')
  const { role } = useProto()
  const isSelf = role === 'pet' && pet.id === me.pet
  const draftParam = useInit('draft')
  const draft = isSelf && !!draftParam
  const [modal, setModal] = useModal()
  const [toastEl, toast] = useToast()
  const [saved, setSaved] = useState(!!useInit('saved'))
  const [invited, setInvited] = useState(false)
  const close = () => setModal(null)
  const hired = pet.status === 'Adopted — Hired'
  const parent = hired ? findHome(pet.hiredBy) : null
  const isParent = role === 'human' && parent?.id === me.human
  const canAct = role === 'human' && !hired

  return (
    <div className="container">
      <div className="grid2">
        <div className="stack">
          {draft && (
            <div className="banner">
              <div className="grow"><b>Your résumé is a Draft.</b> Add a health note and one more photo to go live. Drafts are hidden from search and matches.</div>
              <Btn small variant="primary" to="/resume/edit?step=5">Continue editing</Btn>
            </div>
          )}
          <Card className="flush">
            <Ph h={140} label="Cover photo" className="cover" />
            <div className="profile-head stack">
              <Ph w={112} h={112} round label="Pet photo" className="avatar" />
              <div className="stack-sm">
                <div className="row"><h1>{pet.name}</h1><StatusBadge status={draft ? 'Draft' : pet.status} /></div>
                <p>{pet.species} · {pet.breed} · {pet.sex} · {pet.age} · {pet.size}</p>
                <p className="small muted">{pet.city}, {pet.province} · Currently at: {pet.currentlyAt}</p>
                <p className="small muted">{pet.views} profile views · Bookmarked by {pet.bookmarks}</p>
              </div>
              {hired && (
                <div className="alumni">
                  <Ph w={40} h={40} round label="" />
                  <div className="grow"><strong>Hired by <Link to={`/home/${parent.id}`}>{parent.name}</Link></strong><div className="small muted">Alumni since {pet.hiredOn} · Profile permanently linked to the Furparent</div></div>
                  <Badge solid>Hired</Badge>
                </div>
              )}
              <div className="row">
                {isSelf && <><Btn variant="primary" to="/resume/edit">Edit résumé</Btn><Btn to="/stats">View stats</Btn><Btn variant="ghost">Share</Btn></>}
                {canAct && (
                  <>
                    <Btn variant="primary" onClick={() => setModal('invite')} disabled={invited}>{invited ? 'Invite sent ✓' : 'Invite to Apply'}</Btn>
                    <Btn onClick={() => { setSaved(!saved); toast(saved ? 'removed' : 'saved') }}>{saved ? 'Bookmarked ✓' : 'Bookmark'}</Btn>
                  </>
                )}
                {isParent && <><Btn variant="primary" onClick={() => setModal('adoption')}>Adoption details</Btn><Btn to="/feed?modal=story">Write an adoption story</Btn></>}
                {!isSelf && !isParent && <Btn variant="ghost" onClick={() => setModal('report')}>Report</Btn>}
              </div>
            </div>
          </Card>
          <Card title="About"><p>{pet.bio}</p></Card>
          <Card title="Photos" action={<span className="small muted">4 photos</span>}>
            <div className="photo-grid">
              {[1, 2, 3, 4].map((n) => (
                <button type="button" key={n} className="bare" onClick={() => setModal('photo')}><Ph h={110} label={`Photo ${n}`} /></button>
              ))}
            </div>
          </Card>
          <div className="grid-half">
            <Card title="Temperament"><Tags list={pet.temperament} /></Card>
            <Card title="Skills">
              <div className="stack-sm">{pet.skills.map((s) => <div key={s} className="row between"><span>{s}</span><span className="small muted">by caretaker</span></div>)}</div>
            </Card>
          </div>
          <Card title="Compatibility & needs">
            <dl className="kv">
              {Object.entries(pet.compat).map(([k, v]) => <Fragment key={k}><dt>Good with {k.toLowerCase()}</dt><dd>{v}</dd></Fragment>)}
              <dt>Energy level</dt><dd>{pet.energy}</dd>
              <dt>Can be left alone</dt><dd>{pet.alone}</dd>
              <dt>Space</dt><dd>{pet.space}</dd>
              <dt>Owner experience</dt><dd>{pet.experience}</dd>
              <dt>Special needs</dt><dd>{pet.special}</dd>
            </dl>
          </Card>
          <Card title="Health & vet notes"><p>{pet.health}</p></Card>
        </div>
        <div className="stack">
          {canAct && (
            <Card title="Your match">
              <div className="stack">
                <div className="match">{pet.match}% match</div>
                <Meter value={pet.match} />
                <ul className="small reasons">{pet.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                <button type="button" className="linkish small" onClick={() => setModal('why')}>See full breakdown</button>
              </div>
            </Card>
          )}
          {isSelf && (
            <Card title="Profile strength">
              <div className="stack"><Meter value={draft ? 70 : 90} /><p className="small">{draft ? 'Add a health note and 1 more photo to publish.' : 'Add 1 more photo to reach 100%.'}</p></div>
            </Card>
          )}
          <Card title="Latest activity">
            <div className="stack-sm small">
              <span>“Had my first Meet & Greet today…” · 1d</span>
              <span>“Look at my new bandana!” · 1w</span>
              <Link to="/feed">See all posts</Link>
            </div>
          </Card>
          <Card title="Similar pets">
            <div className="stack">{pets.filter((p) => p.id !== pet.id && p.status !== 'Adopted — Hired').slice(0, 3).map((p) => (
              <div className="row" key={p.id} style={{ flexWrap: 'nowrap' }}><Ph w={40} h={40} round label="" /><Link to={`/pet/${p.id}`}>{p.name}</Link><span className="small muted">{p.breed}</span></div>
            ))}</div>
          </Card>
        </div>
      </div>
      {modal === 'invite' && (
        <Modal title={`Invite ${pet.name} to apply`} sub="An invite is a nudge. The pet decides whether to send an adoption request." onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => { close(); setInvited(true); toast('invite') }}>Send invite</Btn></>}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Ph w={56} h={56} round label="" />
            <div className="grow"><strong>{pet.name}</strong><div className="small muted">{pet.breed} · {pet.age} · {pet.city}</div></div>
            <b>{pet.match}% match</b>
          </div>
          <Field label="Personal note (optional)" as="textarea" rows={3} placeholder="e.g. Your résumé made us smile. We’d love to meet you!" />
          <p className="small muted">Your Home Profile is attached. Your address and phone number stay private.</p>
        </Modal>
      )}
      {modal === 'report' && <ReportDialog target={`${pet.name}’s profile`} onClose={close} onSubmit={() => { close(); toast('report') }} />}
      {modal === 'photo' && <PhotoViewer name={pet.name} onClose={close} />}
      {modal === 'why' && <MatchBreakdown item={pet} onClose={close} />}
      {modal === 'adoption' && hired && <AdoptionDetails pet={pet} onClose={close} />}
      {toastEl}
    </div>
  )
}

/* ---------------- Human Home Profile ---------------- */
export function HomeProfile({ selfId }) {
  const params = useParams()
  const id = selfId || params.id
  const h = findHome(id) || findHome('santos')
  const { role } = useProto()
  const nav = useNavigate()
  const isSelf = role === 'human' && h.id === me.human
  const [open, setOpen] = useState(h.open)
  const [saved, setSaved] = useState(false)
  const [modal, setModal] = useModal()
  const [toastEl, toast] = useToast()
  const close = () => setModal(null)
  const adopted = pets.filter((p) => p.hiredBy === h.id)
  const [detailsFor, setDetailsFor] = useState(modal === 'adoption' ? adopted[0] : null)
  const existing = role === 'pet' ? requests.find((r) => r.pet === me.pet && r.home === h.id) : null
  const active = existing && !CLOSED.includes(existing.status)
  const cooldown = existing && ['Declined', 'Not Adopted'].includes(existing.status)
  const apply = () => (cooldown ? setModal('cooldown') : nav(`/apply/${h.id}`))
  const toggleOpen = (v) => (v ? setOpen(true) : setModal('close'))

  return (
    <div className="container">
      <div className="grid2">
        <div className="stack">
          <Card className="flush">
            <Ph h={140} label="Cover photo" className="cover" />
            <div className="profile-head stack">
              <Ph w={112} h={112} round label="Photo" className="avatar" />
              <div className="stack-sm">
                <div className="row"><h1>{h.name}</h1>{open && <Badge>Open to Adopt</Badge>}{h.furparent && <Badge solid>Furparent</Badge>}</div>
                <p>{h.homeType} · {h.household}</p>
                <p className="small muted">{h.city}, {h.province}</p>
              </div>
              <div className="row">
                {isSelf && (
                  <>
                    <Btn variant="primary" to="/quiz">Edit Home Profile & quiz</Btn>
                    <Btn onClick={() => setModal('intro')}>Edit intro</Btn>
                    <Toggle on={open} onChange={toggleOpen} label="Open to Adopt" />
                  </>
                )}
                {role === 'pet' && (active
                  ? <Btn variant="primary" to={`/requests/${existing.id}`}>View my request ({existing.status})</Btn>
                  : h.open
                    ? <Btn variant="primary" onClick={apply}>Apply for this home</Btn>
                    : <Btn disabled>Not accepting requests</Btn>)}
                {role === 'pet' && <Btn onClick={() => { setSaved(!saved); toast(saved ? 'removed' : 'saved') }}>{saved ? 'Bookmarked ✓' : 'Bookmark'}</Btn>}
                {!isSelf && <Btn variant="ghost" onClick={() => setModal('report')}>Report</Btn>}
              </div>
              {cooldown && <p className="small muted">You can apply to this home again on Oct 10.</p>}
              {isSelf && !open && <Note>Open to Adopt is off: pets can’t send you new requests. Requests already in progress continue.</Note>}
              {!isSelf && <Note>Public view shows city and a household summary only. Exact address and phone are shared after a Meet & Greet is confirmed.</Note>}
            </div>
          </Card>
          <Card title="About our home"><p>{h.about}</p></Card>
          <div className="grid-half">
            <Card title="Household & space">
              <dl className="kv"><dt>Home type</dt><dd>{h.homeType}</dd><dt>Outdoor space</dt><dd>{h.outdoor}</dd><dt>Household</dt><dd>{h.household}</dd><dt>Other pets</dt><dd>{h.otherPets}</dd></dl>
            </Card>
            <Card title="Lifestyle">
              <dl className="kv"><dt>Activity level</dt><dd>{h.activity}</dd><dt>Hours away</dt><dd>{h.away}</dd><dt>Experience</dt><dd>{h.experience}</dd></dl>
            </Card>
          </div>
          <Card title="What we’re looking for">
            <dl className="kv"><dt>Preferred pet</dt><dd>{h.looking}</dd><dt>Special needs</dt><dd>{h.specialNeeds}</dd></dl>
          </Card>
          {adopted.length > 0 && (
            <Card title="Adopted pets (Alumni)">
              <div className="stack">{adopted.map((p) => (
                <div className="alumni" key={p.id}>
                  <Ph w={48} h={48} round label="" />
                  <div className="grow"><Link to={`/pet/${p.id}`}><strong>{p.name}</strong></Link><div className="small muted">{p.breed} · Hired {p.hiredOn}</div></div>
                  <Badge solid>Hired</Badge>
                  {isSelf && <Btn small onClick={() => setDetailsFor(p)}>Adoption details</Btn>}
                </div>
              ))}</div>
            </Card>
          )}
        </div>
        <div className="stack">
          {role === 'pet' && (
            <Card title="Your match">
              <div className="stack">
                <div className="match">{h.match}% match</div><Meter value={h.match} />
                <ul className="small reasons">{h.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                <button type="button" className="linkish small" onClick={() => setModal('why')}>See full breakdown</button>
              </div>
            </Card>
          )}
          {isSelf && (
            <Card title="Profile checklist">
              <div className="stack-sm small"><span>✓ Home Profile</span><span>✓ Lifestyle quiz</span><span>✓ Meet & Greet slots (3 open)</span><span className="muted">○ Profile photo</span></div>
            </Card>
          )}
          {isSelf && <Card title="Profile views"><p className="small"><b>36</b> pets viewed your Home Profile this month.</p></Card>}
        </div>
      </div>
      {modal === 'intro' && (
        <Modal title="Edit intro" onClose={close} width={600}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => { close(); toast('intro') }}>Save</Btn></>}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Ph w={200} h={70} label="Cover photo" /><Ph w={70} h={70} round label="Photo" />
            <div className="stack-sm"><Btn small>Change cover</Btn><Btn small>Change photo</Btn></div>
          </div>
          <Field label="Display name" defaultValue={h.name} locked hint="Verified name. Request a change in Settings." />
          <Field label="Headline" defaultValue="Family of three · weekend park people" />
          <Field label="About our home" as="textarea" rows={3} defaultValue={h.about} />
          <Field label="City shown on profile" defaultValue={`${h.city}, ${h.province}`} locked />
        </Modal>
      )}
      {modal === 'close' && (
        <ConfirmDialog title="Turn off Open to Adopt?" confirm="Turn off" onClose={close} onConfirm={() => { setOpen(false); close() }}>
          <ul className="small reasons">
            <li>Pets can’t send you new adoption requests.</li>
            <li>You won’t appear in pets’ Homes for You.</li>
            <li>Requests already in progress continue (3 active).</li>
          </ul>
          <p className="small muted">You can turn it back on at any time.</p>
        </ConfirmDialog>
      )}
      {modal === 'limit' && (
        <Modal title="You already have 3 open requests" sub="A pet can have up to 3 open requests at a time." onClose={close}
          footer={<><Btn onClick={close}>Not now</Btn><Btn variant="primary" to="/requests">Manage my requests</Btn></>}>
          <p>To apply to {h.name}, withdraw one of your open requests or wait until one closes.</p>
          <div className="stack-sm">
            {[['Ana Santos', 'Meet Scheduled'], ['Marco Reyes', 'On Hold'], ['Jun Villanueva', 'Sent']].map(([n, s]) => (
              <div key={n} className="row card" style={{ padding: 10, flexWrap: 'nowrap' }}><Ph w={32} h={32} round label="" /><span className="grow">{n}</span><Badge>{s}</Badge></div>
            ))}
          </div>
        </Modal>
      )}
      {modal === 'cooldown' && (
        <Modal title={`You can apply to ${h.name} again on Oct 10`} sub="After a Declined or Not Adopted result, a pet waits 30 days before applying to the same home." onClose={close}
          footer={<><Btn to="/matches">See other homes</Btn><Btn variant="primary" onClick={close}>OK</Btn></>}>
          <dl className="kv small"><dt>Last request</dt><dd>Sent Sep 2 · Declined Sep 10</dd><dt>Cooldown ends</dt><dd>Oct 10, 2026</dd></dl>
        </Modal>
      )}
      {modal === 'report' && <ReportDialog target={`${h.name}’s profile`} onClose={close} onSubmit={() => { close(); toast('report') }} />}
      {modal === 'why' && <MatchBreakdown item={h} onClose={close} />}
      {detailsFor && <AdoptionDetails pet={detailsFor} onClose={() => { setDetailsFor(null); close() }} />}
      {toastEl}
    </div>
  )
}

/* ---------------- Matches: Pets for You / Homes for You ---------------- */
export function Matches() {
  const { role } = useProto()
  const isPet = role === 'pet'
  const empty = useInit('empty')
  const whyId = useInit('id')
  const [open, setOpen] = useState(true)
  const [why, setWhy] = useState(useInit('modal') === 'why' ? (isPet ? findHome(whyId || 'santos') : findPet(whyId || 'mochi')) : null)
  const [toastEl, toast] = useToast()
  const list = isPet ? homes : pets.filter((p) => p.status !== 'Adopted — Hired')
  const title = isPet ? 'Homes for You' : 'Pets for You'
  if (empty) {
    return (
      <div className="container">
        <PageHead title={title} />
        <Card>
          {empty === 'quiz' ? (
            <Empty title="Finish your Home Profile to see your matches"
              body="Pets for You compares your lifestyle quiz with each pet’s résumé. It takes about 5 minutes."
              action={<div className="stack" style={{ alignItems: 'center' }}>
                <div className="checklist small"><span>✓ Account verified</span><span>○ Home Profile</span><span>○ Lifestyle quiz</span><span>○ Open to Adopt</span></div>
                <Btn variant="primary" to="/quiz">Take the lifestyle quiz</Btn>
              </div>} />
          ) : (
            <Empty title="Finish your résumé to see Homes for You"
              body="Your résumé is still a Draft. Homes for You compares it with each human’s Home Profile."
              action={<Btn variant="primary" to="/resume/edit?step=5">Continue résumé</Btn>} />
          )}
        </Card>
      </div>
    )
  }
  return (
    <div className="container">
      <PageHead
        title={title}
        sub={isPet ? 'Humans who are Open to Adopt, ranked by how well their home fits you.' : 'Pets ranked by how well they fit your Home Profile and quiz.'}
        actions={isPet ? <span className="badge">2 of 3 open requests used</span> : <Toggle on={open} onChange={setOpen} label="Open to Adopt" />}
      />
      <div className="stack">
        <div className="row between">
          <Choice options={isPet ? ['All homes', 'Houses', 'Condos', 'With kids', 'No other pets'] : ['All pets', 'Dogs', 'Cats', 'Small', 'Senior']} initial={[isPet ? 'All homes' : 'All pets']} />
          <select style={{ width: 'auto' }}><option>Sort: Best match</option><option>Newest</option></select>
        </div>
        <Note>Dealbreakers are removed first (species not accepted, kids/pet incompatibility, different province). Then sorted by score, then newest. Scores update when a quiz or résumé changes.</Note>
        {!isPet && !open && <Card><p>Turn on <b>Open to Adopt</b> so pets can find you and send requests.</p></Card>}
        <div className="cards">
          {list.map((item) => (
            <MatchCard key={item.id} item={item} kind={isPet ? 'home' : 'pet'} onWhy={setWhy} actions={isPet
              ? <><Btn small variant="primary" to={`/home/${item.id}`}>View home</Btn><Btn small onClick={() => toast('saved')}>Bookmark</Btn></>
              : <><Btn small variant="primary" to={`/pet/${item.id}`}>View résumé</Btn><Btn small onClick={() => toast('saved')}>Bookmark</Btn></>} />
          ))}
        </div>
      </div>
      {why && <MatchBreakdown item={why} onClose={() => setWhy(null)} />}
      {toastEl}
    </div>
  )
}

/* ---------------- Browse & search ---------------- */
export function Browse() {
  const { role } = useProto()
  const isPet = role === 'pet'
  const list = isPet ? homes : pets.filter((p) => p.status !== 'Adopted — Hired')
  return (
    <div className="container">
      <PageHead title={isPet ? 'Browse homes' : 'Browse pets'} sub={`${isPet ? 42 : 87} results in Metro Manila`} />
      <div className="grid-side">
        <Card title="Filters" action={<a className="small" href="#clear">Clear all</a>}>
          <div className="stack">
            <Field label="Location" as="select" options={['All of Metro Manila', 'Quezon City', 'Pasig', 'Marikina', 'Caloocan']} />
            {isPet ? (
              <>
                <Choice label="Home type" options={['House', 'Condo', 'Apartment']} multi />
                <Choice label="Outdoor space" options={['Yard', 'Balcony', 'None']} multi />
                <Choice label="Other pets" options={['None', 'Dogs', 'Cats']} multi />
                <Choice label="Kids at home" options={['Yes', 'No']} />
                <Choice label="Activity level" options={['Relaxed', 'Moderate', 'Active']} multi />
              </>
            ) : (
              <>
                <Choice label="Species" options={['Dog', 'Cat', 'Other']} multi initial={['Dog']} />
                <Choice label="Age" options={['Puppy/Kitten', 'Adult', 'Senior']} multi />
                <Choice label="Size" options={['Small', 'Medium', 'Large']} multi />
                <Choice label="Temperament" options={['Calm', 'Playful', 'Cuddly', 'Independent']} multi />
                <Choice label="Good with" options={['Kids', 'Dogs', 'Cats']} multi />
              </>
            )}
            <Btn variant="primary">Show results</Btn>
          </div>
        </Card>
        <div className="stack">
          <div className="row between" style={{ flexWrap: 'nowrap' }}>
            <input className="grow" placeholder={isPet ? 'Search by name or city' : 'Search by name, breed…'} />
            <select style={{ width: 'auto' }}><option>Sort: Best match</option><option>Newest</option></select>
          </div>
          {!isPet && <div className="row small"><span className="muted">Active filters:</span><span className="tag">Dog ✕</span><span className="tag">Metro Manila ✕</span></div>}
          <div className="cards">
            {list.map((item) => (
              <MatchCard key={item.id} item={item} kind={isPet ? 'home' : 'pet'} actions={<Btn small to={isPet ? `/home/${item.id}` : `/pet/${item.id}`}>View</Btn>} />
            ))}
          </div>
          <Pagination />
          {!isPet && <Note>Adopted pets never appear in search or matches.</Note>}
          {isPet && <Note>Home cards show public details only — city and household summary. No exact address or phone number.</Note>}
        </div>
      </div>
    </div>
  )
}

export function Search() {
  const q = useInit('q', '')
  const [tab, setTab] = useState('All')
  const term = q.trim().toLowerCase()
  const petHits = pets.filter((p) => p.status !== 'Adopted — Hired' && [p.name, p.breed, p.species, p.city].join(' ').toLowerCase().includes(term))
  const homeHits = homes.filter((h) => [h.name, h.city, h.homeType].join(' ').toLowerCase().includes(term))
  const postHits = posts.filter((p) => p.text.toLowerCase().includes(term))
  const none = !petHits.length && !homeHits.length && !postHits.length
  const show = (t) => tab === 'All' || tab.startsWith(t)
  return (
    <div className="container">
      <PageHead title={`Results for “${q}”`} sub={none ? 'No results' : `${petHits.length + homeHits.length + postHits.length} results`} />
      {none ? (
        <Card>
          <Empty title={`No results for “${q}”`} body="Check the spelling, or try a broader word like a species (“dog”), a breed (“aspin”) or a city."
            action={<div className="row"><Btn to="/browse">Browse all</Btn><Btn variant="primary" to="/matches">See your matches</Btn></div>} />
        </Card>
      ) : (
        <div className="grid-side">
          <Card title="Filter results">
            <div className="stack-sm">
              {[['All', petHits.length + homeHits.length + postHits.length], ['Pets', petHits.length], ['Homes', homeHits.length], ['Posts', postHits.length]].map(([t, n]) => (
                <button type="button" key={t} className={`side-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}><span>{t}</span><span>{n}</span></button>
              ))}
            </div>
          </Card>
          <div className="stack">
            {show('Pets') && petHits.length > 0 && (
              <Card title={`Pets (${petHits.length})`}>
                <div className="stack">{petHits.map((p) => (
                  <div key={p.id} className="row result" style={{ flexWrap: 'nowrap' }}>
                    <Ph w={64} h={64} label="" />
                    <div className="grow"><Link to={`/pet/${p.id}`}><strong>{p.name}</strong></Link><div className="small muted">{p.species} · {p.breed} · {p.age} · {p.city}</div><div className="row" style={{ marginTop: 4 }}><StatusBadge status={p.status} /></div></div>
                    <b>{p.match}% match</b>
                    <Btn small to={`/pet/${p.id}`}>View résumé</Btn>
                  </div>
                ))}</div>
              </Card>
            )}
            {show('Homes') && homeHits.length > 0 && (
              <Card title={`Homes (${homeHits.length})`}>
                <div className="stack">{homeHits.map((h) => (
                  <div key={h.id} className="row result" style={{ flexWrap: 'nowrap' }}>
                    <Ph w={64} h={64} round label="" />
                    <div className="grow"><Link to={`/home/${h.id}`}><strong>{h.name}</strong></Link><div className="small muted">{h.homeType} · {h.household} · {h.city}</div></div>
                    {h.open && <Badge>Open to Adopt</Badge>}
                    <Btn small to={`/home/${h.id}`}>View profile</Btn>
                  </div>
                ))}</div>
              </Card>
            )}
            {show('Posts') && postHits.length > 0 && (
              <Card title={`Posts (${postHits.length})`}>
                <div className="stack">{postHits.map((p) => (
                  <Link key={p.id} to={`/post/${p.id}`} className="row result" style={{ flexWrap: 'nowrap' }}>
                    <Ph w={44} h={44} round label="" /><span className="grow small">{p.text}</span><Badge>{p.type}</Badge>
                  </Link>
                ))}</div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------- Notifications ---------------- */
export function Notifications() {
  const { role } = useProto()
  const [tab, setTab] = useState('All')
  const list = (notifications[role] || []).filter((n) => tab === 'All' || n.cat === tab)
  return (
    <div className="container narrow">
      <PageHead title="Notifications" actions={<><Btn small variant="ghost">Mark all as read</Btn><Btn small variant="ghost" to="/settings">Settings</Btn></>} />
      <Card>
        <Tabs tabs={['All', 'Requests', 'Meet & Greets', 'Account']} value={tab} onChange={setTab} />
        <div className="stack">
          {list.map((n, i) => (
            <div key={i} className={`row notif-row ${n.unread ? 'unread' : ''}`} style={{ flexWrap: 'nowrap' }}>
              <Ph w={44} h={44} round label="" />
              <div className="grow"><strong>{n.t}</strong><p className="small">{n.m}</p></div>
              <span className="small muted">{n.when} ago</span>
              {n.unread && <i className="unread-dot" />}
            </div>
          ))}
        </div>
      </Card>
      <p className="small muted" style={{ marginTop: 12 }}>Notifications are in-app only. Email and SMS are future scope.</p>
    </div>
  )
}

/* ---------------- Bookmarks ---------------- */
export function Bookmarks() {
  const { role } = useProto()
  const isPet = role === 'pet'
  const empty = useInit('empty')
  const [toastEl, toast] = useToast()
  const list = isPet ? homes.slice(0, 2) : pets.filter((p) => p.status !== 'Adopted — Hired').slice(0, 3)
  return (
    <div className="container">
      <PageHead title="Bookmarks" sub={isPet ? 'Homes you saved' : 'Pets you saved'} />
      {empty ? (
        <Card>
          <Empty title={`No saved ${isPet ? 'homes' : 'pets'} yet`}
            body={`Tap Bookmark on any ${isPet ? 'Home Profile' : 'résumé'} to keep it here for later.`}
            action={<Btn variant="primary" to="/matches">{isPet ? 'See Homes for You' : 'See Pets for You'}</Btn>} />
        </Card>
      ) : (
        <div className="cards">
          {list.map((item) => (
            <MatchCard key={item.id} item={item} kind={isPet ? 'home' : 'pet'}
              actions={<><Btn small to={isPet ? `/home/${item.id}` : `/pet/${item.id}`}>View</Btn><Btn small variant="ghost" onClick={() => toast('removed')}>Remove</Btn></>} />
          ))}
        </div>
      )}
      {toastEl}
    </div>
  )
}

/* ---------------- Stats ---------------- */
export function Stats() {
  const { role } = useProto()
  const isPet = role === 'pet'
  const mine = requests.filter((r) => (isPet ? r.pet === me.pet : r.home === me.human))
  return (
    <div className="container">
      <PageHead title={isPet ? 'My stats' : 'Match & request history'} actions={<select style={{ width: 'auto' }}><option>Last 30 days</option><option>All time</option></select>} />
      <div className="stack">
        <div className="kpis">
          {(isPet
            ? [['Profile views', 148, '+32 this week'], ['Bookmarked by', 23, '+5 this week'], ['Requests sent', 3, '2 open'], ['Invites received', 2, '1 new']]
            : [['Pets matched', 14, '80%+ match: 5'], ['Pets bookmarked', 4, ''], ['Requests received', 5, '2 need action'], ['Pets adopted', 1, 'Luna']]
          ).map(([k, v, s]) => <Card key={k} className="kpi"><div className="small muted">{k}</div><div className="v">{v}</div><div className="small muted">{s}</div></Card>)}
        </div>
        <div className="grid-half">
          <Card title={isPet ? 'Profile views (last 30 days)' : 'Match scores of pets you viewed'}><Ph h={170} label={isPet ? 'Line chart: views per day' : 'Histogram: match scores'} /></Card>
          <Card title={isPet ? 'Where views come from' : 'Requests by outcome'}><Ph h={170} label={isPet ? 'Bar: Homes for You · Search · Feed' : 'Bar: Adopted · Declined · Withdrawn · Open'} /></Card>
        </div>
        <Card title="Request history">
          <div className="table-wrap"><table>
            <thead><tr><th>{isPet ? 'Home' : 'Pet'}</th><th>Sent</th><th>Status</th><th>Last update</th><th /></tr></thead>
            <tbody>{mine.map((r) => (
              <tr key={r.id}><td>{isPet ? findHome(r.home).name : findPet(r.pet).name}</td><td>{r.sent}</td><td><Badge solid={r.status === 'Adopted'}>{r.status}</Badge></td><td>{r.updated}</td><td><Link to={`/requests/${r.id}`}>Open</Link></td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      </div>
    </div>
  )
}

/* ---------------- Settings ---------------- */
export function Settings() {
  const { role } = useProto()
  const isPet = role === 'pet'
  const [modal, setModal] = useModal()
  const [toastEl, toast] = useToast()
  const nav = useNavigate()
  const close = () => setModal(null)
  const [prefs, setPrefs] = useState({ req: true, meet: true, feed: false, ann: true })
  return (
    <div className="container narrow">
      <PageHead title="Settings" sub="Manage your account, contact details and notifications." />
      <div className="stack">
        <Card title="Verified details" action={<Btn small onClick={() => setModal('change')}>Request a change</Btn>}>
          <div className="stack">
            <div className="form-grid">
              {isPet ? (
                <><Field label="Name" defaultValue="Mochi" locked /><Field label="Species" defaultValue="Dog" locked /><Field label="Breed" defaultValue="Aspin" locked /><Field label="Approximate age" defaultValue="2 years" locked /></>
              ) : (
                <><Field label="Full name" defaultValue="Ana Santos" locked /><Field label="Birthdate" defaultValue="Mar 4, 1990" locked /></>
              )}
            </div>
            <p className="small muted">Checked during verification, so they’re locked. Other profile edits go live right away.</p>
          </div>
        </Card>
        <Card title={isPet ? 'Caretaker contact' : 'Contact details'}>
          <div className="stack">
            <div className="form-grid">
              <Field label={isPet ? 'Caretaker name' : 'Contact number'} defaultValue={isPet ? 'Joy Lim' : '0917 XXX XXXX'} />
              <Field label={isPet ? 'Caretaker contact number' : 'Street address'} defaultValue={isPet ? '0917 XXX XXXX' : '12 Sample St., Brgy. Example'} />
            </div>
            <p className="small muted">{isPet ? 'After adoption the pet keeps its account. Update this to the Furparent’s details once the login is handed over.' : 'Private. Shared only with the other side after a Meet & Greet is confirmed.'}</p>
            <Btn small variant="primary" className="self-start">Save</Btn>
          </div>
        </Card>
        <Card title="Notifications">
          <div className="stack-sm">
            {[['req', 'Adoption requests and invites'], ['meet', 'Meet & Greet bookings and reminders'], ['feed', 'Reactions and comments on my posts'], ['ann', 'Announcements from Pawfolio']].map(([k, label]) => (
              <div key={k} className="row between"><span>{label}</span><Toggle on={prefs[k]} onChange={(v) => setPrefs({ ...prefs, [k]: v })} label="" /></div>
            ))}
          </div>
        </Card>
        <Card title="Sign-in & security">
          <div className="stack">
            <Field label="Email" defaultValue={isPet ? 'mochi.happypaws@email.com' : 'ana.santos@email.com'} />
            <div className="row"><Btn small onClick={() => setModal('password')}>Change password</Btn><Btn small variant="ghost" to="/activity">See sign-in activity</Btn></div>
          </div>
        </Card>
        <Card title="Close account">
          <div className="row between">
            <p className="small muted">Your profile is hidden. Adoption history and logs are kept.</p>
            <Btn small onClick={() => setModal('deactivate')}>Deactivate account</Btn>
          </div>
        </Card>
      </div>
      {modal === 'change' && (
        <Modal title="Request a change to verified details" sub="An admin reviews the change before it’s applied." onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => { close(); toast('change') }}>Send request</Btn></>}>
          <Field label="Field to change" as="select" options={isPet ? ['Name', 'Species', 'Breed', 'Approximate age'] : ['Full name', 'Birthdate']} />
          <Field label="New value" placeholder={isPet ? 'e.g. Mochi Santos' : 'e.g. Ana Santos-Reyes'} />
          <Field label="Reason" as="textarea" rows={3} placeholder="e.g. Vet confirmed a different breed" />
          <Field label="Supporting document (optional)" as="file" placeholder="document" />
        </Modal>
      )}
      {modal === 'password' && (
        <Modal title="Change password" onClose={close}
          footer={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" onClick={() => { close(); toast('password') }}>Update password</Btn></>}>
          <Field label="Current password" type="password" />
          <Field label="New password" type="password" hint="At least 8 characters, with a number and a letter." />
          <Field label="Confirm new password" type="password" />
          <p className="small muted">Other devices will be signed out.</p>
        </Modal>
      )}
      {modal === 'deactivate' && (
        <Modal title="Deactivate your account?" onClose={close}
          footer={<><Btn onClick={close}>Keep my account</Btn><Btn variant="primary" onClick={() => nav('/')}>Deactivate</Btn></>}>
          <ul className="small reasons">
            <li>Your profile is hidden from everyone.</li>
            <li>Open adoption requests and Meet & Greets are closed, and the other side is notified.</li>
            <li>Adoption history and activity logs are kept.</li>
          </ul>
          <Field label="Why are you leaving? (optional)" as="select" options={['Choose a reason', 'Pet was adopted outside Pawfolio', 'No longer adopting', 'Privacy concerns', 'Other']} />
          <Field label="Enter your password to confirm" type="password" />
        </Modal>
      )}
      {toastEl}
    </div>
  )
}

/* ---------------- My activity ---------------- */
export function MyActivity() {
  const { role } = useProto()
  const all = activity[role] || []
  const [tab, setTab] = useState('All')
  const types = ['All', ...new Set(all.map((a) => a.type))]
  const list = all.filter((a) => tab === 'All' || a.type === tab)
  return (
    <div className="container narrow">
      <PageHead title="My activity" sub="Important actions on your account. Only you and admins can see this." actions={<Btn small variant="ghost">Download CSV</Btn>} />
      <Card>
        <Tabs tabs={types} value={tab} onChange={setTab} />
        <div className="table-wrap"><table>
          <thead><tr><th>When</th><th>Activity</th><th>Type</th></tr></thead>
          <tbody>{list.map((a, i) => <tr key={i}><td className="small nowrap">{a.when}</td><td>{a.what}</td><td><Badge>{a.type}</Badge></td></tr>)}</tbody>
        </table></div>
      </Card>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="container">
      <Card className="center-card">
        <Empty title="This page doesn’t exist" body="The link may be broken, or the profile may be hidden or deactivated."
          action={<div className="row"><Btn to="/browse">Browse</Btn><Btn variant="primary" to="/feed">Back to feed</Btn></div>} />
      </Card>
    </div>
  )
}
