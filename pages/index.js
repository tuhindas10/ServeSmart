import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { allUsers, getCurrentUser, setCurrentUser, logout } from '../lib/auth'

export default function Home() {
  const router = useRouter()
  const [current, setCurrent] = useState(null)

  useEffect(() => {
    setCurrent(getCurrentUser())
  }, [])

  function login(user) {
    setCurrentUser(user)
    setCurrent(user)

    if (user.role === 'student') router.push('/tickets')
    else if (user.role === 'technician') router.push('/technician/dashboard')
    else if (user.role === 'admin') router.push('/admin/assign')
  }

  function handleLogout() {
    logout()
    setCurrent(null)
  }

  const users = allUsers()
  const students = users.filter((u) => u.role === 'student')
  const technicians = users.filter((u) => u.role === 'technician')
  const admins = users.filter((u) => u.role === 'admin')

  const roles = [
    {
      key: 'students',
      title: 'Students',
      icon: 'S',
      description: 'Submit and track campus service requests.',
      users: students,
    },
    {
      key: 'technicians',
      title: 'Technicians',
      icon: 'T',
      description: 'Manage assigned requests and resolve issues.',
      users: technicians,
    },
    {
      key: 'admin',
      title: 'Administration',
      icon: 'A',
      description: 'Assign and coordinate campus service requests.',
      users: admins,
    },
  ]

  return (
    <div className="home-page">
      <header className="home-topbar">
        <div className="home-brand">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-name">ServeSmart</div>
            <div className="brand-subtitle">Campus Service Portal</div>
          </div>
        </div>

        {current && (
          <div className="home-user">
            <div className="home-user-info">
              <strong>{current.name}</strong>
              <span>{current.role}</span>
            </div>

            <button
              className="btn btn-ghost home-logout"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        )}
      </header>

      <main className="home-container">
        <section className="home-hero">
          <div className="hero-eyebrow">Campus service dispatch</div>

          <h1>Service, simplified.</h1>

          <p>
            Raise a request, route it to the right technician, and track it
            through to resolution.
          </p>
        </section>

        {current && (
          <div className="home-session">
            <div className="session-indicator" />

            <div>
              <span className="session-label">Currently signed in</span>
              <strong>{current.name}</strong>
              <span className="session-role">{current.role}</span>
            </div>
          </div>
        )}

        <section className="role-section">
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">Demo access</span>
              <h2>Choose an account</h2>
            </div>

            <span className="account-count">
              {users.length} demo accounts
            </span>
          </div>

          <div className="role-grid">
            {roles.map((role) => (
              <div className="role-card" key={role.key}>
                <div className="role-card-header">
                  <div className="role-icon">{role.icon}</div>

                  <div>
                    <h3>{role.title}</h3>
                    <p>{role.description}</p>
                  </div>
                </div>

                <div className="role-divider" />

                <div className="role-card-meta">
                  <span>
                    {role.users.length}{' '}
                    {role.users.length === 1 ? 'account' : 'accounts'}
                  </span>
                  <span>Demo access</span>
                </div>

                <div className="role-list">
                  {role.users.map((user) => (
                    <button
                      key={user.id}
                      className="account-button"
                      onClick={() => login(user)}
                    >
                      <span>{user.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="home-footer">
          <span>ServeSmart</span>
          <span>Campus service dispatch</span>
        </footer>
      </main>
    </div>
  )
}
