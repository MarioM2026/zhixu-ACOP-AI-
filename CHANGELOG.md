# 知墟变更日志

所有重要变更都会在此文件中记录。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
本项目遵循 [语义化版本（Semantic Versioning）](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增
- 待补充

### 更改
- 待补充

### 修复
- 待补充

### 废弃
- 待补充

---

## [1.0.0] - 2026-06-15

### ✨ 新增功能

- **OTEL 数据采集**：支持从 Trae、Cursor、Claude Code 等 AI 编程助手采集运行数据
- **统一监控看板**：提供可视化仪表盘，展示 Token 消耗、响应延迟、错误率等关键指标
- **告警系统**：支持钉钉、飞书、邮件等多渠道告警通知
- **规则引擎**：支持自定义规则，自动检测和响应异常情况
- **数据导出**：支持 CSV、JSON 格式的数据导出
- **API 接口**：提供完整的 RESTful API，支持第三方集成

### 🔧 技术实现

- 前端：React 18 + TypeScript + Vite
- 后端：Node.js + Express + TypeScript
- 数据存储：SQLite（开发环境）/ PostgreSQL（生产环境）
- 监控：OpenTelemetry + Grafana + Prometheus
- 容器化：Docker + Docker Compose
- CI/CD：GitHub Actions

### 📖 文档

- `README.md`：项目简介、快速开始、功能特性
- `DEVELOPMENT.md`：开发环境准备、分支管理、代码规范
- `IMPLEMENTATION_GUIDE.md`：详细开发与落地流程
- `CONTRIBUTING.md`：贡献指南、PR 流程规范
- `API.md`：API 接口文档

### ✅ 测试覆盖

- 单元测试：≥ 80%
- 集成测试：≥ 60%
- E2E 测试：核心路径 100%

### 🚀 部署支持

- Docker Compose 一键部署
- 支持 Linux / macOS / Windows 平台
- 详细部署文档和配置说明

---

## [0.1.0] - 2026-06-01

### ✨ 原型版本

- 项目初始化和基础架构
- 简单的 OTEL 数据采集原型
- 基础前端界面原型
- 数据库结构设计

---

## 版本号说明

- **主版本号（Major）**：不兼容的 API 变更
- **次版本号（Minor）**：向后兼容的功能性新增
- **修订号（Patch）**：向后兼容的问题修正

### 发布频率

- 主要版本：每年 1-2 次重大版本
- 次要版本：每月 1 次功能更新
- 修订版本：根据 bug 修复需求随时发布

---

## 贡献者

感谢以下贡献者对知墟项目的支持：

- 知墟开发团队

---

## 联系方式

- 项目仓库：https://github.com/MarioM2026/zhixu-ACOP-AI
- 问题反馈：https://github.com/MarioM2026/zhixu-ACOP-AI/issues
- 文档地址：https://github.com/MarioM2026/zhixu-ACOP-AI/wiki

---

**最后更新日期**：2026年6月15日
