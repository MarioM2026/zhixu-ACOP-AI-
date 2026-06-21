import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { aiCodeEventRoutes } from './routes/aiCodeEvent';
import { dashboardRoutes } from './routes/dashboard';
import { ruleRoutes } from './routes/rules';
import { healthRoutes } from './routes/health';
import { alertRoutes } from './routes/alerts';
import { promptInjectionRoutes } from './routes/promptInjection';
import { adapterRoutes } from './routes/adapters';
import routerRoutes from './routes/router';
import contextRoutes from './routes/context';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './services/logger';
import { startScheduler, getSchedulerStatus, triggerManualScan } from './services/scheduler';
import { adapterService } from './services/adapterService';
import { TraeAdapter } from './services/adapters/traeAdapter';
import { ClaudeCodeAdapter } from './services/adapters/claudeCodeAdapter';
import { CursorAdapter } from './services/adapters/cursorAdapter';
import { routerService } from './services/routerService';
import { modelProfileService } from './services/modelProfileService';
import { contextManagerService } from './services/contextManagerService';
import * as aiCodeEventService from './services/aiCodeEventService';
import * as alertService from './services/alertService';
import * as ruleService from './services/ruleService';
import * as promptInjectionService from './services/promptInjectionService';
import { initDatabase, closeDatabase, saveDatabase } from './services/databaseService';

config();

// ESM 兼容：获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 前端静态文件目录（相对项目根目录）
// 开发模式: <project>/dist/client
// 打包模式: resources/app/dist/client
function getStaticDir(): string {
  // 先尝试从项目根目录找 dist/client
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const devPath = path.join(projectRoot, 'dist', 'client');
  if (fs.existsSync(path.join(devPath, 'index.html'))) {
    return devPath;
  }
  // 回退：从当前文件向上两级找 dist/client
  const altPath = path.resolve(__dirname, '..', '..', 'dist', 'client');
  if (fs.existsSync(path.join(altPath, 'index.html'))) {
    return altPath;
  }
  // 再回退：项目根目录下的 dist/client
  const cwdPath = path.join(process.cwd(), 'dist', 'client');
  if (fs.existsSync(path.join(cwdPath, 'index.html'))) {
    return cwdPath;
  }
  // 最终回退：返回 cwd 下的路径（即使不存在，express 会 404，不影响 API）
  return cwdPath;
}

const STATIC_DIR = getStaticDir();

// Middleware
// 注意：helmet 对静态文件会添加安全头，但会阻止内联脚本运行
// 对 API 路由使用严格安全策略，对静态文件使用较宽松策略
app.use('/api', helmet());
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
app.use('/api/prompt-injections', promptInjectionRoutes);
app.use('/api/adapters', adapterRoutes);
app.use('/api/router', routerRoutes);
app.use('/api/context', contextRoutes);

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

// 应用信息接口（告诉前端运行环境）
app.get('/api/app-info', (_req, res) => {
  res.json({
    success: true,
    data: {
      version: '1.0.0',
      isElectron: !!process.env.ZHIXU_DATA_DIR, // 通过环境变量判断是否在 Electron 中
      dataDir: process.env.ZHIXU_DATA_DIR || path.join(process.cwd(), 'data'),
      port: PORT,
      staticDir: STATIC_DIR,
    },
  });
});

// 前端静态文件服务（在 Electron 打包模式下提供界面）
// 注意: 仅当 dist/client 存在时才启用，否则不影响纯 API 模式
if (fs.existsSync(STATIC_DIR)) {
  logger.info(`[Server] 启用前端静态文件服务: ${STATIC_DIR}`);
  app.use(express.static(STATIC_DIR, {
    maxAge: '1h',
    extensions: ['html', 'js', 'css'],
  }));

  // SPA 回退: 非 API 请求且无匹配文件时返回 index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const indexPath = path.join(STATIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
} else {
  logger.info(`[Server] 未找到前端静态文件目录 (${STATIC_DIR})，仅提供 API 服务`);
}

// Error handler
app.use(errorHandler);

// 启动前先初始化所有服务（确保 API 可用时数据已就绪）
async function startup() {
  await initDatabase(); // SQLite 数据库初始化（不可用时自动降级）
  await aiCodeEventService.loadFromStorage();
  await alertService.loadFromStorage();
  await ruleService.loadFromStorage();
  await promptInjectionService.loadFromStorage();
  await routerService.initialize();
  await modelProfileService.initialize();
  await contextManagerService.initialize();
  startScheduler();
  adapterService.register(new TraeAdapter({ name: 'Trae 适配器', version: '1.2.0', enabled: true, mode: 'auto' }));
  adapterService.register(new ClaudeCodeAdapter({ name: 'Claude Code 适配器', version: '1.2.0', enabled: true, mode: 'auto' }));
  adapterService.register(new CursorAdapter({ name: 'Cursor 适配器', version: '1.2.0', enabled: true, mode: 'auto' }));
  await adapterService.loadConfigs();
  await adapterService.initializeAll();
}

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM，正在保存数据...');
  saveDatabase();
  closeDatabase();
  process.exit(0);
});
process.on('SIGINT', () => {
  logger.info('收到 SIGINT，正在保存数据...');
  saveDatabase();
  closeDatabase();
  process.exit(0);
});

// Start server
startup().then(() => {
  app.listen(PORT, () => {
    logger.info(`知墟 Server (ZhiXu ACOP) running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`持久化数据加载完成`);
    logger.info(`模型路由引擎已就绪`);
    logger.info(`规则调度器已启动：每 60 秒扫描一次规则`);
    adapterService.startScheduledCollection(15000);
    logger.info(`适配器已启动并开始定时采集（每 15 秒）`);
  });
}).catch((err) => {
  logger.error('启动失败', err);
  process.exit(1);
});

export default app;
