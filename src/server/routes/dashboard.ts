import { Router } from 'express';
import {
  getDashboardStats,
  getTokenTrend,
  getErrorDistribution,
  getToolUsageStats,
  getRecentSessions,
  getAlertTrend,
  getAlertStats,
  getRuleStats,
  getRouterStats,
} from '../services/dashboardService';

const router = Router();

// 获取仪表盘统计数据（支持 days 或 startDate/endDate）
router.get('/stats', async (req, res, next) => {
  try {
    const { days, startDate, endDate } = req.query;
    const stats = await getDashboardStats({
      days: days as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// 获取 Token 消耗趋势
router.get('/token-trend', async (req, res, next) => {
  try {
    const { days, startDate, endDate } = req.query;
    const trend = await getTokenTrend({
      days: days as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    res.json({ success: true, data: trend });
  } catch (error) {
    next(error);
  }
});

// 获取错误分布
router.get('/error-distribution', async (req, res, next) => {
  try {
    const { days, startDate, endDate } = req.query;
    const distribution = await getErrorDistribution({
      days: days as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    res.json({ success: true, data: distribution });
  } catch (error) {
    next(error);
  }
});

// 获取工具使用统计
router.get('/tool-usage', async (req, res, next) => {
  try {
    const { days, startDate, endDate } = req.query;
    const stats = await getToolUsageStats({
      days: days as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// 获取最近会话
router.get('/sessions', async (req, res, next) => {
  try {
    const { limit = '10' } = req.query;
    const sessions = await getRecentSessions(Number(limit));
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

// 获取告警趋势（按天统计）
router.get('/alert-trend', async (req, res, next) => {
  try {
    const { days, startDate, endDate } = req.query;
    const trend = await getAlertTrend({
      days: days as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    res.json({ success: true, data: trend });
  } catch (error) {
    next(error);
  }
});

// 获取告警统计摘要
router.get('/alert-stats', async (_req, res, next) => {
  try {
    const stats = await getAlertStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// 获取规则触发统计
router.get('/rule-stats', async (_req, res, next) => {
  try {
    const stats = await getRuleStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// 获取路由决策统计
router.get('/router-stats', async (_req, res, next) => {
  try {
    const stats = await getRouterStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

export { router as dashboardRoutes };
