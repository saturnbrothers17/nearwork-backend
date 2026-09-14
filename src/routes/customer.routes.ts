import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { requireCustomer } from '../middlewares/role.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { createAddressSchema, createReviewSchema } from '@nearwork/validation';

const router = Router();

// Protect all customer routes with JWT and strict CUSTOMER role check
router.use(authenticateJwt, requireCustomer);

router.get('/profile', CustomerController.getProfile);
router.get('/active-workers', CustomerController.getActiveWorkers);
router.get('/addresses', CustomerController.getAddresses);
router.post('/addresses', validateRequest(createAddressSchema), CustomerController.addAddress);
router.post('/live-location', CustomerController.updateLiveLocation);
router.get('/bookings', CustomerController.getBookings);
router.post('/reviews', validateRequest(createReviewSchema), CustomerController.createReview);

export default router;
