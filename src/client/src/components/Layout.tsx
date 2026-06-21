import { Outlet, Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', label: '监控看板', icon: '📊' },
  { path: '/alerts', label: '告警历史', icon: '🔔' },
  { path: '/events', label: '事件列表', icon: '📋' },
  { path: '/prompts', label: '提示注入中心', icon: '💡' },
  { path: '/rules', label: '规则管理', icon: '⚙️' },
  { path: '/router', label: '模型路由', icon: '🧭' },
  { path: '/context', label: '上下文管理', icon: '🧹' },
  { path: '/settings', label: '设置', icon: '🔧' },
];

function Layout() {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <aside
        style={{
          width: '240px',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          padding: '1.5rem 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-color)' }}>
            🏛️ 知墟
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            AI 编程助手观测平台
          </p>
        </div>

        {/* 导航菜单 */}
        <nav style={{ flex: 1 }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1.5rem',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                  textDecoration: 'none',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* 底部信息 */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div>版本: 1.0.0</div>
          <div style={{ marginTop: '0.25rem' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--success-color)',
                marginRight: '0.5rem',
              }}
            />
            服务正常
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
