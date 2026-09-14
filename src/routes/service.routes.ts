import { Router } from 'express';
import { ServiceController } from '../controllers/service.controller';
import { CustomerController } from '../controllers/customer.controller';

const router = Router();

// Public routes for browsing service catalog
router.get('/categories', ServiceController.getCategories);
router.get('/active-workers', CustomerController.getActiveWorkers);
router.get('/', ServiceController.getServices);
router.get('/:id', ServiceController.getServiceDetails);

export default router;
