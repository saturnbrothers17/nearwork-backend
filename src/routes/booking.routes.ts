import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { requireCustomer, requireWorker } from '../middlewares/role.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  createBookingSchema,
  verifyOtpSchema,
  requestExtraChargeSchema,
  respondExtraChargeSchema
} from '@nearwork/validation';

const router = Router();

router.use(authenticateJwt);

// Customer booking creation
router.post('/', requireCustomer, validateRequest(createBookingSchema), BookingController.createBooking);
// Customer & Worker tracking and route endpoints
router.get('/:id/tracking', BookingController.getBookingTracking);
router.get('/:id/route', BookingController.getBookingRoute);
router.get('/:id', BookingController.getBookingById);
router.post('/:id/cancel', BookingController.cancelBooking);

// Worker booking operations
router.post('/:id/accept', requireWorker, BookingController.acceptJob);
router.post('/:id/reject', requireWorker, BookingController.rejectJob);
router.post('/:id/en-route', requireWorker, BookingController.startEnRoute);
router.post('/:id/arrived', requireWorker, BookingController.markArrived);
router.post('/:id/start', requireWorker, BookingController.startService);
router.post('/:id/complete', requireWorker, BookingController.completeService);
router.post('/:id/extra-charge', requireWorker, validateRequest(requestExtraChargeSchema), BookingController.requestExtraCharge);

// Customer respond to extra charges
router.post('/:id/extra-charge/respond', requireCustomer, validateRequest(respondExtraChargeSchema), BookingController.respondExtraCharge);

export default router;
