import { z } from 'zod'
import { API_BASE_URL, apiCall, saveApiToken, saveApiUserId } from './api'

const otpRequestSchema = z.object({
  mobile_number: z.string().regex(/^\d{10,15}$/),
})
const otpValidationSchema = otpRequestSchema.extend({
  otp: z.string().regex(/^\d{4,6}$/),
})
const otpSentResponseSchema = z.object({
  status: z.boolean(),
  data: z.string(),
  message: z.string().optional(),
})

const otpValidationResponseSchema = z.object({
  status: z.boolean(),
  data: z.unknown(),
  message: z.string().optional(),
})
const authenticatedUserSchema = z.object({
  token: z.string().min(1),
  user_id: z.string().min(1),
  user_name: z.string().min(1),
}).passthrough()

export const authService = {
  async generateOtp(mobileNumber: string): Promise<void> {
    const body = otpRequestSchema.parse({ mobile_number: mobileNumber })
    const response = otpSentResponseSchema.parse(
      await apiCall(`${API_BASE_URL}/generateOTP`, { method: 'POST', body }),
    )
    if (!response.status) throw new Error(response.message ?? response.data ?? 'Could not send OTP.')
  },

  async validateOtp(mobileNumber: string, otp: string): Promise<{ userName: string }> {
    const body = otpValidationSchema.parse({ mobile_number: mobileNumber, otp })
    const response = otpValidationResponseSchema.parse(
      await apiCall(`${API_BASE_URL}/validateOTP`, { method: 'POST', body }),
    )
    if (!response.status) {
      const details = typeof response.data === 'string' ? response.data : undefined
      throw new Error(response.message ?? details ?? 'OTP validation failed.')
    }
    const user = authenticatedUserSchema.parse(response.data)
    saveApiToken(user.token)
    saveApiUserId(user.user_id)
    return { userName: user.user_name }
  },
}
