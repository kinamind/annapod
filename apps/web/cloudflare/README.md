# annapod Cloudflare Native Backend

这一层是 annapod 的全 Cloudflare 原生后端骨架，目标架构为：

- Cloudflare Pages: 托管静态前端
- Pages advanced mode `_worker.js`: 接管 `/api/v1/*`
- D1: 用户、档案、会话、学习记录、知识库，以及活跃 session 的 `runtime_state`
- Vectorize: 长期记忆向量检索

## 当前实现

- 已保留原有 REST API 路径形状，尽量不改前端
- 模拟器运行态当前以 `D1.runtime_state` 形式保存，保证 Pages advanced mode 可直接部署
- 原始 AnnaAgent 中依赖专门 SFT 模型的子模块，当前先用：
  - 基础模型承担核心回复与会话评估
  - 规则/启发式承担情绪、主诉阶段、初始状态等低成本控制逻辑

这符合当前“优先免费部署、再逐步提升效果”的目标。

## 手动配置

1. 在 Cloudflare 创建 D1 数据库
2. 在 Cloudflare 创建 Vectorize index
3. 在 `wrangler.jsonc` 中填入真实的 `database_id` 与 `index_name`
4. 配置环境变量：

```bash
AI_API_KEY=...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-5-nano
AI_REASONING_EFFORT=none
EMBEDDING_PROVIDER=openai_compatible
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
JWT_SECRET=replace-this-with-a-long-random-secret
```

如果项目是通过 Cloudflare Dashboard 直接连接 GitHub 仓库部署，这些值需要配置在 Pages 项目的 `Variables and Secrets` 中；GitHub repository secrets 不会自动注入到 Pages 运行时。

5. 应用 D1 migrations
6. 在 Cloudflare Pages 中直接连接 GitHub 仓库，使用原生 Git 集成自动部署

## 迁移边界

当前是第一版 Cloudflare 原生骨架，优先完成：

- 统一部署模型
- 数据模型落地
- 前端 API 兼容
- 活跃 session 的 Pages 兼容持久化

后续可继续提升：

- 把知识库检索也接入 Vectorize
- 把状态初始化更多交给基础模型
- 把推荐系统与学习记录做成更完整的闭环
