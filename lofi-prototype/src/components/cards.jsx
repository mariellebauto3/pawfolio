import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProto } from '../proto'
import { Badge, Btn, Card, Meter, Ph, Tag } from './ui'
import { comments, findAuthor, findHome, findPet, me } from '../data'

export const profileLink = (id) => (findPet(id) ? `/pet/${id}` : `/home/${id}`)

export function StatusBadge({ status }) {
  const hired = status === 'Adopted — Hired' || status === 'Adopted'
  return <Badge solid={hired}>{hired ? 'Hired' : status}</Badge>
}

// A ranked suggestion card: used by Pets for You (human) and Homes for You (pet).
export function MatchCard({ item, kind, actions, onWhy }) {
  const isPet = kind === 'pet'
  const href = isPet ? `/pet/${item.id}` : `/home/${item.id}`
  return (
    <Card>
      <div className="stack">
        <Link to={href}><Ph h={130} label={isPet ? 'Pet photo' : 'Home photo'} /></Link>
        <div className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <div className="stack-sm grow" style={{ gap: 2 }}>
            <Link to={href}><h3>{item.name}</h3></Link>
            <span className="small muted">
              {isPet ? `${item.breed} · ${item.age} · ${item.size}` : `${item.homeType} · ${item.household}`}
            </span>
            <span className="small muted">{item.city}, {item.province}</span>
          </div>
          {item.match > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div className="match">{item.match}%</div>
              <span className="small muted">match</span>
            </div>
          )}
        </div>
        {item.match > 0 && <Meter value={item.match} />}
        {isPet && <div className="row">{item.status !== 'Looking for a Home' && <StatusBadge status={item.status} />}{item.temperament.slice(0, 2).map((t) => <Tag key={t}>{t}</Tag>)}</div>}
        {item.reasons.length > 0 && (
          <ul className="small reasons">
            {item.reasons.slice(0, 2).map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
        {onWhy && <button type="button" className="linkish small" onClick={() => onWhy(item)}>Why this match?</button>}
        <div className="row">{actions}</div>
      </div>
    </Card>
  )
}

export function PostCard({ post, onReport, onDelete, onEdit, menuOpen, expanded }) {
  const { role } = useProto()
  const a = findAuthor(post.author)
  const mine = post.author === (role === 'pet' ? me.pet : me.human)
  const [liked, setLiked] = useState(false)
  const [open, setOpen] = useState(!!expanded)
  const list = comments[post.id] || comments.default
  return (
    <Card>
      <div className="stack">
        <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <Ph w={44} h={44} round label="" />
          <div className="grow stack-sm" style={{ gap: 0 }}>
            <Link to={profileLink(post.author)}><strong>{a.name}</strong></Link>
            <span className="small muted">
              {post.kind === 'pet' ? `${a.breed} · ${a.city}` : `${a.furparent ? 'Furparent · ' : ''}${a.city}`} · {post.when}
            </span>
          </div>
          <Badge solid={post.type === 'Hired'}>{post.type}</Badge>
          <details className="menu post-menu" open={menuOpen || undefined}>
            <summary aria-label="Post options">•••</summary>
            <div className="drop">
              {mine ? (
                <>
                  <a href="#edit" onClick={(e) => { e.preventDefault(); onEdit?.() }}>Edit post</a>
                  <a href="#delete" onClick={(e) => { e.preventDefault(); onDelete?.() }}>Delete post</a>
                </>
              ) : (
                <>
                  <a href="#save" onClick={(e) => e.preventDefault()}>Save post</a>
                  <a href="#report" onClick={(e) => { e.preventDefault(); onReport?.() }}>Report post</a>
                </>
              )}
              <a href="#copy" onClick={(e) => e.preventDefault()}>Copy link</a>
            </div>
          </details>
        </div>
        <p>{post.text}</p>
        {post.img && <Ph h={200} label="Post photo" />}
        {post.type === 'For Hire' && (
          <div className="row between card" style={{ padding: 10 }}>
            <span className="small">Auto-posted when {a.name}’s résumé went live · {a.breed} · {a.city}</span>
            <Btn small to={`/pet/${a.id}`}>View résumé</Btn>
          </div>
        )}
        <div className="row between small muted">
          <span>{post.reactions + (liked ? 1 : 0)} reactions</span>
          <Link to={`/post/${post.id}`}>{post.comments} comments</Link>
        </div>
      </div>
      <div className="post-actions">
        <button type="button" className={liked ? 'on' : ''} onClick={() => setLiked(!liked)}>{liked ? 'Liked' : 'Like'}</button>
        <button type="button" onClick={() => setOpen(!open)}>Comment</button>
        <button type="button">Share</button>
      </div>
      {open && (
        <div className="stack" style={{ marginTop: 8 }}>
          <div className="row" style={{ flexWrap: 'nowrap' }}><Ph w={32} h={32} round label="" /><input className="grow" placeholder="Add a comment…" /><Btn small variant="primary">Post</Btn></div>
          {list.map((c, i) => {
            const ca = findAuthor(c.author)
            return (
              <div key={i} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <Ph w={32} h={32} round label="" />
                <div className="grow comment">
                  <div className="row between"><strong className="small">{ca.name}</strong><span className="small muted">{c.when}</span></div>
                  <p className="small">{c.text}</p>
                  <div className="row small muted"><span>Like</span><span>Reply</span><span>Report</span></div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export function MiniProfile({ id, draft }) {
  const pet = findPet(id)
  const home = findHome(id)
  const p = pet || home
  return (
    <Card className="flush">
      <Ph h={56} label="" style={{ border: 0, borderRadius: 0 }} />
      <div className="stack" style={{ padding: 16, alignItems: 'center', textAlign: 'center' }}>
        <Ph w={72} h={72} round label="" style={{ marginTop: -52, border: '3px solid #fff' }} />
        <Link to="/me"><h3>{p.name}</h3></Link>
        <span className="small muted">
          {pet ? `${pet.breed} · ${pet.age} · ${pet.city}` : `${home.city} · ${home.homeType}`}
        </span>
        {pet ? <StatusBadge status={draft ? 'Draft' : pet.status} /> : (
          <div className="row" style={{ justifyContent: 'center' }}>
            {home.open && <Badge>Open to Adopt</Badge>}
            {home.furparent && <Badge solid>Furparent</Badge>}
          </div>
        )}
      </div>
      <div style={{ borderTop: '1px solid var(--line)', padding: 12 }} className="stack-sm small">
        <div className="row between"><span className="muted">Profile views</span><b>{pet ? pet.views : 36}</b></div>
        <div className="row between"><span className="muted">{pet ? 'Bookmarked by' : 'Saved pets'}</span><b>{pet ? pet.bookmarks : 4}</b></div>
      </div>
      <div style={{ borderTop: '1px solid var(--line)', padding: 12 }} className="stack-sm small">
        <Link to="/bookmarks">Bookmarks</Link>
        <Link to={pet ? '/invites' : '/availability'}>{pet ? 'Invites to Apply (2)' : 'Meet & Greet availability'}</Link>
        <Link to="/stats">{pet ? 'My stats' : 'Match & request history'}</Link>
      </div>
    </Card>
  )
}

export function Tags({ list }) {
  return <div className="row">{list.map((t) => <Tag key={t}>{t}</Tag>)}</div>
}
