/**
 * 告警通知服务
 * 支持钉钉、邮件、Webhook 等多种通知渠道
 */

import { logger } from './logger';
import nodemailer from 'nodemailer';
import { loadJSON, schedulePersist } from './storageService';

const STORAGE_KEY_CHANNELS = 'alert-channels';

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface DingtalkConfig {
  webhookUrl: string;
  secret?: string;
  atMobiles?: string[];
  isAtAll?: boolean;
}

export interface EmailConfig {
  smtpServer: string;
  smtpPort: number;
  username: string;
  password: string;
  toEmails: string;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
}

export interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

type ChannelConfigEntry = { config: DingtalkConfig | EmailConfig | WebhookConfig; enabled: boolean };
const channelConfigs: Map<string, ChannelConfigEntry> = new Map();

export async function loadFromStorage(): Promise<void> {
  const saved = await loadJSON<Array<{ channel: string; config: DingtalkConfig | EmailConfig | WebhookConfig; enabled: boolean }>>(
    STORAGE_KEY_CHANNELS,
    [],
  );
  saved.forEach((entry) => {
    channelConfigs.set(entry.channel, { config: entry.config, enabled: entry.enabled });
  });
  logger.info(`[AlertChannels] 从持久化加载 ${saved.length} 个通道配置`);
}

function persistChannels(): void {
  const entries: Array<{ channel: string; config: DingtalkConfig | EmailConfig | WebhookConfig; enabled: boolean }> = [];
  channelConfigs.forEach((val, key) => {
    entries.push({ channel: key, config: val.config, enabled: val.enabled });
  });
  schedulePersist(STORAGE_KEY_CHANNELS, () => entries);
}

export function setChannelConfig(channel: string, config: DingtalkConfig | EmailConfig | WebhookConfig, enabled: boolean = true) {
  channelConfigs.set(channel, { config, enabled });
  logger.info(`Channel config updated`, { channel, enabled });
  persistChannels();
}

export function clearChannelConfig(channel: string): void {
  channelConfigs.delete(channel);
  logger.info(`Channel config cleared`, { channel });
  persistChannels();
}

export function getChannelConfig(channel: string) {
  return channelConfigs.get(channel);
}

export function getEnabledChannels(): string[] {
  const enabled: string[] = [];
  channelConfigs.forEach((val, key) => {
    if (val.enabled) enabled.push(key);
  });
  return enabled;
}

const testAlert: Alert = {
  id: 'test-' + Date.now(),
  ruleId: 'test-rule',
  severity: 'info',
  title: '知墟 测试告警',
  message: '这是一条测试告警，用于验证告警通道配置是否正确。',
  timestamp: Date.now(),
  acknowledged: false,
};

