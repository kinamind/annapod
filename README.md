# annapod 安娜心训舱

> 面向心理辅导员培训的智能实训平台

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## 项目概述

annapod（安娜心训舱，简称安心舱）是一个基于 AI 的心理辅导员培训平台，通过虚拟来访者模拟、三维知识库和个性化学习路径，帮助心理辅导员在安全的环境中提升专业技能。

### 核心功能

1. **🎭 虚拟来访者模拟** — 基于 [AnnaAgent](https://github.com/sci-m-wang/AnnaAgent) 研究成果，具备三级记忆结构的动态情绪与认知模拟系统
2. **📚 三维知识库** — 按流派×症状/议题×难度三个维度构建的专业知识体系
3. **📈 个性化学习路径** — 针对每位辅导员的表现进行评估，提供成长曲线和定制化学习推荐
4. **🔮 咨访场景预演** — 针对特定咨询场景的对话模拟（Coming Soon）

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui |
| 边缘后端 | Cloudflare Pages advanced mode Worker |
| 数据库 | Cloudflare D1 + Vectorize |
| AI | LLM (OpenAI-compatible API, default `gpt-5-nano`) |
| 部署 | Cloudflare Pages（前端 + `/api/v1/*`） |
| 工具链 | pnpm (Node.js), Wrangler, Git |

## 快速开始

### 前置条件

- Node.js 20+
- pnpm (Node.js 包管理器)
- Cloudflare 账号

### 本地前端开发

```bash
cd apps/web
pnpm install
cp .env.example .env.local  # 编辑配置
pnpm dev
```

### 构建 Cloudflare Pages 输出

```bash
cd apps/web
pnpm build
```

构建完成后会同时生成：

- `out/` 静态前端资源
- `out/_worker.js` Cloudflare Pages advanced mode Worker

## 部署说明

- 当前目标架构为全 Cloudflare 原生方案：
- `apps/web` 构建后直接部署到 Cloudflare Pages。
- `/api/v1/*` 由 Pages advanced mode Worker 处理。
- 活跃咨询会话以 D1 `runtime_state` 形式保存。
- 用户、档案、知识库、学习记录存入 D1。
- 长期记忆检索使用 Vectorize。

Cloudflare 侧还需要手动完成：

1. 创建 D1 数据库
2. 创建 Vectorize index
3. 在 `apps/web/wrangler.jsonc` 中填入真实 `database_id`
4. 配置 `AI_API_KEY`、`JWT_SECRET` 等环境变量
5. 执行 D1 migrations

## 项目结构

```
annapod/
├── apps/
│   ├── api/                  # 旧 FastAPI 后端（迁移参考）
│   └── web/                  # Pages 前端 + Cloudflare 原生后端
│       ├── src/              # Next.js 页面与组件
│       ├── cloudflare/       # Worker / D1 / Vectorize 逻辑与 migrations
│       └── scripts/          # Worker bundling 脚本
├── packages/shared/          # 共享类型与常量
├── data/                     # 数据文件
│   ├── profiles/             # 来访者档案
│   ├── knowledge/            # 知识库源数据
│   └── scales/               # 心理量表
├── docs/                     # 文档
│   ├── api/                  # API 文档
│   └── design/               # 设计文档
└── scripts/                  # 工具脚本
```

## 研究基础

本项目的虚拟来访者模拟系统基于以下研究工作：

> Wang, M., et al. (2025). *AnnaAgent: Dynamic Evolution Agent System with Multi-Session Memory for Realistic Seeker Simulation*. ACL 2025 Findings.
> [[Paper]](https://aclanthology.org/2025.findings-acl.1192.pdf) [[Code]](https://github.com/sci-m-wang/AnnaAgent) [[Dataset]](https://huggingface.co/datasets/sci-m-wang/Anna-CPsyCounD)

当前 Cloudflare 版本做了成本优先的工程化简化：

- 保留 AnnaAgent 的多轮记忆、主诉阶段推进、长期记忆检索思想
- 原项目中依赖专门 SFT 模型的子模块，第一版改为“基础模型 + 规则/启发式控制”
- 先把完整 workflow 跑通，再逐步补强效果

## 贡献者

- **Ming Wang** ([@sci-m-wang](https://github.com/sci-m-wang)) — sci.m.wang@gmail.com
- **Lumen** ([@lumen-coder](https://github.com/lumen-coder)) — lumen@kinamind.org

## 许可证

[Apache License 2.0](LICENSE)
