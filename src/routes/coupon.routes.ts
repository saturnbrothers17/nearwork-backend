import { Router } from 'express';
import { CouponController } from '../controllers/coupon.controller';

const router = Router();

// Public routes for fetching and validating promotional coupons
router.get('/', CouponController.getPublicCoupons);
router.post('/validate', CouponController.validateCoupon);

export default router;
