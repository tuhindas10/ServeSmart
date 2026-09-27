import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Navbar from '../../components/Navbar'
import Tag from '../../components/Tag'
import StatStrip from '../../components/StatStrip'
import { getCurrentUser, allUsers } from '../../lib/auth'
import {
  ticketCode,
  PRIORITY_META,
  STATUS_META,
  priorityOrder,
} from '../../lib/meta'

// Static list: computed once, not on every render
const technicians = allUsers().filter((u) => u.role === 'technician')
const isFinished = (t) => ['Resolved', 'Closed'].includes(t.status)

function byPriority(a, b) {
  return (
    priorityOrder(a.priority) - priorityOrder(b.priority) ||
    new Date(a.createdAt) - new Date(b.createdAt)
  )
}

export default function AdminAssign() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [allTickets, setAllTickets] = useState([])
  const [selections, setSelections] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [working, setWorking] = useState(null)
  const [showAssigned, setShowAssigned] = useState(false)

  useEffect(() => {
    const u = getCurrentUser()
    if (!u || u.role !== 'admin') {
      router.push('/')
      return
    }
    setUser(u)
    load(u)
  }, [])

  async function load(u) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tickets', {
        headers: {
          'x-user-id': u.id,
          'x-user-role': u.role,
        },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAllTickets(data.tickets)
    } catch {
      setError('Could not load tickets. Try refreshing the page.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAssign(ticketId) {
    const technicianId = selections[ticketId]
    if (!technicianId) return
    setWorking(ticketId)
    setError(null)
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-role': user.role,
        },
        body: JSON.stringify({ technicianId }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      // Update in place instead of refetching everything
      setAllTickets((list) =>
        list.map((t) => (t.id === ticketId ? data.ticket : t)),
      )
      setSelections((s) => {
        const next = { ...s }
        delete next[ticketId]
        return next
      })
    } catch {
      setError('Could not assign that ticket. Try again.')
    } finally {
      setWorking(null)
    }
  }

  const workload = useMemo(
    () =>
      technicians.map((tech) => ({
        ...tech,
        openCount: allTickets.filter(
          (t) => t.technicianId === tech.id && !isFinished(t),
        ).length,
      })),
    [allTickets],
  )

  const assignedTickets = useMemo(
    () =>
      allTickets
        .filter((t) => t.technicianId && !isFinished(t))
        .sort(byPriority),
    [allTickets],
  )

  const unassignedSorted = useMemo(
    () => allTickets.filter((t) => !t.technicianId).sort(byPriority),
    [allTickets],
  )

  const stats = [
    { label: 'Unassigned', value: unassignedSorted.length, tone: 'rust' },
    { label: 'Active assigned', value: assignedTickets.length, tone: 'amber' },
    { label: 'Technicians', value: technicians.length },
  ]

  if (!user) return <div className="container">Loadingâ€¦</div>

  return (
    <div className="admin-assignment-page">
      <Navbar user={user} title="Assignment" />
      <div className="container">
        <h1>Assign Tickets</h1>
        <p className="subtitle">Route unassigned requests to a technician.</p>

        <StatStrip stats={stats} />

        {error && <div className="banner banner-error">{error}</div>}

        <div className="panel panel-pad" style={{ marginBottom: 16 }}>
          <div className="section-label">Technician workload</div>
          <div className="kv-list">
            {workload.map((tech) => (
              <div className="kv-row" key={tech.id}>
                <span className="k">{tech.name}</span>
                <span className="v">{tech.openCount} open</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="panel ticket-table cols-assign"
          style={{ marginBottom: 20 }}
        >
          <div className="ticket-head">
            <div>ID</div>
            <div>Ticket</div>
            <div>Location</div>
            <div>Priority</div>
            <div>Status</div>
            <div>Assign to</div>
            <div>Action</div>
          </div>

          {loading && <div className="empty-state">Loading tickets…</div>}

          {!loading && unassignedSorted.length === 0 && (
            <div className="empty-state">
              <strong>Nothing waiting</strong>
              All submitted tickets have a technician assigned.
            </div>
          )}

          {!loading &&
            unassignedSorted.map((t) => (
              <div className={`ticket-row priority-${t.priority.toLowerCase()}`} key={t.id}>
                <div>
                  <span className="code">{ticketCode(t.id)}</span>
                </div>
                <div className="ticket-title-cell">
                  <span className="cell-label">Ticket</span>
                  <Link href={`/tickets/${t.id}`}>{t.title}</Link>
                </div>
                <div className="ticket-meta">
                  <span className="cell-label">Location</span>
                  {t.location}
                </div>
                <div>
                  <span className="cell-label">Priority</span>
                  <Tag tone={PRIORITY_META[t.priority].tone}>{t.priority}</Tag>
                </div>
                <div>
                  <span className="cell-label">Status</span>
                  <Tag tone={STATUS_META[t.status].tone}>{t.status}</Tag>
                </div>
                <div>
                  <select
                    value={selections[t.id] || ''}
                    onChange={(e) =>
                      setSelections((s) => ({ ...s, [t.id]: e.target.value }))
                    }
                  >
                    <option value="">Choose technician</option>
                    {workload.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name} ({tech.openCount} open)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={working === t.id || !selections[t.id]}
                    onClick={() => handleAssign(t.id)}
                  >
                    {working === t.id ? 'Saving…' : 'Assign'}
                  </button>
                </div>
              </div>
            ))}
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => setShowAssigned((v) => !v)}
          style={{ marginBottom: 12 }}
        >
          {showAssigned ? 'Hide' : 'Show'} active assigned tickets (
          {assignedTickets.length})
        </button>

        {showAssigned && (
          <div className="panel ticket-table cols-assign">
            <div className="ticket-head">
              <div>ID</div>
              <div>Ticket</div>
              <div>Location</div>
              <div>Priority</div>
              <div>Status</div>
              <div>Reassign to</div>
              <div>Action</div>
            </div>
            {assignedTickets.map((t) => (
              <div className={`ticket-row priority-${t.priority.toLowerCase()}`} key={t.id}>
                <div>
                  <span className="code">{ticketCode(t.id)}</span>
                </div>
                <div className="ticket-title-cell">
                  <span className="cell-label">Ticket</span>
                  <Link href={`/tickets/${t.id}`}>{t.title}</Link>
                </div>
                <div className="ticket-meta">
                  <span className="cell-label">Location</span>
                  {t.location}
                </div>
                <div>
                  <span className="cell-label">Priority</span>
                  <Tag tone={PRIORITY_META[t.priority].tone}>{t.priority}</Tag>
                </div>
                <div>
                  <span className="cell-label">Status</span>
                  <Tag tone={STATUS_META[t.status].tone}>{t.status}</Tag>
                </div>
                <div>
                  <select
                    value={selections[t.id] || ''}
                    onChange={(e) =>
                      setSelections((s) => ({ ...s, [t.id]: e.target.value }))
                    }
                  >
                    <option value="">Reassign…</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                        {tech.id === t.technicianId ? ' (current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={
                      working === t.id ||
                      !selections[t.id] ||
                      selections[t.id] === t.technicianId
                    }
                    onClick={() => handleAssign(t.id)}
                  >
                    {working === t.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
