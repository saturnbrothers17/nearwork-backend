import { Router } from 'express';
import { TicketController } from '../controllers/ticket.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { createTicketSchema } from '@nearwork/validation';

const router = Router();

router.use(authenticateJwt);

router.post('/', validateRequest(createTicketSchema), TicketController.createTicket);
router.get('/my', TicketController.getMyTickets);
router.get('/all', requireAdmin, TicketController.getAllTickets);
router.patch('/:id', requireAdmin, TicketController.updateTicketStatus);

export default router;
