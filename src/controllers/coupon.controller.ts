import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { HTTP_STATUS } from '@nearwork/config';

export class CouponController {
  /**
   * GET /api/v1/coupons
   * Get all active and available promotional coupons for customers
   */
  static async getPublicCoupons(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date();
      const coupons = await prisma.coupon.findMany({
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      // Filter out coupons that exceeded usage limit
      const availableCoupons = coupons.filter(c => c.usedCount < c.usageLimit);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: availableCoupons
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to fetch active coupons'
      });
    }
  }

  /**
   * POST /api/v1/coupons/validate
   * Validate a coupon against a specific order/booking amount
   */
  static async validateCoupon(req: Request, res: Response): Promise<void> {
    try {
      const { code, amount = 0 } = req.body;

      if (!code) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Coupon code is required'
        });
        return;
      }

      const now = new Date();
      const coupon = await prisma.coupon.findUnique({
        where: { code: String(code).trim().toUpperCase() }
      });

      if (!coupon || !coupon.isActive) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          valid: false,
          message: 'Invalid or inactive coupon code'
        });
        return;
      }

      if (coupon.expiresAt && coupon.expiresAt <= now) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          valid: false,
          message: 'This coupon has expired'
        });
        return;
      }

      if (coupon.usedCount >= coupon.usageLimit) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          valid: false,
          message: 'Coupon usage limit has been reached'
        });
        return;
      }

      if (amount < coupon.minOrderValue) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          valid: false,
          message: `Minimum order value of ₹${coupon.minOrderValue} required for this coupon`
        });
        return;
      }

      let discountAmount = 0;
      if (coupon.discountType === 'PERCENTAGE') {
        discountAmount = (amount * coupon.discountValue) / 100;
        if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
          discountAmount = coupon.maxDiscount;
        }
      } else {
        discountAmount = coupon.discountValue;
      }

      discountAmount = Math.min(amount, Math.round(discountAmount));

      res.status(HTTP_STATUS.OK).json({
        success: true,
        valid: true,
        data: {
          code: coupon.code,
          discount: discountAmount,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minOrderValue: coupon.minOrderValue,
          maxDiscount: coupon.maxDiscount
        }
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to validate coupon'
      });
    }
  }
}
