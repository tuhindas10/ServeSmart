import { tickets, findUser, STATUSES } from '../../../lib/store'

// A ticket moves forward one step at a time.
const NEXT_STATUS = {
  Open: 'Assigned',
  Assigned: 'In Progress',
  'In Progress': 'Resolved',
  Resolved: 'Closed',
}

function logRejected(req, id, reason, details = {}) {
  console.warn(`[REJECTED] ${req.method} /api/tickets/${id} - ${reason}`, details)
}

export default function handler(req, res) {
  const { id } = req.query
  const ticket = tickets.find((t) => t.id === id)
  if (!ticket) {
    logRejected(req, id, 'ticket not found')
    return res.status(404).json({ error: 'Ticket not found.' })
  }

  if (req.method === 'GET') return res.status(200).json({ ticket })

  if (req.method === 'PATCH') return handlePatch(req, res, ticket)

  res.setHeader('Allow', ['GET', 'PATCH'])
  logRejected(req, id, 'method not allowed')
  return res.status(405).json({ error: 'Method not allowed' })
}

function handlePatch(req, res, ticket) {
  const { technicianId, status } = req.body || {}
  const callerId = req.headers['x-user-id']
  const callerRole = req.headers['x-user-role']
  const attemptedChange = { callerId, callerRole, status, technicianId }

  if (typeof callerId !== 'string' || typeof callerRole !== 'string') {
    logRejected(req, ticket.id, 'missing caller identity', attemptedChange)
    return res.status(401).json({ error: 'You must identify yourself to update a ticket.' })
  }

  const caller = findUser(callerId)

  if (!caller || caller.role !== callerRole) {
    logRejected(req, ticket.id, 'unidentified caller', attemptedChange)
    return res.status(403).json({ error: 'You must be an identified user to update a ticket.' })
  }
  if (caller.role === 'student') {
    logRejected(req, ticket.id, 'student cannot update tickets', attemptedChange)
    return res.status(403).json({ error: 'Students cannot update tickets.' })
  }
  if (caller.role === 'technician') {
    if (ticket.technicianId !== caller.id) {
      logRejected(req, ticket.id, 'caller is not the assigned technician', attemptedChange)
      return res.status(403).json({ error: 'Only the assigned technician can update this ticket.' })
    }
    if (technicianId !== undefined) {
      logRejected(req, ticket.id, 'technician attempted assignment', attemptedChange)
      return res.status(403).json({ error: 'Only administrators can assign technicians.' })
    }
  }
  if (caller.role === 'admin' && status !== undefined) {
    logRejected(req, ticket.id, 'admin attempted status update', attemptedChange)
    return res.status(403).json({ error: 'Administrators cannot change ticket status directly.' })
  }

  const now = new Date().toISOString()

  // Validate everything first so a bad request never half-applies.
  const tech = technicianId ? findUser(technicianId) : null
  if (technicianId && (!tech || tech.role !== 'technician')) {
    logRejected(req, ticket.id, 'invalid technician', attemptedChange)
    return res.status(400).json({ error: 'Choose a valid technician.' })
  }
  const assigning = Boolean(tech) && tech.id !== ticket.technicianId
  // Assigning an Open ticket moves it to Assigned automatically.
  const current =
    assigning && ticket.status === 'Open' ? 'Assigned' : ticket.status

  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      logRejected(req, ticket.id, `invalid transition ${current} -> ${status}`, attemptedChange)
      return res.status(400).json({ error: 'Unknown status.' })
    }
    if (status === current) {
      logRejected(req, ticket.id, `invalid transition ${current} -> ${status}`, attemptedChange)
      return res.status(400).json({ error: `Ticket is already ${current}.` })
    }
    if (!tech && !ticket.technicianId) {
      logRejected(req, ticket.id, `invalid transition ${current} -> ${status}`, attemptedChange)
      return res
        .status(400)
        .json({ error: 'Assign a technician before changing status.' })
    }
    if (NEXT_STATUS[current] !== status) {
      logRejected(req, ticket.id, `invalid transition ${current} -> ${status}`, attemptedChange)
      return res
        .status(400)
        .json({ error: `A ticket cannot move from ${current} to ${status}.` })
    }
  }

  let changed = false

  if (assigning) {
    const wasAssigned = Boolean(ticket.technicianId)
    ticket.technicianId = tech.id
    if (ticket.status === 'Open') ticket.status = 'Assigned'
    ticket.activity.push({
      id: `a${ticket.activity.length + 1}`,
      type: 'assigned',
      message: `${wasAssigned ? 'Reassigned' : 'Assigned'} to ${tech.name}`,
      at: now,
    })
    changed = true
  }

  if (status !== undefined && status !== ticket.status) {
    ticket.status = status
    ticket.activity.push({
      id: `a${ticket.activity.length + 1}`,
      type: 'status',
      message: `Status changed to ${status}`,
      at: now,
    })
    changed = true
  }

  if (changed) ticket.updatedAt = now
  return res.status(200).json({ ticket })
}
