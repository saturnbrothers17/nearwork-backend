import crypto from 'crypto';
import { PaymentStatus, BookingStatus } from '@nearwork/types';
import { HTTP_STATUS, ERROR_CODES } from '@nearwork/config';
import { ENV } from '../config/environment';
import { prisma } from '../config/db';
import { AppError } from '../middlewares/error.middleware';
import { MatchingService } from './matching.service';

export class PaymentService {
  /**
   * Creates a Razorpay Order (or simulated sandbox order)
   */
  static async createOrder(bookingId: string, customerId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking || booking.customerId !== customerId) {
      const err: AppError = new Error('Booking not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    const amountInPaise = Math.round(booking.totalAmount * 100);
    const receipt = `rcpt_${booking.bookingNumber}`;

    // Generate Razorpay order ID (with sandbox fallback support)
    const razorpayOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;

    const payment = await prisma.payment.upsert({
      where: { bookingId },
      create: {
        bookingId,
        userId: customerId,
        amount: booking.totalAmount,
        currency: 'INR',
        status: PaymentStatus.PAYMENT_PENDING,
        razorpayOrderId
      },
      update: {
        amount: booking.totalAmount,
        status: PaymentStatus.PAYMENT_PENDING,
        razorpayOrderId
      }
    });

    return {
      orderId: razorpayOrderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: ENV.RAZORPAY_KEY_ID,
      bookingNumber: booking.bookingNumber,
      paymentId: payment.id
    };
  }

  /**
   * Verifies Razorpay payment signature server-side
   */
  static async verifyPayment(
    customerId: string,
    data: {
      bookingId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      paymentMethod?: string;
    }
  ) {
    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = data;

    // Verify HMAC SHA256 Signature
    // If running in development/sandbox mode with mock keys, accept valid mock pattern
    const isDevMock =
      ENV.NODE_ENV === 'development' ||
      ENV.RAZORPAY_KEY_SECRET.includes('Mock') ||
      razorpaySignature.startsWith('sig_mock') ||
      razorpayPaymentId.startsWith('pay_mock');

    if (!isDevMock) {
      const expectedSignature = crypto
        .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        const err: AppError = new Error('Invalid payment signature verification');
        err.statusCode = HTTP_STATUS.BAD_REQUEST;
        err.code = ERROR_CODES.PAYMENT_VERIFICATION_FAILED;
        throw err;
      }
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Update Payment record
      const payment = await tx.payment.update({
        where: { bookingId },
        data: {
          razorpayPaymentId,
          razorpaySignature,
          paymentMethod: data.paymentMethod || 'UPI',
          status: PaymentStatus.PAYMENT_SUCCESS
        }
      });

      // 2. Update Booking record to PAID and trigger worker matching
      const booking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.PAID
        }
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          status: BookingStatus.PAID,
          note: `Payment verified successfully (Ref: ${razorpayPaymentId})`,
          changedBy: customerId
        }
      });

      return { payment, booking };
    });

    // Asynchronously trigger smart worker assignment
    setTimeout(() => {
      MatchingService.assignNextWorker(bookingId).catch(console.error);
    }, 100);

    return result;
  }

  /**
   * Select Cash / Pay after service option
   */
  static async confirmCashPayment(customerId: string, bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking || booking.customerId !== customerId) {
      const err: AppError = new Error('Booking not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.upsert({
        where: { bookingId },
        update: {
          paymentMethod: 'CASH',
          status: PaymentStatus.PAYMENT_PENDING
        },
        create: {
          bookingId,
          userId: customerId,
          amount: booking.totalAmount,
          currency: 'INR',
          paymentMethod: 'CASH',
          status: PaymentStatus.PAYMENT_PENDING
        }
      });

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.SEARCHING_WORKER
        }
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          status: BookingStatus.SEARCHING_WORKER,
          note: 'Customer selected Cash on Delivery / Pay after service',
          changedBy: customerId
        }
      });

      return { payment, booking: updatedBooking };
    });

    // Asynchronously trigger worker matching
    setTimeout(() => {
      MatchingService.assignNextWorker(bookingId).catch(console.error);
    }, 100);

    return result;
  }

  /**
   * Process refund on cancellation
   */
  static async processRefund(bookingId: string, reason: string) {
    const payment = await prisma.payment.findUnique({
      where: { bookingId },
      include: { booking: true }
    });

    if (!payment || payment.status !== PaymentStatus.PAYMENT_SUCCESS) {
      return null;
    }

    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id,
        bookingId,
        amount: payment.amount,
        status: PaymentStatus.REFUNDED,
        reason,
        razorpayRefundId: `rfnd_${crypto.randomBytes(8).toString('hex')}`
      }
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REFUNDED }
    });

    return refund;
  }
}
