import { Router } from 'express';
import {
  getRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  triggerRule,
} from '../services/ruleService';
import type { Rule } from '@zhixu/shared/types';

const router = Router();

// 获取规则列表
router.get('/', async (req, res, next) => {
  try {
    const rules = await getRules();
    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
});

// 获取单个规则
router.get('/:id', async (req, res, next) => {
  try {
    const rule = await getRuleById(req.params.id);
    if (!rule) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Rule not found' },
      });
      return;
    }
    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    next(error);
  }
});

// 创建规则
router.post('/', async (req, res, next) => {
  try {
    const rule: Rule = req.body;
    const result = await createRule(rule);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// 更新规则
router.put('/:id', async (req, res, next) => {
  try {
    const rule: Rule = req.body;
    const result = await updateRule(req.params.id, rule);
    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Rule not found' },
      });
      return;
    }
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// 删除规则
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteRule(req.params.id);
    res.json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

// 手动触发规则
router.post('/:id/trigger', async (req, res, next) => {
  try {
    const result = await triggerRule(req.params.id);
    if (result.error) {
      res.status(400).json({ success: false, message: result.error });
      return;
    }
    res.json({
      success: true,
      data: {
        triggered: result.triggered,
        alert: result.alert,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as ruleRoutes };
