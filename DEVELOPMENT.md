# 知墟开发流程指南

## 目录

- [项目概述](#项目概述)
- [开发环境准备](#开发环境准备)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [测试策略](#测试策略)
- [部署流程](#部署流程)
- [常见问题](#常见问题)

---

## 项目概述

**知墟 (ZhiXu - AI Code Copilot Observability Platform)** 是一个统一的 AI 编程助手观测与优化平台，支持 Trae、Cursor、Claude Code 等工具的数据采集、监控和自动优化。

### 技术栈

- **后端**: Node.js 18+ / Express / TypeScript
- **数据采集**: OpenTelemetry Collector + 适配器日志扫描
- **数据持久化**: JSON 文件存储（`data/` 目录）+ 防抖延迟写入
- **前端**: React + Vite + TypeScript
- **容器化**: Docker + Docker Compose

---

## 开发环境准备

### 1. 系统要求

- Node.js 18+
- Python 3.10+
- Docker Desktop (可选)
- Git

### 2. 进入项目目录

```bash
cd zhixu-acop
```

### 3. 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 Python 依赖 (可选)
pip install -r requirements.txt
```

### 4. 环境变量配置

复制 `.env.example` 为 `.env` 并根据实际情况修改：

```bash
cp .env.example .env
```

关键配置项：

```env
# OpenTelemetry 配置
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=zhixu-development

# 数据目录（可选，默认 ./data）
DATA_DIR=./data

# 服务端口
PORT=3000
```

### 5. 启动开发服务

```bash
# 启动所有服务 (推荐)
docker-compose up -d

# 仅启动核心服务
npm run dev
```

访问地址：
- 应用面板: http://localhost:3000
- 后端 API: http://localhost:3001
- 前端热重载: http://localhost:3000 (Vite HMR)

---

## 开发流程

### 流程图

```
需求提出 → 设计评审 → 开发实现 → 代码审查 → 测试验证 → 合并发布
   ↑                                                        ↓
   ←──────────────────── 回滚/修复 ←────────────────────────←
```

### 1. 分支管理策略

我们采用 Git Flow 分支模型：

- `main`: 生产环境代码，仅通过 Release 分支合并
- `develop`: 开发主分支，包含下一版本的所有功能
- `feature/*`: 功能分支，从 develop 拉取
- `hotfix/*`: 紧急修复分支，从 main 拉取
- `release/*`: 发布准备分支

### 2. 开发步骤

#### 2.1 创建功能分支

```bash
# 从 develop 创建新功能分支
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

#### 2.2 开发与提交

```bash
# 编写代码...

# 提交代码 (遵循 Conventional Commits)
git add .
git commit -m "feat: 添加新功能描述"
```

提交消息规范：

| 类型 | 说明 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档更新 |
| style | 代码格式调整 |
| refactor | 重构 |
| perf | 性能优化 |
| test | 测试相关 |
| chore | 构建/工具相关 |

#### 2.3 推送分支

```bash
git push origin feature/your-feature-name
```

#### 2.4 代码审查

- 至少 1 人审核通过方可合并
- 所有 CI 检查必须通过
- 必须包含测试用例

#### 2.5 合并与删除分支

```bash
# 合并后自动删除分支
git checkout develop
git pull origin develop
git branch -d feature/your-feature-name
```

---

## 代码规范

### 1. TypeScript / JavaScript 规范

- 使用 ESLint + Prettier
- 遵循 Airbnb JavaScript Style Guide
- 必须声明变量类型

```typescript
// Good
function addNumbers(a: number, b: number): number {
  return a + b;
}

// Bad
function addNumbers(a, b) {
  return a + b;
}
```

### 2. Python 规范 (可选)

- 遵循 PEP 8
- 使用 Black 格式化
- 使用 type hints

### 3. Git 提交规范

每条提交消息必须包含：

1. **类型** (type): 上述规范中的类型
2. **范围** (scope): 涉及模块（可选）
3. **描述** (description): 简短描述

格式：`type(scope): description`

示例：
```
feat(dashboard): 添加 Token 消耗趋势图
fix(collector): 修复 OTLP 连接重试逻辑
docs(readme): 更新安装说明
```

---

## 测试策略

### 1. 测试分层

| 层级 | 说明 | 覆盖率要求 |
|------|------|-----------|
| 单元测试 | 函数/模块级别测试 | ≥ 80% |
| 集成测试 | 模块间交互测试 | ≥ 60% |
| E2E 测试 | 完整业务流程测试 | 核心路径 |

### 2. 运行测试

```bash
# 运行所有测试
npm test

# 单元测试（监听模式）
npm run test:watch

# 测试覆盖率
npm run test:coverage
```

### 3. 测试驱动开发 (TDD)

新功能开发推荐 TDD 流程：

1. 编写失败的测试
2. 编写最小化代码使测试通过
3. 重构代码
4. 重复

---

## 部署流程

### 1. 开发环境部署

```bash
npm run dev
```

### 2. 预发布环境部署

```bash
# 构建镜像
docker build -t zhixu:staging .

# 运行
docker-compose -f docker-compose.staging.yml up -d
```

### 3. 生产环境部署

```bash
# 拉取最新代码
git pull origin main

# 安装依赖
npm install

# 构建
npm run build

# 重启服务
pm2 restart zhixu

# 或使用 Docker
docker-compose pull
docker-compose up -d
```

---

## 常见问题

### Q1: Docker 服务启动失败

```bash
# 检查 Docker 是否运行
docker ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart
```

### Q2: OTEL 数据未采集到

检查步骤：
1. 确认 OTEL_EXPORTER_OTLP_ENDPOINT 配置正确
2. 确认 OpenTelemetry Collector 运行中
3. 检查防火墙是否开放对应端口

### Q3: 如何查看持久化数据？

```bash
# 数据存储在 data/ 目录
ls data/
# events.json    - 事件数据
# rules.json     - 规则配置
# alerts.json    - 告警通道配置
# alerts-history.json - 告警历史记录

# 直接查看内容
cat data/events.json | head -50
```

**确认后即可开始开发！🚀
