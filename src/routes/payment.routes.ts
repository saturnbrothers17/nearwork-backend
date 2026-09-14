import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { requireCustomer } from '../middlewares/role.middleware';

const router = Router();

// Webhook (unauthenticated, signature-verified)
router.post('/webhook', PaymentController.handleWebhook);

// Customer payment endpoints
router.post('/order', authenticateJwt, requireCustomer, PaymentController.createOrder);
router.post('/verify', authenticateJwt, requireCustomer, PaymentController.verifyPayment);
router.post('/cash', authenticateJwt, requireCustomer, PaymentController.confirmCash);

export default router;
