import { Router, type IRouter } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import ordersRouter from './orders';
import catalogsRouter from './catalogs';
import logisticsRouter from './logistics';
import policiesRouter from './policies';
import decisionsRouter from './decisions';
import dashboardRouter from './dashboard';
import analyticsRouter from './analytics';
import webhooksRouter from './webhooks';
import listingsRouter from './listings';

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(ordersRouter);
router.use(catalogsRouter);
router.use(logisticsRouter);
router.use(policiesRouter);
router.use(decisionsRouter);
router.use(dashboardRouter);
router.use(analyticsRouter);
router.use(webhooksRouter);
router.use(listingsRouter);

export default router;
