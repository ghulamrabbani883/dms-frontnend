import { useState, type FormEvent } from 'react'
import { z } from 'zod'

const userSchema = z.object({
  username: z.string().trim().min(1, 'Enter a username.'),
  password: z.string().min(8, 'Password must contain at least 8 characters.'),
})

const UserRegistration = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = userSchema.safeParse({ username, password })
    if (!result.success) {
      setMessage(result.error.issues[0]?.message ?? 'Check the user details and try again.')
      return
    }

    setMessage(`User “${result.data.username}” created in demo mode.`)
    setUsername('')
    setPassword('')
  }

  return (
    <section className="admin-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">REGISTER</span>
          <h2>Register a user</h2>
          <p>Set up a username and password for a new member.</p>
        </div>
        <span className="admin-avatar">♙</span>
      </div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="e.g. jordan.smith"
            autoComplete="username"
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </label>
        {message && (
          <p className={message.startsWith('User') ? 'success-message' : 'form-error'} role="status">
            {message}
          </p>
        )}
        <button className="button button-primary" type="submit">
          Create user <span aria-hidden="true">→</span>
        </button>
      </form>
      <p className="demo-note">This static admin form is for demonstration only. No credentials are sent or stored.</p>
    </section>
  )
}

export default UserRegistration
