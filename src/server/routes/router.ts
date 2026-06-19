/**
 * 模型路由 API 路由
 * POST /api/router/route    - 执行路由决策
 * GET  /api/router/models   - 获取所有模型画像
 * PUT  /api/router/models/:id - 更新模型画像
 * GET  /api/router/rules   - 获取路由规则
 * POST /api/router/rules   - 创建路由规则
 * PUT  /api/router/rules/:id - 更新路由规则
 * DELETE /api/router/rules/:id - 删除路由规则
 * GET  /api/router/stats   - 获取路由统计
 * GET  /api/router/history - 获取路由历史
 * POST /api/router/simulate - 模拟路由（预览）
 * GET  /api/router/task-types - 获取任务类型列表
 */
import { Router, Request, Response } from 'express';
import { routerService } from '../services/routerService';
import { modelProfileService } from '../services/modelProfileService';
import { taskClassifier } from '../services/taskClassifier';
import { logger } from '../services/logger';

const router = Router();

// =============================================
// 模型画像
// =============================================

/** 获取所有模型画像 */
router.get('/models', (_req: Request, res: Response) => {
  try {
    const profiles = modelProfileService.getAllProfiles();
    return res.json({ success: true, data: profiles });
  } catch (error) {
    logger.error('[Router API] 获取模型画像失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '获取失败' } });
  }
});

/** 更新模型画像 */
router.put('/models/:modelId', (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const { enabled, capabilities, tags, costPerMillionInput, costPerMillionOutput } = req.body;
    const updates: Record<string, unknown> = {};
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (capabilities) updates.capabilities = capabilities;
    if (Array.isArray(tags)) updates.tags = tags;
    if (typeof costPerMillionInput === 'number') updates.costPerMillionInput = costPerMillionInput;
    if (typeof costPerMillionOutput === 'number') updates.costPerMillionOutput = costPerMillionOutput;

    const ok = modelProfileService.updateProfile(modelId, updates);
    if (!ok) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '模型不存在' } });
    }
    return res.json({ success: true, data: modelProfileService.getProfile(modelId) });
  } catch (error) {
    logger.error('[Router API] 更新模型画像失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '更新失败' } });
  }
});

/** 新增自定义模型 */
router.post('/models', (req: Request, res: Response) => {
  try {
    const profile = req.body;
    if (!profile.modelId || !profile.displayName || !profile.provider) {
      return res.status(400).json({ success: false, error: { code: 'INVALID', message: '缺少必填字段' } });
    }
    profile.provider = 'custom';
    const ok = modelProfileService.addProfile(profile);
    if (!ok) {
      return res.status(409).json({ success: false, error: { code: 'EXISTS', message: '模型 ID 已存在' } });
    }
    return res.json({ success: true, data: modelProfileService.getProfile(profile.modelId) });
  } catch (error) {
    logger.error('[Router API] 新增模型失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '新增失败' } });
  }
});

// =============================================
// 路由规则
// =============================================

/** 获取所有路由规则 */
router.get('/rules', (_req: Request, res: Response) => {
  try {
    const rules = routerService.getAllRules();
    return res.json({ success: true, data: rules });
  } catch (error) {
    logger.error('[Router API] 获取路由规则失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '获取失败' } });
  }
});

/** 创建路由规则 */
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const rule = req.body;
    if (!rule.name || !rule.strategy || !Array.isArray(rule.conditions?.taskTypes)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID', message: '缺少必填字段' } });
    }
    const newRule = await routerService.createRule(rule);
    return res.json({ success: true, data: newRule });
  } catch (error) {
    logger.error('[Router API] 创建路由规则失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '创建失败' } });
  }
});

/** 更新路由规则 */
router.put('/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ok = await routerService.updateRule(id, req.body);
    if (!ok) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '规则不存在' } });
    }
    return res.json({ success: true, data: routerService.getRule(id) });
  } catch (error) {
    logger.error('[Router API] 更新路由规则失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '更新失败' } });
  }
});

/** 删除路由规则 */
router.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ok = await routerService.deleteRule(id);
    if (!ok) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '规则不存在或内置规则无法删除' } });
    }
    return res.json({ success: true });
  } catch (error) {
    logger.error('[Router API] 删除路由规则失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '删除失败' } });
  }
});

// =============================================
// 路由决策
// =============================================

/** 执行路由决策（核心接口） */
router.post('/route', async (req: Request, res: Response) => {
  try {
    const { input, sessionId, inputTokens } = req.body;
    if (!input || !sessionId) {
      return res.status(400).json({ success: false, error: { code: 'INVALID', message: '缺少 input 或 sessionId' } });
    }
    const decision = await routerService.route(input, sessionId, inputTokens || 0);
    return res.json({ success: true, data: decision });
  } catch (error) {
    logger.error('[Router API] 路由决策失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '路由决策失败' } });
  }
});

/** 模拟路由（预览模式，不记录统计） */
router.post('/simulate', (req: Request, res: Response) => {
  try {
    const { input, strategy } = req.body;
    if (!input) {
      return res.status(400).json({ success: false, error: { code: 'INVALID', message: '缺少 input' } });
    }
    const classification = taskClassifier.classify(input);
    const result = routerService.simulate(input, strategy);
    return res.json({ success: true, data: { ...result, _debug: { matchedKeywords: classification.matchedKeywords, reasoning: classification.reasoning } } });
  } catch (error) {
    logger.error('[Router API] 路由模拟失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '模拟失败' } });
  }
});

/** 回填路由结果（路由执行完毕后调用） */
router.post('/outcome', async (req: Request, res: Response) => {
  try {
    const { decisionId, actualLatency, actualTokens, actualQuality } = req.body;
    if (!decisionId) {
      return res.status(400).json({ success: false, error: { code: 'INVALID', message: '缺少 decisionId' } });
    }
    await routerService.recordOutcome(decisionId, actualLatency, actualTokens, actualQuality);
    return res.json({ success: true });
  } catch (error) {
    logger.error('[Router API] 回填路由结果失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '回填失败' } });
  }
});

// =============================================
// 统计与历史
// =============================================

/** 获取路由统计 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = routerService.getStats();
    return res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('[Router API] 获取路由统计失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '获取失败' } });
  }
});

/** 获取路由历史 */
router.get('/history', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = routerService.getHistory(limit);
    return res.json({ success: true, data: history });
  } catch (error) {
    logger.error('[Router API] 获取路由历史失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '获取失败' } });
  }
});

/** 获取支持的任务类型列表 */
router.get('/task-types', (_req: Request, res: Response) => {
  try {
    const types = taskClassifier.getSupportedTaskTypes();
    const result = types.map(t => ({
      id: t,
      name: taskClassifier.getTaskTypeName(t),
    }));
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[Router API] 获取任务类型失败', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: '获取失败' } });
  }
});

export default router;
