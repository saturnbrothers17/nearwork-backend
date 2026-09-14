import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';

const router = Router();

// Protect all admin routes with JWT and strict ADMIN role check
router.use(authenticateJwt, requireAdmin);

router.get('/analytics', AdminController.getAnalytics);
router.get('/live-map', AdminController.getLiveMapData);
router.get('/workers', AdminController.getWorkers);
router.patch('/workers/:id/verify', AdminController.updateWorkerVerification);
router.get('/bookings', AdminController.getAllBookings);
router.post('/bookings/:id/reassign', AdminController.reassignBooking);
router.post('/services', AdminController.createService);
router.get('/coupons', AdminController.getCoupons);
router.post('/coupons', AdminController.createCoupon);
router.patch('/coupons/:id', AdminController.updateCoupon);
router.delete('/coupons/:id', AdminController.deleteCoupon);
router.get('/payouts', AdminController.getPayouts);
router.patch('/payouts/:id/process', AdminController.processPayout);

export default router;
