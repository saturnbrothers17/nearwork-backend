import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJwt);

router.post('/messages', ChatController.sendMessage);
router.get('/messages/:bookingId', ChatController.getMessages);

export default router;
