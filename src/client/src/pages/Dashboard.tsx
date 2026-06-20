import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { api } from '../services/api';
import { useToast, createToastApi, ToastContainer } from '../hooks/useToast';

interface DashboardStats {
  totalTokens: number;
  totalRequests: number;
  avgLatency: number;
  errorRate: number;
  totalCost: number;
  activeSessions: number;
}

interface TokenTrend {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface ErrorDistribution {
  errorType: string;
  count: number;
  percentage: number;
}

interface ToolUsage {
  tool: string;
  requestCount: number;
  totalTokens: number;
  avgLatency: number;
  errorRate: number;
}

interface AlertTrend {
  date: string;
  critical: number;
  warning: number;
  info: number;
  total: number;
}

interface AlertStats {
  total: number;
  critical: number;
  warning: number;
  info: number;
  acknowledged: number;
  unacknowledged: number;
}

interface RuleStat {
  ruleId: string;
  ruleName: string;
  priority: 'low' | 'medium' | 'high';
  enabled: boolean;
  triggerCount: number;
  lastTriggeredAt?: number;
}

interface RuleStats {
  total: number;
  enabled: number;
  totalTriggers: number;
  rules: RuleStat[];
}

interface RouterStats {
  totalDecisions: number;
  activeModels: number;
  topModel: string;
  topStrategy: string;
  taskTypeDistribution: Record<string, number>;
  strategyUsage: Record<string, number>;
  modelUsage: Record<string, number>;
}

// 任务类型中文映射
const TASK_TYPE_LABELS: Record<string, string> = {
  bug_fix: 'Bug 修复', debugging: '调试诊断', code_review: '代码审查',
  refactoring: '重构优化', code_completion: '代码补全', code_generation: '代码生成',
  explanation: '代码解释', documentation: '文档生成', testing: '测试生成',
  optimization: '性能优化', security_review: '安全审查', architecture: '架构设计',
  migration: '代码迁移', general: '通用对话',
};

// ========== 告警 Banner ==========
interface BannerAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: number;
}

