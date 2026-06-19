import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { aiCodeEventRoutes } from './routes/aiCodeEvent';
import { dashboardRoutes } from './routes/dashboard';
import { ruleRoutes } from './routes/rules';
import { healthRoutes } from './routes/health';
import { alertRoutes } from './routes/alerts';
import { adapterRoutes } from './routes/adapters';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './services/logger';
import { startScheduler, getSchedulerStatus, triggerManualScan } from './services/scheduler';
import { adapterService } from './services/adapterService';
import { TraeAdapter } from './services/adapters/traeAdapter';
import { ClaudeCodeAdapter } from './services/adapters/claudeCodeAdapter';
import { CursorAdapter } from './services/adapters/cursorAdapter';
import * as aiCodeEventService from './services/aiCodeEventService';
import * as alertService from './services/alertService';
import * as ruleService from './services/ruleService';

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
app.use('/api/adapters', adapterRoutes);

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
app.listen(PORT, async () => {
  logger.info(`知墟 Server (ZhiXu ACOP) running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // 加载持久化数据（事件、规则、告警通道配置）
  await aiCodeEventService.loadFromStorage();
  await alertService.loadFromStorage();
  await ruleService.loadFromStorage();
  logger.info(`持久化数据加载完成`);

  // 启动规则调度器
  startScheduler();
  logger.info(`规则调度器已启动：每 60 秒扫描一次规则`);

  // 注册并初始化适配器（采集 Trae/Claude Code/Cursor 的真实事件）
  adapterService.register(new TraeAdapter({ name: 'Trae 适配器', version: '1.2.0', enabled: true, mode: 'auto' }));
  adapterService.register(new ClaudeCodeAdapter({ name: 'Claude Code 适配器', version: '1.2.0', enabled: true, mode: 'auto' }));
  adapterService.register(new CursorAdapter({ name: 'Cursor 适配器', version: '1.2.0', enabled: true, mode: 'auto' }));
  await adapterService.initializeAll();

  // 启动适配器定时采集（每 15 秒读取一次适配器事件）
  adapterService.startScheduledCollection(15000);
  logger.info(`适配器已启动并开始定时采集（每 15 秒）`);
});

export default app;
