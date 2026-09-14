import crypto from 'crypto';
import { PayoutStatus } from '@nearwork/types';
import { HTTP_STATUS } from '@nearwork/config';
import { prisma } from '../config/db';
import { AppError } from '../middlewares/error.middleware';

export class EarningService {
  /**
   * Get worker earnings dashboard metrics & ledger history
   */
  static async getWorkerEarnings(workerId: string) {
    const worker = await prisma.workerProfile.findUnique({
      where: { id: workerId }
    });

    if (!worker) {
      const err: AppError = new Error('Worker profile not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    const earnings = await prisma.earning.findMany({
      where: { workerId },
      include: {
        booking: {
          include: {
            service: { select: { name: true } },
            customer: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const payouts = await prisma.payout.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate today's earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEarnings = earnings
      .filter((e: any) => new Date(e.createdAt) >= today)
      .reduce((sum: number, e: any) => sum + e.netWorkerEarning, 0);

    return {
      availableBalance: worker.availableBalance,
      pendingBalance: worker.pendingBalance,
      totalWithdrawn: worker.totalWithdrawn,
      todayEarnings,
      totalJobsCompleted: worker.totalJobsCompleted,
      averageRating: worker.averageRating,
      earnings,
      payouts
    };
  }

  /**
   * Request Payout from available balance
   */
  static async requestPayout(workerId: string, amount: number) {
    const worker = await prisma.workerProfile.findUnique({
      where: { id: workerId }
    });

    if (!worker) {
      const err: AppError = new Error('Worker profile not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    if (amount <= 0 || amount > worker.availableBalance) {
      const err: AppError = new Error(
        `Insufficient available balance. Requested: ₹${amount}, Available: ₹${worker.availableBalance}`
      );
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    if (!worker.bankAccountNumber || !worker.bankIfsc) {
      const err: AppError = new Error('Please configure your Bank Account Number & IFSC before requesting payout');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    const payoutNumber = `PAYOUT-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const payout = await prisma.$transaction(async (tx: any) => {
      const created = await tx.payout.create({
        data: {
          payoutNumber,
          workerId,
          amount,
          status: PayoutStatus.PENDING,
          bankAccount: worker.bankAccountNumber!,
          bankIfsc: worker.bankIfsc!
        }
      });

      await tx.workerProfile.update({
        where: { id: workerId },
        data: {
          availableBalance: { decrement: amount },
          pendingBalance: { increment: amount }
        }
      });

      return created;
    });

    return payout;
  }
}