export async function sendAlert(alert: Alert, channels: string[]): Promise<{ results: { channel: string; success: boolean; message: string }[] }> {
  const results: { channel: string; success: boolean; message: string }[] = [];

  logger.info('[Alert] sendAlert called', {
    alertId: alert.id,
    channels,
    configuredChannels: Array.from(channelConfigs.keys()),
    enabledFlags: Array.from(channelConfigs.entries()).map(([k, v]) => ({ channel: k, enabled: v.enabled })),
  });

  for (const channel of channels) {
    const channelInfo = channelConfigs.get(channel);
    if (!channelInfo) {
      logger.warn('[Alert] channel not configured', { channel });
      results.push({ channel, success: false, message: '通道未配置（请在设置页面中保存配置）' });
      continue;
    }
    if (!channelInfo.enabled) {
      logger.warn('[Alert] channel disabled', { channel });
      results.push({ channel, success: false, message: '通道未启用' });
      continue;
    }

    try {
      let result: TestResult = { success: false, message: '未实现' };

      switch (channel) {
        case 'dingtalk':
          result = await sendDingtalk(alert, channelInfo.config as DingtalkConfig);
          break;
        case 'email':
          result = await sendEmail(alert, channelInfo.config as EmailConfig);
          break;
        case 'webhook':
          result = await sendWebhook(alert, channelInfo.config as WebhookConfig);
          break;
        default:
          result = { success: false, message: `未知的告警通道: ${channel}` };
      }

      results.push({ channel, ...result });
      logger.info(`[Alert] sent via ${channel}`, { alertId: alert.id, success: result.success, message: result.message });
    } catch (error) {
      logger.error(`[Alert] failed via ${channel}`, { alertId: alert.id, error: String(error) });
      results.push({ channel, success: false, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { results };
}

// 钉钉发送
async function sendDingtalk(alert: Alert, config: DingtalkConfig): Promise<TestResult> {
  if (!config?.webhookUrl) {
    return { success: false, message: '钉钉 Webhook 地址未配置' };
  }

  try {
    const severityEmoji = { info: 'ℹ️', warning: '⚠️', error: '❌', critical: '🚨' };
    let url = config.webhookUrl;

    if (config.secret) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${config.secret}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(stringToSign);
      const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
      const sigArray = Array.from(new Uint8Array(signature));
      const sigBase64 = btoa(unescape(encodeURIComponent(String.fromCharCode(...sigArray))));
      const sign = encodeURIComponent(sigBase64);
      url = `${config.webhookUrl}&timestamp=${timestamp}&sign=${sign}`;
    }

    const message = {
      msgtype: 'markdown',
      markdown: {
        title: `${severityEmoji[alert.severity]} 知墟告警: ${alert.title}`,
        text: `### ${alert.title}\n\n**严重程度**: ${alert.severity}\n\n**描述**: ${alert.message}\n\n**时间**: ${new Date(alert.timestamp).toLocaleString('zh-CN')}\n\n**规则ID**: ${alert.ruleId}\n\n---\n> 知墟 (ZhiXu) 告警系统`,
      },
      at: { atMobiles: config.atMobiles || [], isAtAll: config.isAtAll || false },
    };

    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
    const data = await response.json();

    if (data.errcode === 0) {
      return { success: true, message: '钉钉告警发送成功' };
    } else {
      return { success: false, message: '钉钉告警发送失败', details: data.errmsg || '未知错误' };
    }
  } catch (error) {
    logger.error('Dingtalk send failed', { error: String(error) });
    return { success: false, message: '钉钉告警发送失败', details: error instanceof Error ? error.message : String(error) };
  }
}

// 邮件发送（使用 nodemailer，比手写 SMTP 稳定得多）
async function sendEmail(alert: Alert, config: EmailConfig): Promise<TestResult> {
  if (!config?.smtpServer || !config?.toEmails || !config.username || !config.password) {
    return { success: false, message: '邮箱配置不完整' };
  }

  try {
    const port = config.smtpPort || 465;
    const useSSL = port === 465;

    const maskedUser = maskEmail(config.username);
    logger.info('[Email] Sending', { host: config.smtpServer, port, from: maskedUser });

    const transporter = nodemailer.createTransport({
      host: config.smtpServer,
      port,
      secure: useSSL,
      auth: { user: config.username, pass: config.password },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    const emailBody = `知墟 (ZhiXu ACOP) 告警通知\n============================\n\n标题: ${alert.title}\n严重程度: ${alert.severity}\n描述: ${alert.message}\n时间: ${new Date(alert.timestamp).toLocaleString('zh-CN')}\n规则ID: ${alert.ruleId}\n\n---\n请登录知墟控制台查看详情。`;

    const result = await transporter.sendMail({
      from: config.username,
      to: config.toEmails,
      subject: `[${alert.severity.toUpperCase()}] 知墟 Alert: ${alert.title}`,
      text: emailBody,
    });

    logger.info('[Email] Sent', { messageId: result.messageId, response: result.response?.slice(0, 100) });
    return { success: true, message: '邮件告警发送成功', details: `messageId: ${result.messageId}` };
  } catch (error) {
    const err = error as any;
    logger.error('[Email] Send failed', { code: err.code, message: err.message });
    let userMsg = '邮件发送失败';
    let detail: string | undefined;

    const code = err.code || '';
    const msg = (err.message || '').toLowerCase();

    if (code === 'EAUTH' || msg.includes('authentication') || msg.includes('535') || msg.includes('530')) {
      userMsg = 'SMTP 认证失败';
      detail = '请检查：\n1) 用户名/密码是否正确\n2) QQ/163 邮箱必须使用"授权码"而非登录密码（邮箱设置 → POP3/SMTP 中生成）\n3) smtp.qq.com + 465 端口 (SSL)';
    } else if (code === 'ECONNREFUSED' || code === 'EPROTO') {
      userMsg = '无法连接到 SMTP 服务器';
      detail = `请确认 ${config.smtpServer}:${config.smtpPort} 地址和端口正确。\nQQ 邮箱推荐：smtp.qq.com + 465 (SSL)`;
    } else if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      userMsg = 'SMTP 服务器域名无法解析';
      detail = `请确认服务器拼写正确（QQ 邮箱应为：smtp.qq.com）`;
    } else if (code === 'ETIMEDOUT') {
      userMsg = '连接超时';
      detail = '请检查网络连接，或稍后重试';
    } else if (msg.includes('recipient') || msg.includes('550') || msg.includes('553')) {
      userMsg = '收件人邮箱不被接受';
      detail = '请检查收件人邮箱地址是否正确';
    } else {
      detail = err.message;
    }

    return { success: false, message: userMsg, details: detail };
  }
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const visible = Math.min(3, local.length);
  return local.slice(0, visible) + '***@' + domain;
}

// Webhook 发送
async function sendWebhook(alert: Alert, config: WebhookConfig): Promise<TestResult> {
  if (!config?.url) return { success: false, message: 'Webhook 地址未配置' };
  try {
    const payload = { alert, source: 'zhixu', timestamp: Date.now() };
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(config.headers || {}) };
    if (config.secret) {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(payload));
      const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
      const sigArray = Array.from(new Uint8Array(signature));
      const sigHex = sigArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      headers['X-Signature'] = `sha256=${sigHex}`;
    }
    const response = await fetch(config.url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const responseText = await response.text();
    if (response.ok) return { success: true, message: 'Webhook 发送成功', details: `HTTP ${response.status}` };
    return { success: false, message: 'Webhook 发送失败', details: `HTTP ${response.status}: ${responseText.slice(0, 200)}` };
  } catch (error) {
    return { success: false, message: 'Webhook 发送失败', details: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendTestAlert(
  channel: string,
  config?: DingtalkConfig | EmailConfig | WebhookConfig,
): Promise<TestResult> {
  switch (channel) {
    case 'dingtalk':
      return await testDingtalk(config as DingtalkConfig);
    case 'email':
      return await testEmail(config as EmailConfig);
    case 'webhook':
      return await testWebhook(config as WebhookConfig);
    default:
      return { success: false, message: '未知的告警渠道' };
  }
}

async function testDingtalk(config: DingtalkConfig): Promise<TestResult> {
  if (!config?.webhookUrl) {
    return { success: false, message: '请先填写钉钉 Webhook 地址' };
  }

  try {
    const severityEmoji = { info: 'ℹ️', warning: '⚠️', error: '❌', critical: '🚨' };
    let url = config.webhookUrl;

    if (config.secret) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${config.secret}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(stringToSign);
      const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
      const sigArray = Array.from(new Uint8Array(signature));
      const sigHex = sigArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      const sigBase64 = btoa(unescape(encodeURIComponent(String.fromCharCode(...sigArray))));
      const sign = encodeURIComponent(sigBase64);
      url = `${config.webhookUrl}&timestamp=${timestamp}&sign=${sign}`;
    }

    const message = {
      msgtype: 'markdown',
      markdown: {
        title: `${severityEmoji[testAlert.severity]} ${testAlert.title}`,
        text: `### ${testAlert.title}\n\n**严重程度**: ${testAlert.severity}\n\n**描述**: ${testAlert.message}\n\n**时间**: ${new Date(testAlert.timestamp).toLocaleString('zh-CN')}\n\n**规则ID**: ${testAlert.ruleId}\n\n---\n> 知墟 (ZhiXu) 告警系统`,
      },
      at: { atMobiles: config.atMobiles || [], isAtAll: config.isAtAll || false },
    };

    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
    const data = await response.json();

    if (data.errcode === 0) {
      return { success: true, message: '钉钉测试消息发送成功' };
    } else {
      return { success: false, message: '钉钉测试消息发送失败', details: data.errmsg || '未知错误' };
    }
  } catch (error) {
    logger.error('Dingtalk test failed', { error: String(error) });
    return { success: false, message: '钉钉测试消息发送失败', details: error instanceof Error ? error.message : String(error) };
  }
}

async function testEmail(config: EmailConfig): Promise<TestResult> {
  logger.info('[Email] Test starting', { smtpServer: config?.smtpServer, port: config?.smtpPort });

  if (!config?.smtpServer || !config?.toEmails) {
    return { success: false, message: '请先填写完整的邮箱配置', details: 'SMTP 服务器地址和收件人邮箱为必填项' };
  }
  if (!config.username || !config.password) {
    return { success: false, message: '请填写 SMTP 用户名和密码', details: 'QQ 邮箱需使用授权码而非登录密码' };
  }

  try {
    const port = config.smtpPort || 465;
    const useSSL = port === 465;

    const transporter = nodemailer.createTransport({
      host: config.smtpServer,
      port,
      secure: useSSL,
      auth: { user: config.username, pass: config.password },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    const result = await transporter.sendMail({
      from: config.username,
      to: config.toEmails,
      subject: `[TEST] 知墟邮件通道测试`,
      text: `知墟 (ZhiXu ACOP) 邮件测试\n============================\n\n这是一封从 知墟 告警系统发出的测试邮件。\n如果你收到这封邮件，说明 SMTP 配置正确，可以正常发送告警邮件。\n\n测试时间: ${new Date().toLocaleString('zh-CN')}\n收件人: ${config.toEmails}\n服务器: ${config.smtpServer}:${port}\n\n— 知墟 告警系统`,
    });

    logger.info('[Email] Test sent', { messageId: result.messageId, response: result.response?.slice(0, 150) });
    return { success: true, message: '测试邮件发送成功', details: `邮件已发送到 ${config.toEmails}，messageId: ${result.messageId}` };
  } catch (error) {
    const err = error as any;
    logger.error('[Email] Test failed', { code: err.code, message: err.message });

    let userMsg = '发送测试邮件失败';
    let detail: string = err.message || '未知错误';

    const code = err.code || '';
    const msg = (err.message || '').toLowerCase();

    if (code === 'EAUTH' || msg.includes('authentication') || msg.includes('535') || msg.includes('530')) {
      userMsg = 'SMTP 认证失败';
      detail = '请检查：\n1) 邮箱用户名是否正确\n2) QQ/163 邮箱必须使用"授权码"而非登录密码\n   （登录QQ邮箱 → 设置 → 账户 → 开启 SMTP 服务 → 生成授权码）\n3) smtp.qq.com + 465 端口 (SSL)';
    } else if (code === 'ECONNREFUSED') {
      userMsg = '无法连接到 SMTP 服务器';
      detail = `${config.smtpServer}:${config.smtpPort} 拒绝连接。推荐 QQ 邮箱：smtp.qq.com + 465 (SSL)`;
    } else if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      userMsg = 'SMTP 服务器域名无法解析';
      detail = `域名 "${config.smtpServer}" 解析失败。请检查拼写（QQ 邮箱应为 smtp.qq.com）`;
    } else if (code === 'ETIMEDOUT') {
      userMsg = '连接超时';
      detail = '请检查网络连接，或稍后重试。可能是代理/防火墙阻止了连接。';
    } else if (code === 'EPROTO') {
      userMsg = 'TLS 协议错误';
      detail = '请确认端口配置：465 使用 SSL，587 使用 STARTTLS';
    } else if (msg.includes('recipient') || msg.includes('550') || msg.includes('553')) {
      userMsg = '收件人邮箱不被接受';
      detail = `请确认 ${config.toEmails} 是有效的邮箱地址。`;
    }

    return { success: false, message: userMsg, details: detail };
  }
}

async function testWebhook(config: WebhookConfig): Promise<TestResult> {
  if (!config?.url) {
    return { success: false, message: '请先填写 Webhook 地址' };
  }

  try {
    const payload = { alert: testAlert, source: 'zhixu', timestamp: Date.now() };
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(config.headers || {}) };

    if (config.secret) {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(payload));
      const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
      const sigArray = Array.from(new Uint8Array(signature));
      const sigHex = sigArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      headers['X-Signature'] = `sha256=${sigHex}`;
    }

    const response = await fetch(config.url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const responseText = await response.text();

    if (response.ok) {
      return { success: true, message: 'Webhook 测试请求发送成功', details: `HTTP ${response.status} ${response.statusText}` };
    } else {
      return { success: false, message: 'Webhook 测试请求失败', details: `HTTP ${response.status} ${response.statusText}: ${responseText.slice(0, 200)}` };
    }
  } catch (error) {
    logger.error('Webhook test failed', { error: String(error) });
    return { success: false, message: 'Webhook 测试请求失败', details: error instanceof Error ? error.message : String(error) };
  }
}
