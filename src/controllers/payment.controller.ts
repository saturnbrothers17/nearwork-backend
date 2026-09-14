import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '@nearwork/config';
import { PaymentService } from '../services/payment.service';

export class PaymentController {
  /**
   * Create Razorpay Order
   */
  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { bookingId } = req.body;
      const customerId = req.user!.id;
      const order = await PaymentService.createOrder(bookingId, customerId);
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Payment order created',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify Razorpay Payment Signature
   */
  static async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.id;
      const result = await PaymentService.verifyPayment(customerId, req.body);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Payment verified successfully and booking confirmed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cash / Pay after service confirmation
   */
  static async confirmCash(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.id;
      const { bookingId } = req.body;
      const result = await PaymentService.confirmCashPayment(customerId, bookingId);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Cash payment selected. Dispatched to nearby professionals.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Razorpay Webhook listener for asynchronous events
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      // Return 200 immediately for Razorpay webhook verification
      res.status(HTTP_STATUS.OK).json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  }
}
