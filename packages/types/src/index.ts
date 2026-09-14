// User Roles
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  WORKER = 'WORKER',
  ADMIN = 'ADMIN'
}

// Worker Operational Statuses
export enum WorkerStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  BUSY = 'BUSY',
  ON_JOB = 'ON_JOB'
}

// Worker Verification / KYC Status
export enum WorkerVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED'
}

// Booking State Machine Statuses
export enum BookingStatus {
  CREATED = 'CREATED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  SEARCHING_WORKER = 'SEARCHING_WORKER',
  WORKER_ASSIGNED = 'WORKER_ASSIGNED',
  WORKER_ACCEPTED = 'WORKER_ACCEPTED',
  WORKER_EN_ROUTE = 'WORKER_EN_ROUTE',
  WORKER_ARRIVED = 'WORKER_ARRIVED',
  SERVICE_STARTED = 'SERVICE_STARTED',
  SERVICE_COMPLETED = 'SERVICE_COMPLETED',
  PAYMENT_SETTLED = 'PAYMENT_SETTLED',
  COMPLETED = 'COMPLETED',
  CUSTOMER_CANCELLED = 'CUSTOMER_CANCELLED',
  WORKER_CANCELLED = 'WORKER_CANCELLED',
  ADMIN_CANCELLED = 'ADMIN_CANCELLED'
}

// Payment States
export enum PaymentStatus {
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED'
}

// Payout States
export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// Support Ticket Status
export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

// Geo Location Interface
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp?: number;
}

// Socket Events Constants
export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTHENTICATE: 'authenticate',
  
  // Location & Tracking
  WORKER_LOCATION_UPDATE: 'worker:location:update',
  TRACKING_UPDATE: 'tracking:update',
  
  // Booking Lifecycle
  BOOKING_CREATED: 'booking:created',
  BOOKING_ASSIGNED: 'booking:assigned',
  BOOKING_ACCEPTED: 'booking:accepted',
  BOOKING_REJECTED: 'booking:rejected',
  BOOKING_CANCELLED: 'booking:cancelled',
  WORKER_EN_ROUTE: 'worker:en_route',
  WORKER_ARRIVED: 'worker:arrived',
  SERVICE_STARTED: 'service:started',
  SERVICE_COMPLETED: 'service:completed',
  EXTRA_CHARGE_REQUESTED: 'booking:extra_charge:requested',
  EXTRA_CHARGE_RESPONDED: 'booking:extra_charge:responded',
  
  // Chat
  CHAT_JOIN: 'chat:join',
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ: 'chat:read',
  
  // Notification & Admin
  NOTIFICATION_NEW: 'notification:new',
  ADMIN_LIVE_UPDATE: 'admin:live_update'
} as const;

// API Standard Response
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  errors?: Record<string, string[]>;
}

// JWT Payload
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  workerId?: string;
  adminId?: string;
  name?: string;
  iat?: number;
  exp?: number;
}
