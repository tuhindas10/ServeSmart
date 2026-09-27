import {
  tickets,
  generateId,
  findUser,
  CATEGORIES,
  PRIORITIES,
} from '../../../lib/store'

function logRejected(req, reason, details = {}) {
  console.warn(`[REJECTED] ${req.method} /api/tickets - ${reason}`, details)
}

export default function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  res.setHeader('Allow', ['GET', 'POST'])
  logRejected(req, 'method not allowed')
  return res.status(405).json({ error: 'Method not allowed' })
}

function handleGet(req, res) {
  const { studentId, technicianId, unassigned } = req.query
  let result = tickets

  if (studentId) result = result.filter((t) => t.studentId === studentId)
  if (technicianId)
    result = result.filter((t) => t.technicianId === technicianId)
  if (unassigned === 'true') result = result.filter((t) => !t.technicianId)

  return res.status(200).json({ tickets: result })
}

function handlePost(req, res) {
  const { title, description, category, location, priority, studentId } =
    req.body || {}

  const isBlank = (value) =>
    typeof value !== 'string' || value.trim().length === 0

  const missingFields = [
    ['title', title],
    ['description', description],
    ['category', category],
    ['location', location],
    ['priority', priority],
  ]
    .filter(([, value]) => isBlank(value))
    .map(([field]) => field)

  if (missingFields.length) {
    logRejected(req, `missing or empty fields: ${missingFields.join(', ')}`, {
      title,
      description,
      category,
      location,
      priority,
    })
    return res
      .status(400)
      .json({ error: 'Title, description, category, location, and priority are required.' })
  }
  if (description.trim().length < 20) {
    logRejected(req, 'description is too short', {
      description,
      length: description.trim().length,
    })
    return res.status(400).json({ error: 'Description must be at least 20 characters.' })
  }
  if (!CATEGORIES.includes(category)) {
    logRejected(req, 'unknown category', { category })
    return res.status(400).json({ error: 'Unknown category.' })
  }
  if (!PRIORITIES.includes(priority)) {
    logRejected(req, 'unknown priority', { priority })
    return res.status(400).json({ error: 'Unknown priority.' })
  }
  const now = new Date().toISOString()
  const student = findUser(studentId)

  const ticket = {
    id: generateId(),
    title: title.trim(),
    description: description.trim(),
    category,
    location: location.trim(),
    priority,
    status: 'Open',
    studentId: studentId || null,
    technicianId: null,
    createdAt: now,
    updatedAt: now,
    activity: [
      {
        id: 'a1',
        type: 'created',
        message: `Submitted by ${student ? student.name : 'student'}`,
        at: now,
      },
    ],
  }

  tickets.push(ticket)
  return res.status(201).json({ ticket })
}
