import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { aiCodeEventRoutes } from './routes/aiCodeEvent';
import { dashboardRoutes } from './routes/dashboard';
import { ruleRoutes } from './routes/rules';
import { healthRoutes } from './routes/health';
import { alertRoutes } from './routes/alerts';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './services/logger';
import { startScheduler, getSchedulerStatus, triggerManualScan } from './services/scheduler';

config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/events', aiCodeEventRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/alerts', alertRoutes);

// Scheduler API
app.get('/api/scheduler/status', (_req, res) => {
  res.json({ success: true, data: getSchedulerStatus() });
});

app.post('/api/scheduler/scan', async (_req, res) => {
  try {
    const result = await triggerManualScan();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`知墟 Server (ZhiXu ACOP) running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // 启动规则调度器
  startScheduler();
  logger.info(`规则调度器已启动：每 60 秒扫描一次规则`);
});

export default app;
