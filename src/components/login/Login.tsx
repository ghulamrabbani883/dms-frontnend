import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { authService } from '../../services/authService'

type LoginProps = {
  onAuthenticated: () => void
}

const mobileSchema = z.string().regex(/^\d{10,15}$/, 'Enter a valid mobile number.')
const otpSchema = z.string().regex(/^\d{4,6}$/, 'Enter the 4–6 digit OTP.')

const Login = ({ onAuthenticated }: LoginProps) => {
  const [mobile, setMobile] = useState('')
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
        await authService.validateOtp(number.data, otp.trim())
        onAuthenticated()
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Authentication failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal-card login-card" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <h2 id="login-title">{otpSent ? 'Verify your number' : 'Sign in to Elevate'}</h2>
        <p>{otpSent ? `Enter the one-time passcode sent to ${mobile}.` : 'Enter the mobile number registered with your organization.'}</p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>Mobile number</span>
            <input
              autoComplete="tel"
              inputMode="tel"
              placeholder="Enter your mobile number"
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
      </section>
    </div>
  )
}

export default Login
