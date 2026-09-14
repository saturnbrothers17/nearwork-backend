import { z } from 'zod';
import { UserRole, WorkerStatus } from '@nearwork/types';

// Auth Schemas
export const registerCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const registerWorkerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  categoryIds: z.array(z.string()).min(1, 'Select at least one service category'),
  experienceYears: z.number().min(0).default(1),
  workingRadiusKm: z.number().min(1).max(50).default(15),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(5, 'Address is required'),
  idProofType: z.string().optional(),
  idProofUrl: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfsc: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  role: z.nativeEnum(UserRole).optional()
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

// Address Schemas
export const createAddressSchema = z.object({
  label: z.string().min(1, 'Label is required (e.g., Home, Office)'),
  addressLine: z.string().min(5, 'Address details required'),
  landmark: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().min(4, 'Valid pincode required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDefault: z.boolean().optional().default(false)
});

// Booking Creation Schema
export const createBookingSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  addressId: z.string().min(1, 'Address ID is required'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  scheduledTimeSlot: z.string().min(1, 'Time slot is required (e.g., 10:00 AM)'),
  instructions: z.string().optional(),
  problemPhotos: z.array(z.string()).optional(),
  couponCode: z.string().optional()
});

// Worker Status Schema
export const updateWorkerStatusSchema = z.object({
  status: z.nativeEnum(WorkerStatus)
});

// Location Update Schema
export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().optional(),
  speed: z.number().optional(),
  accuracy: z.number().optional()
});

// OTP Verification Schema
export const verifyOtpSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  otp: z.string().length(4, 'OTP must be 4 digits')
});

// Additional Charge Schema
export const requestExtraChargeSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  reason: z.string().min(5, 'Reason must be at least 5 characters')
});

export const respondExtraChargeSchema = z.object({
  approved: z.boolean()
});

// Review Schema
export const createReviewSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  rating: z.number().int().min(1).max(5),
  review: z.string().optional()
});

// Support Ticket Schema
export const createTicketSchema = z.object({
  bookingId: z.string().optional(),
  category: z.enum(['PAYMENT', 'WORKER', 'SERVICE', 'CANCELLATION', 'REFUND', 'OTHER']),
  subject: z.string().min(5, 'Subject is required'),
  description: z.string().min(10, 'Description must be at least 10 characters')
});
