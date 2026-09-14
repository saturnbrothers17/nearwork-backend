import { Router } from 'express';
import authRoutes from './auth.routes';
import customerRoutes from './customer.routes';
import workerRoutes from './worker.routes';
import serviceRoutes from './service.routes';
import bookingRoutes from './booking.routes';
import paymentRoutes from './payment.routes';
import chatRoutes from './chat.routes';
import adminRoutes from './admin.routes';
import ticketRoutes from './ticket.routes';
import couponRoutes from './coupon.routes';
import { driveRoutes, storageRoutes } from './drive';

const router = Router();

router.use('/auth', authRoutes);
router.use('/customer', customerRoutes);
router.use('/worker', workerRoutes);
router.use('/services', serviceRoutes);
router.use('/coupons', couponRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/chat', chatRoutes);
router.use('/admin', adminRoutes);
router.use('/tickets', ticketRoutes);
router.use('/drive', driveRoutes);
router.use('/storage', storageRoutes);

export default router;