function AlertBanner({
  unacknowledgedCount,
  recentAlerts,
  onViewAll,
  onDismiss,
}: {
  unacknowledgedCount: number;
  recentAlerts: BannerAlert[];
  onViewAll: () => void;
  onDismiss: () => void;
}) {
  if (unacknowledgedCount === 0) return null;

  const hasCritical = recentAlerts.some((a) => a.severity === 'critical' || a.severity === 'error');
  const topAlert = recentAlerts[0];

  return (
    <div className={`alert-banner ${hasCritical ? 'alert-banner-critical' : 'alert-banner-warning'}`}>
      <div className="alert-banner-icon">
        {hasCritical ? '⚠' : '⚡'}
      </div>
      <div className="alert-banner-body">
        <div className="alert-banner-title">
          <span className="alert-banner-count">{unacknowledgedCount} 条未处理告警</span>
          {topAlert && (
            <span className="alert-banner-latest">
              · 最新：{topAlert.title} — {topAlert.message.slice(0, 60)}
              {topAlert.message.length > 60 ? '...' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="alert-banner-actions">
        <button className="btn btn-outline" onClick={onViewAll}>
          查看详情
        </button>
        <button className="btn btn-ghost" onClick={onDismiss} title="暂时隐藏">
          ✕
        </button>
      </div>
    </div>
  );
}

interface PromptStats {
  total: number;
  byType: {
    code_quality: number;
    context_cleanup: number;
    error_rate_reduction: number;
    latency_optimization: number;
    token_management: number;
  };
  byStatus: {
    generated: number;
    reviewed: number;
    applied: number;
    dismissed: number;
  };
  recentlyGenerated: number;
}

const COLORS = ['#00f5ff', '#00ff88', '#ff6b35', '#ff3366'];

// 告警严重程度颜色
const ALERT_COLORS = {
  critical: '#ff3366',
  warning: '#ff6b35',
  info: '#00f5ff',
};

// 周期选项
const TIME_RANGES = [
  { value: 7, label: '近7天' },
  { value: 14, label: '近14天' },
];

// 自定义日期范围类型
type DateRange = {
  type: 'preset';
  days: number;
} | {
  type: 'custom';
  startDate: string;
  endDate: string;
};

// 全屏组件
function FullscreenPanel({ children, title, isFullscreen, onToggle }: {
  children: React.ReactNode;
  title: string;
  isFullscreen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`${isFullscreen ? 'fullscreen-panel' : 'card-panel'}`}>
      <div className="panel-header">
        <div className="panel-title-wrapper">
          <span className="panel-indicator" />
          <span className="panel-title">{title}</span>
        </div>
        <button className="fullscreen-btn" onClick={onToggle} title={isFullscreen ? '退出全屏' : '全屏'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isFullscreen ? (
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            ) : (
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            )}
          </svg>
        </button>
      </div>
      <div className="panel-content">
        {children}
      </div>
      {isFullscreen && (
        <button className="fullscreen-close" onClick={onToggle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

// 迷你统计卡片
function MiniStatCard({ icon, label, value, change, trend }: {
  icon: string;
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
}) {
  return (
    <div className="mini-stat-card">
      <div className="mini-stat-icon">{icon}</div>
      <div className="mini-stat-content">
        <div className="mini-stat-value">{value}</div>
        <div className="mini-stat-label">{label}</div>
      </div>
      <div className={`mini-stat-change ${trend}`}>
        <span className="trend-arrow">{trend === 'up' ? '↑' : '↓'}</span>
        <span>{change}</span>
      </div>
    </div>
  );
}

// 脉冲指示器
function PulseIndicator({ active }: { active: boolean }) {
  return (
    <div className={`pulse-indicator ${active ? 'active' : 'inactive'}`}>
      <span className="pulse-dot" />
      <span className="pulse-ring" />
    </div>
  );
}

// 周期选择器（支持自定义日期）
function TimeRangeSelector({ value, onChange, onCustomOpen }: {
  value: DateRange;
  onChange: (days: number) => void;
  onCustomOpen: () => void;
}) {
  const isCustom = value.type === 'custom';
  return (
    <div className="time-range-selector">
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          className={`time-range-btn ${value.type === 'preset' && value.days === range.value ? 'active' : ''}`}
          onClick={() => onChange(range.value)}
        >
          {range.label}
        </button>
      ))}
      <button
        className={`time-range-btn time-range-custom ${isCustom ? 'active' : ''}`}
        onClick={onCustomOpen}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {isCustom ? `${value.startDate} 至 ${value.endDate}` : '自定义'}
      </button>
    </div>
  );
}

// 自定义日期选择器弹窗
function CustomDatePicker({ value, onApply, onClose, showError }: {
  value: { startDate: string; endDate: string };
  onApply: (startDate: string, endDate: string) => void;
  onClose: () => void;
  showError: (msg: string) => void;
}) {
  const [startDate, setStartDate] = useState(value.startDate);
  const [endDate, setEndDate] = useState(value.endDate);

  const handleApply = () => {
    if (startDate && endDate) {
      if (startDate > endDate) {
        showError('起始日期不能晚于结束日期');
        return;
      }
      onApply(startDate, endDate);
      onClose();
    } else {
      showError('请选择完整的日期范围');
    }
  };

  return (
    <div className="date-picker-overlay" onClick={onClose}>
      <div className="date-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="date-picker-header">
          <span>自定义日期范围</span>
          <button className="date-picker-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="date-picker-body">
          <div className="date-input-group">
            <label>起始日期</label>
            <input
              type="date"
              value={startDate}
              max={endDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="date-range-arrow">→</div>
          <div className="date-input-group">
            <label>结束日期</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="date-picker-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleApply}>应用</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tokenTrend, setTokenTrend] = useState<TokenTrend[]>([]);
  const [errorDistribution, setErrorDistribution] = useState<ErrorDistribution[]>([]);
  const [toolUsage, setToolUsage] = useState<ToolUsage[]>([]);
  const [alertTrend, setAlertTrend] = useState<AlertTrend[]>([]);
  const [alertStats, setAlertStats] = useState<AlertStats>({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    acknowledged: 0,
    unacknowledged: 0,
  });
  const [ruleStats, setRuleStats] = useState<RuleStats>({
    total: 0,
    enabled: 0,
    totalTriggers: 0,
    rules: [],
  });
  const [routerStats, setRouterStats] = useState<RouterStats>({
    totalDecisions: 0,
    activeModels: 0,
    topModel: '-',
    topStrategy: '-',
    taskTypeDistribution: {},
    strategyUsage: {},
    modelUsage: {},
  });
  const [promptStats, setPromptStats] = useState<PromptStats>({
    total: 0,
    byType: {
      code_quality: 0,
      context_cleanup: 0,
      error_rate_reduction: 0,
      latency_optimization: 0,
      token_management: 0,
    },
    byStatus: {
      generated: 0,
      reviewed: 0,
      applied: 0,
      dismissed: 0,
    },
    recentlyGenerated: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [time, setTime] = useState(new Date());
  const [timeRange, setTimeRange] = useState<DateRange>({ type: 'preset', days: 7 });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<BannerAlert[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const navigate = useNavigate();
  const { toasts, showToast, removeToast: removeToastToast } = useToast();
  const toast = createToastApi(showToast);

  // 辅助函数：生成查询参数
  const getQueryParams = () => {
    if (timeRange.type === 'preset') {
      return `days=${timeRange.days}`;
    }
    return `startDate=${timeRange.startDate}&endDate=${timeRange.endDate}`;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = getQueryParams();
      const [statsRes, trendRes, errorRes, toolRes, alertTrendRes, alertStatsRes, ruleStatsRes, promptStatsRes, alertsRes, routerStatsRes] = await Promise.all([
        api.get<DashboardStats>(`/api/dashboard/stats?${queryParams}`),
        api.get<TokenTrend[]>(`/api/dashboard/token-trend?${queryParams}`),
        api.get<ErrorDistribution[]>(`/api/dashboard/error-distribution?${queryParams}`),
        api.get<ToolUsage[]>(`/api/dashboard/tool-usage?${queryParams}`),
        api.get<AlertTrend[]>(`/api/dashboard/alert-trend?${queryParams}`),
        api.get<AlertStats>(`/api/dashboard/alert-stats`),
        api.get<RuleStats>(`/api/dashboard/rule-stats`),
        api.get<PromptStats>(`/api/prompt-injections/stats`),
        api.get<BannerAlert[]>(`/api/alerts?limit=5&unacknowledged=true`),
        api.get<RouterStats>(`/api/dashboard/router-stats`),
      ]);

      setStats(statsRes.data || {
        totalTokens: 0,
        totalRequests: 0,
        avgLatency: 0,
        errorRate: 0,
        totalCost: 0,
        activeSessions: 0,
      });
      setTokenTrend(trendRes.data || []);
      setErrorDistribution(errorRes.data || []);
      setToolUsage(toolRes.data || []);
      setAlertTrend(alertTrendRes.data || []);
      setAlertStats(alertStatsRes.data || {
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        acknowledged: 0,
        unacknowledged: 0,
      });
      setRuleStats(ruleStatsRes.data || {
        total: 0,
        enabled: 0,
        totalTriggers: 0,
        rules: [],
      });
      setPromptStats(promptStatsRes.data || {
        total: 0,
        byType: {
          code_quality: 0,
          context_cleanup: 0,
          error_rate_reduction: 0,
          latency_optimization: 0,
          token_management: 0,
        },
        byStatus: {
          generated: 0,
          reviewed: 0,
          applied: 0,
          dismissed: 0,
        },
        recentlyGenerated: 0,
      });
      const alertsData = alertsRes?.data || [];
      setRecentAlerts(alertsData);
      if (alertsData.length > 0) {
        setBannerDismissed(false);
      }
      setRouterStats(routerStatsRes.data || {
        totalDecisions: 0,
        activeModels: 0,
        topModel: '-',
        topStrategy: '-',
        taskTypeDistribution: {},
        strategyUsage: {},
        modelUsage: {},
      });
      setLastUpdate(new Date());
      toast.success(`数据已更新 (${new Date().toLocaleTimeString()})`);
    } catch (error) {
      console.error('获取看板数据失败:', error);
      toast.error('获取看板数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(0);
  };

  const formatCost = (cost: number) => {
    return '¥' + cost.toFixed(2);
  };

  const toggleFullscreen = useCallback((panelId: string) => {
    setActivePanel(prev => prev === panelId ? null : panelId);
  }, []);

  const handleTimeRangeChange = (days: number) => {
    setTimeRange({ type: 'preset', days });
  };

  const handleCustomRange = (startDate: string, endDate: string) => {
    setTimeRange({ type: 'custom', startDate, endDate });
  };

  const getDefaultCustomDates = () => {
    if (timeRange.type === 'custom') {
      return { startDate: timeRange.startDate, endDate: timeRange.endDate };
    }
    const today = new Date();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(today.getDate() - 14);
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    return { startDate: formatDate(twoWeeksAgo), endDate: formatDate(today) };
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-container">
          <div className="cyber-loader">
            <div className="cyber-ring" />
            <div className="cyber-ring" />
            <div className="cyber-ring" />
          </div>
          <div className="loading-text">正在加载<span className="loading-dots" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      {/* 背景网格效果 */}
      <div className="bg-grid" />
      <div className="bg-glow" />

      {/* 页面头部 */}
      <div className="page-header">
        <div className="header-left">
          <div className="title-wrapper">
            <PulseIndicator active={true} />
            <h1 className="page-title">
              <span className="title-main">知墟</span>
              <span className="title-acop">ACOP</span>
            </h1>
          </div>
          <div className="system-info">
            <span className="info-item">
              <span className="info-label">状态</span>
              <span className="info-value">运行中</span>
            </span>
            <span className="info-divider">|</span>
            <span className="info-item">
              <span className="info-label">时间</span>
              <span className="info-value">{time.toLocaleTimeString()}</span>
            </span>
          </div>
        </div>
        <div className="header-right">
          <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} onCustomOpen={() => setShowDatePicker(true)} />
          <span className="update-time">
            <span className="update-label">最后同步</span>
            <span className="update-value">{lastUpdate.toLocaleTimeString()}</span>
          </span>
          <button className="btn-refresh" onClick={fetchData}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>刷新</span>
          </button>
        </div>
      </div>

      {/* 告警 Banner */}
      {!bannerDismissed && (
        <AlertBanner
          unacknowledgedCount={alertStats.unacknowledged}
          recentAlerts={recentAlerts}
          onViewAll={() => navigate('/alerts')}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* 统计卡片 - 迷你版 */}
      <div className="stats-grid">
        <MiniStatCard
          icon="◈"
          label="Token 总消耗"
          value={formatNumber(stats?.totalTokens || 0)}
          change="12.5%"
          trend="up"
        />
        <MiniStatCard
          icon="◐"
          label="平均延迟"
          value={`${(stats?.avgLatency || 0).toFixed(0)}ms`}
          change="5.2%"
          trend="up"
        />
        <MiniStatCard
          icon="◓"
          label="错误率"
          value={`${(stats?.errorRate || 0).toFixed(1)}%`}
          change="0.3%"
          trend="down"
        />
        <MiniStatCard
          icon="◒"
          label="总成本"
          value={formatCost(stats?.totalCost || 0)}
          change="8.2%"
          trend="up"
        />
      </div>

      {/* 告警统计卡片 */}
      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #ff3366' }}>
          <div className="mini-stat-icon" style={{ color: '#ff3366' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#ff3366' }}>{alertStats.critical}</div>
            <div className="mini-stat-label">严重告警</div>
          </div>
        </div>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #ff6b35' }}>
          <div className="mini-stat-icon" style={{ color: '#ff6b35' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#ff6b35' }}>{alertStats.warning}</div>
            <div className="mini-stat-label">警告告警</div>
          </div>
        </div>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #00f5ff' }}>
          <div className="mini-stat-icon" style={{ color: '#00f5ff' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#00f5ff' }}>{alertStats.info}</div>
            <div className="mini-stat-label">信息告警</div>
          </div>
        </div>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #00ff88' }}>
          <div className="mini-stat-icon" style={{ color: '#00ff88' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#00ff88' }}>{alertStats.unacknowledged}</div>
            <div className="mini-stat-label">未确认</div>
          </div>
        </div>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #9966ff' }}>
          <div className="mini-stat-icon" style={{ color: '#9966ff' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#9966ff' }}>{alertStats.acknowledged}</div>
            <div className="mini-stat-label">已确认</div>
          </div>
        </div>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #ffaa00' }}>
          <div className="mini-stat-icon" style={{ color: '#ffaa00' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#ffaa00' }}>{alertStats.total}</div>
            <div className="mini-stat-label">总计</div>
          </div>
        </div>
      </div>

      {/* 提示注入统计卡片 */}
      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #9966ff' }}>
          <div className="mini-stat-icon" style={{ color: '#9966ff' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#9966ff' }}>{promptStats.total}</div>
            <div className="mini-stat-label">提示总数</div>
          </div>
        </div>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #00ff88' }}>
          <div className="mini-stat-icon" style={{ color: '#00ff88' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#00ff88' }}>{promptStats.byStatus.applied || 0}</div>
            <div className="mini-stat-label">已应用</div>
          </div>
        </div>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #ffaa00' }}>
          <div className="mini-stat-icon" style={{ color: '#ffaa00' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#ffaa00' }}>{(promptStats.byStatus.generated || 0) + (promptStats.byStatus.reviewed || 0)}</div>
            <div className="mini-stat-label">待处理</div>
          </div>
        </div>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #00f5ff' }}>
          <div className="mini-stat-icon" style={{ color: '#00f5ff' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#00f5ff' }}>{promptStats.recentlyGenerated}</div>
            <div className="mini-stat-label">近24小时</div>
          </div>
        </div>
      </div>

      {/* 路由决策统计卡片 */}
      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #00b4d8' }}>
          <div className="mini-stat-icon" style={{ color: '#00b4d8' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#00b4d8' }}>{routerStats.totalDecisions}</div>
            <div className="mini-stat-label">路由决策总数</div>
          </div>
        </div>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #0077b6' }}>
          <div className="mini-stat-icon" style={{ color: '#0077b6' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#0077b6' }}>{routerStats.activeModels}</div>
            <div className="mini-stat-label">活跃模型数</div>
          </div>
        </div>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #023e8a' }}>
          <div className="mini-stat-icon" style={{ color: '#023e8a' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#023e8a', fontSize: '1rem' }}>{routerStats.topModel}</div>
            <div className="mini-stat-label">Top 模型</div>
          </div>
        </div>
        <div className="mini-stat-card" style={{ borderLeft: '3px solid #48cae4' }}>
          <div className="mini-stat-icon" style={{ color: '#48cae4' }}>◆</div>
          <div className="mini-stat-content">
            <div className="mini-stat-value" style={{ color: '#48cae4', fontSize: '0.85rem' }}>{routerStats.topStrategy}</div>
            <div className="mini-stat-label">Top 策略</div>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="charts-grid">
        {/* Token 消耗趋势 */}
        <FullscreenPanel
          title="Token 消耗趋势"
          isFullscreen={activePanel === 'token'}
          onToggle={() => toggleFullscreen('token')}
        >
          <div style={{ height: activePanel === 'token' ? 'calc(100vh - 200px)' : '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tokenTrend}>
                <defs>
                  <linearGradient id="inputGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f5ff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#00f5ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outputGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00ff88" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a3a4a" />
                <XAxis dataKey="date" stroke="#4a6a7a" fontSize={11} tickLine={false} />
                <YAxis stroke="#4a6a7a" fontSize={11} tickLine={false} tickFormatter={formatNumber} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(10, 20, 30, 0.95)',
                    border: '1px solid #00f5ff',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#00f5ff' }}
                  formatter={(value: number) => [value.toLocaleString(), '']}
                />
                <Line
                  type="monotone"
                  dataKey="inputTokens"
                  stroke="#00f5ff"
                  strokeWidth={2}
                  dot={false}
                  name="输入"
                  activeDot={{ r: 6, fill: '#00f5ff' }}
                />
                <Line
                  type="monotone"
                  dataKey="outputTokens"
                  stroke="#00ff88"
                  strokeWidth={2}
                  dot={false}
                  name="输出"
                  activeDot={{ r: 6, fill: '#00ff88' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </FullscreenPanel>

        {/* 告警趋势图 */}
        <FullscreenPanel
          title="告警趋势"
          isFullscreen={activePanel === 'alert'}
          onToggle={() => toggleFullscreen('alert')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: activePanel === 'alert' ? 'calc(100vh - 200px)' : '280px' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={alertTrend}>
                <defs>
                  <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff3366" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#ff3366" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="warningGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b35" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#ff6b35" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="infoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f5ff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#00f5ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a3a4a" />
                <XAxis dataKey="date" stroke="#4a6a7a" fontSize={11} tickLine={false} />
                <YAxis stroke="#4a6a7a" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(10, 20, 30, 0.95)',
                    border: '1px solid #00f5ff',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#00f5ff' }}
                />
                <Line
                  type="monotone"
                  dataKey="critical"
                  stroke="#ff3366"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#ff3366' }}
                  name="严重"
                  activeDot={{ r: 6, fill: '#ff3366' }}
                />
                <Line
                  type="monotone"
                  dataKey="warning"
                  stroke="#ff6b35"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#ff6b35' }}
                  name="警告"
                  activeDot={{ r: 6, fill: '#ff6b35' }}
                />
                <Line
                  type="monotone"
                  dataKey="info"
                  stroke="#00f5ff"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#00f5ff' }}
                  name="信息"
                  activeDot={{ r: 6, fill: '#00f5ff' }}
                />
              </LineChart>
              </ResponsiveContainer>
            </div>
            {/* 图例 */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '0.5rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff3366' }} />
                <span style={{ color: '#ff3366', fontSize: '0.75rem' }}>严重</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff6b35' }} />
                <span style={{ color: '#ff6b35', fontSize: '0.75rem' }}>警告</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#00f5ff' }} />
                <span style={{ color: '#00f5ff', fontSize: '0.75rem' }}>信息</span>
              </div>
            </div>
          </div>
        </FullscreenPanel>

        {/* 规则触发统计 */}
        <FullscreenPanel
          title="规则触发统计"
          isFullscreen={activePanel === 'rules'}
          onToggle={() => toggleFullscreen('rules')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 概览数字 */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{
                flex: 1, minWidth: 120, padding: '1rem',
                border: '1px solid rgba(0, 245, 255, 0.2)',
                borderRadius: '6px', background: 'rgba(0, 245, 255, 0.05)'
              }}>
                <div style={{ color: '#00f5ff', fontSize: '0.75rem', marginBottom: '0.25rem' }}>规则总数</div>
                <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 600 }}>{ruleStats.total}</div>
              </div>
              <div style={{
                flex: 1, minWidth: 120, padding: '1rem',
                border: '1px solid rgba(0, 255, 136, 0.2)',
                borderRadius: '6px', background: 'rgba(0, 255, 136, 0.05)'
              }}>
                <div style={{ color: '#00ff88', fontSize: '0.75rem', marginBottom: '0.25rem' }}>已启用</div>
                <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 600 }}>{ruleStats.enabled}</div>
              </div>
              <div style={{
                flex: 1, minWidth: 120, padding: '1rem',
                border: '1px solid rgba(255, 107, 53, 0.2)',
                borderRadius: '6px', background: 'rgba(255, 107, 53, 0.05)'
              }}>
                <div style={{ color: '#ff6b35', fontSize: '0.75rem', marginBottom: '0.25rem' }}>累计触发</div>
                <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 600 }}>{ruleStats.totalTriggers}</div>
              </div>
            </div>

            {/* 规则列表 */}
            <div>
              {ruleStats.rules.length === 0 ? (
                <div style={{ color: '#6a8a9a', textAlign: 'center', padding: '2rem' }}>暂无规则</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {ruleStats.rules.map((rule) => {
                    const priorityColor =
                      rule.priority === 'high' ? '#ff3366' :
                      rule.priority === 'medium' ? '#ff6b35' : '#00f5ff';
                    const priorityLabel =
                      rule.priority === 'high' ? '高' :
                      rule.priority === 'medium' ? '中' : '低';
                    return (
                      <div
                        key={rule.ruleId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          border: '1px solid rgba(0, 245, 255, 0.15)',
                          borderRadius: '6px',
                          background: rule.enabled ? 'rgba(0, 245, 255, 0.03)' : 'rgba(0,0,0,0.2)',
                          opacity: rule.enabled ? 1 : 0.55,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            background: `${priorityColor}20`,
                            color: priorityColor,
                            fontSize: '0.7rem',
                            borderRadius: '3px',
                            border: `1px solid ${priorityColor}40`,
                          }}>{priorityLabel}</span>
                          <span style={{ color: '#fff', fontSize: '0.85rem' }}>{rule.ruleName}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
                          <span style={{ color: '#8a9aaa' }}>
                            {rule.lastTriggeredAt
                              ? new Date(rule.lastTriggeredAt).toLocaleString('zh-CN')
                              : '未触发'}
                          </span>
                          <span style={{
                            color: '#00f5ff', fontWeight: 600, minWidth: '48px', textAlign: 'right'
                          }}>
                            {rule.triggerCount} 次
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </FullscreenPanel>

        {/* 路由决策统计 */}
        <FullscreenPanel
          title="🧭 路由决策统计"
          isFullscreen={activePanel === 'router'}
          onToggle={() => toggleFullscreen('router')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 概览数字 */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{
                flex: 1, minWidth: 120, padding: '1rem',
                border: '1px solid rgba(0, 180, 216, 0.2)',
                borderRadius: '6px', background: 'rgba(0, 180, 216, 0.05)'
              }}>
                <div style={{ color: '#00b4d8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>路由决策总数</div>
                <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 600 }}>{routerStats.totalDecisions}</div>
              </div>
              <div style={{
                flex: 1, minWidth: 120, padding: '1rem',
                border: '1px solid rgba(0, 119, 182, 0.2)',
                borderRadius: '6px', background: 'rgba(0, 119, 182, 0.05)'
              }}>
                <div style={{ color: '#0077b6', fontSize: '0.75rem', marginBottom: '0.25rem' }}>活跃模型数</div>
                <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 600 }}>{routerStats.activeModels}</div>
              </div>
            </div>

            {/* 任务类型分布 */}
            <div>
              <div style={{ color: '#8a9aaa', fontSize: '0.8rem', marginBottom: '0.75rem' }}>任务类型分布</div>
              {Object.keys(routerStats.taskTypeDistribution).length === 0 ? (
                <div style={{ color: '#6a8a9a', textAlign: 'center', padding: '1rem' }}>
                  暂无路由决策历史。调用 POST /api/router/route 后数据将显示在这里。
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(routerStats.taskTypeDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([type, count]) => {
                      const maxCount = Math.max(...Object.values(routerStats.taskTypeDistribution));
                      const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                      return (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ color: '#8a9aaa', fontSize: '0.8rem', minWidth: '90px', textAlign: 'right' }}>
                            {TASK_TYPE_LABELS[type] || type}
                          </span>
                          <div style={{ flex: 1, height: 8, background: 'rgba(0, 180, 216, 0.1)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#00b4d8', borderRadius: 4 }} />
                          </div>
                          <span style={{ color: '#00b4d8', fontSize: '0.8rem', minWidth: '40px', textAlign: 'right' }}>{count}次</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* 策略使用分布 */}
            <div>
              <div style={{ color: '#8a9aaa', fontSize: '0.8rem', marginBottom: '0.75rem' }}>策略使用分布</div>
              {Object.keys(routerStats.strategyUsage).length === 0 ? (
                <div style={{ color: '#6a8a9a', textAlign: 'center', padding: '1rem' }}>
                  暂无策略使用数据
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {Object.entries(routerStats.strategyUsage)
                    .sort((a, b) => b[1] - a[1])
                    .map(([strategy, count]) => {
                      const colors: Record<string, string> = {
                        cost_optimized: '#10b981',
                        speed_optimized: '#3b82f6',
                        quality_optimized: '#8b5cf6',
                        balanced: '#f59e0b',
                        custom: '#6b7280',
                      };
                      const names: Record<string, string> = {
                        cost_optimized: '成本优先',
                        speed_optimized: '速度优先',
                        quality_optimized: '质量优先',
                        balanced: '均衡策略',
                        custom: '自定义',
                      };
                      return (
                        <div key={strategy} style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.3rem 0.6rem', borderRadius: 6,
                          border: `1px solid ${colors[strategy] || '#6b7280'}40`,
                          background: `${colors[strategy] || '#6b7280'}10`,
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[strategy] || '#6b7280' }} />
                          <span style={{ color: colors[strategy] || '#6b7280', fontSize: '0.75rem' }}>
                            {names[strategy] || strategy}
                          </span>
                          <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>{count}次</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* 模型使用分布 */}
            <div>
              <div style={{ color: '#8a9aaa', fontSize: '0.8rem', marginBottom: '0.75rem' }}>模型使用分布</div>
              {Object.keys(routerStats.modelUsage).length === 0 ? (
                <div style={{ color: '#6a8a9a', textAlign: 'center', padding: '1rem' }}>
                  暂无模型使用数据
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(routerStats.modelUsage)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([modelId, count]) => {
                      const maxCount = Math.max(...Object.values(routerStats.modelUsage));
                      const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                      return (
                        <div key={modelId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ color: '#8a9aaa', fontSize: '0.8rem', minWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {modelId}
                          </span>
                          <div style={{ flex: 1, height: 8, background: 'rgba(72, 202, 228, 0.1)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#48cae4', borderRadius: 4 }} />
                          </div>
                          <span style={{ color: '#48cae4', fontSize: '0.8rem', minWidth: '40px', textAlign: 'right' }}>{count}次</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </FullscreenPanel>

        {/* 错误类型分布 */}
        <FullscreenPanel
          title="错误分布"
          isFullscreen={activePanel === 'error'}
          onToggle={() => toggleFullscreen('error')}
        >
          <div style={{ height: activePanel === 'error' ? 'calc(100vh - 200px)' : '280px', display: 'flex', alignItems: 'center' }}>
            <ResponsiveContainer width="45%" height="100%">
              <PieChart>
                <Pie
                  data={errorDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={activePanel === 'error' ? 80 : 50}
                  outerRadius={activePanel === 'error' ? 120 : 80}
                  paddingAngle={3}
                  dataKey="count"
                >
                  {errorDistribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      style={{ filter: `drop-shadow(0 0 8px ${COLORS[index % COLORS.length]})` }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="error-legend">
              {errorDistribution.map((item, index) => (
                <div key={item.errorType} className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="legend-label">{item.errorType}</span>
                  <span className="legend-value">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </FullscreenPanel>

        {/* 工具使用统计 - 全宽 */}
        <FullscreenPanel
          title="工具使用统计"
          isFullscreen={activePanel === 'tool'}
          onToggle={() => toggleFullscreen('tool')}
        >
          <div style={{ height: activePanel === 'tool' ? 'calc(100vh - 200px)' : '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toolUsage}>
                <defs>
                  <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f5ff" />
                    <stop offset="100%" stopColor="#0088aa" />
                  </linearGradient>
                  <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b35" />
                    <stop offset="100%" stopColor="#cc4422" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a3a4a" />
                <XAxis dataKey="tool" stroke="#4a6a7a" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" stroke="#4a6a7a" fontSize={11} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#4a6a7a" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(10, 20, 30, 0.95)',
                    border: '1px solid #00f5ff',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                />
                <Bar yAxisId="left" dataKey="requestCount" fill="url(#barGradient1)" name="请求数" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="avgLatency" fill="url(#barGradient2)" name="延迟(ms)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </FullscreenPanel>
      </div>

      {/* 全屏遮罩 */}
      {activePanel && <div className="fullscreen-overlay" onClick={() => setActivePanel(null)} />}

      {/* 自定义日期选择器 */}
      {showDatePicker && (
        <CustomDatePicker
          value={getDefaultCustomDates()}
          onApply={handleCustomRange}
          onClose={() => setShowDatePicker(false)}
          showError={(msg) => toast.error(msg)}
        />
      )}

      {/* Toast 通知 */}
      <ToastContainer toasts={toasts} onRemove={removeToastToast} />
    </div>
  );
}

export default Dashboard;
