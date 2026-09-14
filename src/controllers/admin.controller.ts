import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '@nearwork/config';
import { prisma } from '../config/db';
import { WorkerStatus, WorkerVerificationStatus, BookingStatus, PayoutStatus } from '@nearwork/types';
import { MatchingService } from '../services/matching.service';

export class AdminController {
  /**
   * Analytics summary
   */
  static async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const [
        totalUsers,
        totalWorkers,
        activeWorkers,
        pendingVerifications,
        totalBookings,
        completedBookings,
        earningsAggregate
      ] = await Promise.all([
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.workerProfile.count(),
        prisma.workerProfile.count({ where: { status: WorkerStatus.ONLINE } }),
        prisma.workerProfile.count({ where: { verificationStatus: WorkerVerificationStatus.PENDING } }),
        prisma.booking.count(),
        prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
        prisma.earning.aggregate({
          _sum: { grossAmount: true, platformCommission: true, netWorkerEarning: true }
        })
      ]);

      const totalRevenue = earningsAggregate._sum.grossAmount || 0;
      const platformCommission = earningsAggregate._sum.platformCommission || 0;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          totalUsers,
          totalWorkers,
          activeWorkers,
          pendingVerifications,
          totalBookings,
          completedBookings,
          totalRevenue,
          platformCommission
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Live Map Data (Active online workers and active bookings)
   */
  static async getLiveMapData(req: Request, res: Response, next: NextFunction) {
    try {
      const activeWorkers = await prisma.workerProfile.findMany({
        where: {
          status: { in: [WorkerStatus.ONLINE, WorkerStatus.ON_JOB, WorkerStatus.BUSY] }
        },
        include: {
          user: { select: { name: true, phone: true } },
          skills: { include: { category: true } }
        }
      });

      const activeBookings = await prisma.booking.findMany({
        where: {
          status: {
            in: [
              BookingStatus.SEARCHING_WORKER,
              BookingStatus.WORKER_ASSIGNED,
              BookingStatus.WORKER_ACCEPTED,
              BookingStatus.WORKER_EN_ROUTE,
              BookingStatus.WORKER_ARRIVED,
              BookingStatus.SERVICE_STARTED
            ]
          }
        },
        include: {
          service: true,
          address: true,
          customer: { select: { name: true, phone: true } },
          worker: { include: { user: { select: { name: true, phone: true } } } }
        }
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          workers: activeWorkers,
          bookings: activeBookings
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all workers with KYC details
   */
  static async getWorkers(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, verificationStatus } = req.query;
      const where: any = {};

      if (status) where.status = status;
      if (verificationStatus) where.verificationStatus = verificationStatus;

      const workers = await prisma.workerProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
          skills: { include: { category: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(HTTP_STATUS.OK).json({ success: true, data: workers });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify, Reject, or Suspend Worker KYC
   */
  static async updateWorkerVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { verificationStatus } = req.body;

      const updated = await prisma.workerProfile.update({
        where: { id },
        data: { verificationStatus },
        include: { user: true }
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          adminId: req.user!.adminId || req.user!.id,
          action: `WORKER_KYC_${verificationStatus}`,
          entity: 'WorkerProfile',
          entityId: id,
          details: JSON.stringify({ workerName: updated.user.name, verificationStatus })
        }
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Worker verification status updated to ${verificationStatus}`,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all platform bookings
   */
  static async getAllBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.query;
      const where: any = {};
      if (status) where.status = status;

      const bookings = await prisma.booking.findMany({
        where,
        include: {
          service: { include: { category: true } },
          customer: { select: { name: true, phone: true, email: true } },
          worker: { include: { user: { select: { name: true, phone: true } } } },
          address: true,
          payment: true
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(HTTP_STATUS.OK).json({ success: true, data: bookings });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin reassigns booking to another worker
   */
  static async reassignBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { workerId } = req.body;

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          workerId,
          status: BookingStatus.WORKER_ASSIGNED
        }
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Booking reassigned to worker',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create or update Service
   */
  static async createService(req: Request, res: Response, next: NextFunction) {
    try {
      const { categoryId, name, slug, description, basePrice, durationMinutes, inclusions, icon } =
        req.body;

      const service = await prisma.service.create({
        data: {
          categoryId,
          name,
          slug,
          description,
          basePrice: parseFloat(basePrice),
          durationMinutes: parseInt(durationMinutes || '60', 10),
          inclusions: JSON.stringify(inclusions || ['Service execution', 'Quality assurance']),
          icon
        }
      });

      res.status(HTTP_STATUS.CREATED).json({ success: true, data: service });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all coupons
   */
  static async getCoupons(req: Request, res: Response, next: NextFunction) {
    try {
      const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
      res.status(HTTP_STATUS.OK).json({ success: true, data: coupons });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create Coupon
   */
  static async createCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const coupon = await prisma.coupon.create({
        data: {
          code: req.body.code.toUpperCase(),
          discountType: req.body.discountType || 'PERCENTAGE',
          discountValue: parseFloat(req.body.discountValue),
          minOrderValue: parseFloat(req.body.minOrderValue || '0'),
          maxDiscount: req.body.maxDiscount ? parseFloat(req.body.maxDiscount) : null,
          usageLimit: parseInt(req.body.usageLimit || '100', 10),
          expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null
        }
      });
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: coupon });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Coupon (Usage Limit, Active Status, Max Cap)
   */
  static async updateCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { usageLimit, isActive, minOrderValue, maxDiscount } = req.body;

      const data: any = {};
      if (usageLimit !== undefined) data.usageLimit = parseInt(usageLimit, 10);
      if (isActive !== undefined) data.isActive = Boolean(isActive);
      if (minOrderValue !== undefined) data.minOrderValue = parseFloat(minOrderValue);
      if (maxDiscount !== undefined) data.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
      if (req.body.expiresAt !== undefined) data.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;

      const updated = await prisma.coupon.update({
        where: { id },
        data
      });

      res.status(HTTP_STATUS.OK).json({ success: true, message: 'Coupon updated successfully', data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete Coupon
   */
  static async deleteCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.coupon.delete({
        where: { id }
      });
      res.status(HTTP_STATUS.OK).json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payout requests & process payout
   */
  static async getPayouts(req: Request, res: Response, next: NextFunction) {
    try {
      const payouts = await prisma.payout.findMany({
        include: {
          worker: { include: { user: { select: { name: true, phone: true } } } }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: payouts });
    } catch (error) {
      next(error);
    }
  }

  static async processPayout(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, referenceId } = req.body;

      const payout = await prisma.$transaction(async (tx: any) => {
        const existing = await tx.payout.findUnique({ where: { id } });
        if (!existing) throw new Error('Payout not found');

        const updated = await tx.payout.update({
          where: { id },
          data: {
            status,
            referenceId,
            processedAt: new Date()
          }
        });

        if (status === PayoutStatus.COMPLETED) {
          await tx.workerProfile.update({
            where: { id: existing.workerId },
            data: {
              pendingBalance: { decrement: existing.amount },
              totalWithdrawn: { increment: existing.amount }
            }
          });
        }

        return updated;
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Payout updated successfully',
        data: payout
      });
    } catch (error) {
      next(error);
    }
  }
}
