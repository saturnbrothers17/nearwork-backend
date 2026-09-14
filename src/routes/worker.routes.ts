import { Router } from 'express';
import { WorkerController } from '../controllers/worker.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { requireWorker } from '../middlewares/role.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { updateWorkerStatusSchema, updateLocationSchema } from '@nearwork/validation';

const router = Router();

// Protect all worker routes with JWT and strict WORKER role check
router.use(authenticateJwt, requireWorker);

router.get('/profile', WorkerController.getProfile);
router.patch('/status', validateRequest(updateWorkerStatusSchema), WorkerController.updateStatus);
router.post('/location', validateRequest(updateLocationSchema), WorkerController.updateLocation);
router.get('/jobs', WorkerController.getJobs);
router.get('/earnings', WorkerController.getEarnings);
router.post('/payouts', WorkerController.requestPayout);

export default router;
