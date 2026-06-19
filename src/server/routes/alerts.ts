import express from 'express';
import { sendTestAlert, setChannelConfig, getChannelConfig, getEnabledChannels } from '../services/alertService';
import { logger } from '../services/logger';

const router = express.Router();

// 测试发送告警
router.post('/test', async (req, res, next) => {
  try {
    const { channel, config } = req.body;
    
    logger.info('Received alert test request', { channel, config: { 
      ...config, 
      password: config?.password ? '***' : undefined,
      secret: config?.secret ? '***' : undefined 
    } });

    if (!channel) {
      logger.warn('Alert test failed: missing channel');
      res.status(400).json({ success: false, message: '缺少渠道参数' });
      return;
    }

    const result = await sendTestAlert(channel, config);

    logger.info('Alert test result', { channel, success: result.success, message: result.message });
    
    res.json({
      success: result.success,
      message: result.message,
      details: result.details,
    });
  } catch (error) {
    logger.error('Alert test error', { error: String(error) });
    next(error);
  }
});

// 保存通道配置（供规则引擎使用）
router.post('/config', (req, res) => {
  try {
    const { channel, config, enabled } = req.body;

    if (!channel || !config) {
      res.status(400).json({ success: false, message: '缺少 channel 或 config 参数' });
      return;
    }

    setChannelConfig(channel, config, enabled !== false);
    logger.info(`Channel config saved: ${channel}`, { enabled: enabled !== false });

    res.json({
      success: true,
      message: `通道 ${channel} 配置已保存`,
      enabledChannels: getEnabledChannels(),
    });
  } catch (error) {
    logger.error('Channel config save error', { error: String(error) });
    res.status(500).json({ success: false, message: String(error) });
  }
});

// 获取所有已启用的通道
router.get('/channels', (_req, res) => {
  res.json({
    success: true,
    channels: getEnabledChannels().map((ch) => ({ channel: ch, enabled: !!getChannelConfig(ch)?.enabled })),
  });
});

export { router as alertRoutes };
