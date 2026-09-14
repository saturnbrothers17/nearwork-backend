export const APP_CONFIG = {
  appName: 'NearWork',
  defaultCurrency: 'INR',
  currencySymbol: '₹',
  visitCharge: 50, // ₹50 fixed visit charge
  taxRatePercent: 18, // 18% GST
  platformCommissionPercent: 20, // 20% platform commission default
  jobAcceptanceTimeoutSeconds: 60, // 60 seconds (1 minute) for worker to accept
  workerArrivalGeofenceMeters: 150, // 150 meters arrival verification radius
  trackingUpdateIntervalMs: 8000, // 8s GPS broadcast during active en-route
  defaultWorkingRadiusKm: 15, // Default worker operating radius in km
  cancellationRefundWindowMinutes: 30,
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
} as const;

export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WORKER_NOT_FOUND: 'WORKER_NOT_FOUND',
  WORKER_NOT_VERIFIED: 'WORKER_NOT_VERIFIED',
  WORKER_UNAVAILABLE: 'WORKER_UNAVAILABLE',
  JOB_ALREADY_ASSIGNED: 'JOB_ALREADY_ASSIGNED',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  INVALID_BOOKING_TRANSITION: 'INVALID_BOOKING_TRANSITION',
  GEOFENCE_CHECK_FAILED: 'GEOFENCE_CHECK_FAILED',
  INVALID_OTP: 'INVALID_OTP',
  PAYMENT_VERIFICATION_FAILED: 'PAYMENT_VERIFICATION_FAILED',
  COUPON_INVALID: 'COUPON_INVALID',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;
