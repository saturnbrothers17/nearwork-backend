import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middlewares/validate.middleware';
import { authenticateJwt } from '../middlewares/auth.middleware';
import {
  registerCustomerSchema,
  registerWorkerSchema,
  loginSchema,
  refreshTokenSchema
} from '@nearwork/validation';

const router = Router();

router.post('/register/customer', validateRequest(registerCustomerSchema), AuthController.registerCustomer);
router.post('/register/worker', validateRequest(registerWorkerSchema), AuthController.registerWorker);
router.post('/login', validateRequest(loginSchema), AuthController.login);
router.post('/refresh', validateRequest(refreshTokenSchema), AuthController.refresh);
router.post('/logout', authenticateJwt, AuthController.logout);
router.get('/me', authenticateJwt, AuthController.me);

export default router;
