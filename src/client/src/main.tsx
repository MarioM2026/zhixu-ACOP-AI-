import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 启动时应用保存的主题（默认深色）
try {
  const savedUI = localStorage.getItem('zhixu-ui-config');
  let theme = 'dark';
  if (savedUI) {
    const parsed = JSON.parse(savedUI);
    theme = parsed.theme || 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
} catch (error) {
  // 忽略 localStorage 读取错误
  document.documentElement.setAttribute('data-theme', 'dark');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
