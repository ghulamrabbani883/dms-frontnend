import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { authService } from '../../services/authService'
import { clearApiToken } from '../../services/api'

type LoginProps = {
  onClose: () => void
  onAuthenticated: (name: string) => void
  onSignOut: () => void
  authenticated: boolean
}

const mobileSchema = z.string().regex(/^\d{10,15}$/, 'Enter a valid mobile number.')
const otpSchema = z.string().regex(/^\d{4,6}$/, 'Enter the 4–6 digit OTP.')

const Login = ({ onClose, onAuthenticated, onSignOut, authenticated }: LoginProps) => {
  const [mobile, setMobile] = useState('8349256007')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const normalizedNumber = mobile.trim().replace(/[\s()+-]/g, '')
    const number = mobileSchema.safeParse(normalizedNumber)
    if (!number.success) {
      setError(number.error.issues[0]?.message ?? 'Enter a valid mobile number.')
      return
    }
    if (otpSent) {
      const validatedOtp = otpSchema.safeParse(otp.trim())
      if (!validatedOtp.success) {
        setError(validatedOtp.error.issues[0]?.message ?? 'Enter the 4–6 digit OTP.')
        return
      }
    }

    setIsSubmitting(true)
    try {
      if (!otpSent) {
        await authService.generateOtp(number.data)
        setOtpSent(true)
      } else {
        const { userName } = await authService.validateOtp(number.data, otp.trim())
        onAuthenticated(userName === 'Workspace member' ? number.data : userName)
        onClose()
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Authentication failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = () => {
    try {
      clearApiToken()
      onSignOut()
      onClose()
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not clear the saved session.')
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card login-card" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close login">×</button>
        <span className="eyebrow">{authenticated ? 'CONNECTED WORKSPACE' : 'WELCOME BACK'}</span>
        <h2 id="login-title">{authenticated ? 'Signed in' : otpSent ? 'Verify your number' : 'Sign in to Elevate'}</h2>
        {authenticated ? (
          <>
            <p>Your API token is active. Document search and uploads are connected to the Allsoft service.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-outline button-full" type="button" onClick={handleSignOut}>Sign out</button>
          </>
        ) : (
          <>
            <p>{otpSent ? `Enter the one-time passcode sent to ${mobile}.` : 'Your documents, all in one secure place.'}</p>
            <form onSubmit={(event) => void handleSubmit(event)}>
              <label className="field">
                <span>Mobile number</span>
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="8349256007"
                  value={mobile}
                  disabled={otpSent || isSubmitting}
                  onChange={(event) => setMobile(event.target.value)}
                />
              </label>
              {otpSent && (
                <label className="field">
                  <span>One-time passcode</span>
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter the code"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                  />
                </label>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button-primary button-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait…' : otpSent ? 'Verify & sign in' : 'Send one-time passcode'} <span aria-hidden="true">→</span>
              </button>
            </form>
            <p className="demo-note">OTP is sent by the Allsoft authentication service. Your token is stored locally for authenticated API requests.</p>
          </>
        )}
      </section>
    </div>
  )
}

export default Login
