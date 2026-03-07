# MindBridge 心桥

> 面向心理辅导员培训的智能实训平台

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## 项目概述

MindBridge（心桥）是一个基于 AI 的心理辅导员培训平台，通过虚拟来访者模拟、三维知识库和个性化学习路径，帮助心理辅导员在安全的环境中提升专业技能。

### 核心功能

1. **🎭 虚拟来访者模拟** — 基于 [AnnaAgent](https://github.com/sci-m-wang/AnnaAgent) 研究成果，具备三级记忆结构的动态情绪与认知模拟系统
2. **📚 三维知识库** — 按流派×症状/议题×难度三个维度构建的专业知识体系
3. **📈 个性化学习路径** — 针对每位辅导员的表现进行评估，提供成长曲线和定制化学习推荐
4. **🔮 咨访场景预演** — 针对特定咨询场景的对话模拟（Coming Soon）

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| 后端 | FastAPI, Python 3.12+, SQLModel |
| 数据库 | PostgreSQL, PGVector |
| AI | Gemini 2.5 Flash (OpenAI-compatible API) |
| 部署 | Google Cloud (Cloud Run + Cloud SQL) |
| 工具链 | uv (Python), pnpm (Node.js), Git |

## 快速开始

### 前置条件

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+ (with pgvector extension)
- uv (Python 包管理器)
- pnpm (Node.js 包管理器)

### 后端

```bash
cd apps/api
uv sync
cp .env.example .env  # 编辑配置
uv run uvicorn app.main:app --reload
```

### 前端

```bash
cd apps/web
pnpm install
cp .env.example .env.local  # 编辑配置
pnpm dev
```

## 项目结构

```
mindbridge/
├── apps/
│   ├── api/                  # FastAPI 后端
│   │   └── app/
│   │       ├── core/         # 配置、安全、依赖
│   │       ├── models/       # 数据库模型 (SQLModel)
│   │       ├── schemas/      # Pydantic 请求/响应模型
│   │       ├── routers/      # API 路由
│   │       ├── services/     # 业务逻辑服务层
│   │       └── modules/      # 功能模块
│   │           ├── simulator/    # 虚拟来访者模拟
│   │           ├── knowledge/    # 三维知识库
│   │           ├── learning/     # 个性化学习路径
│   │           └── preview/      # 咨访场景预演
│   └── web/                  # Next.js 前端
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

## 贡献者

- **Ming Wang** ([@sci-m-wang](https://github.com/sci-m-wang)) — sci.m.wang@gmail.com
- **Lumen** ([@lumen-coder](https://github.com/lumen-coder)) — lumen@kinamind.org

## 许可证

[Apache License 2.0](LICENSE)
