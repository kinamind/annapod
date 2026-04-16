# annapod Web

annapod（安娜心训舱，简称安心舱）现已采用 Cloudflare Pages 全栈部署形态：

- Next.js 16 静态前端
- Pages advanced mode Worker
- D1 `runtime_state` 会话引擎
- D1 + Vectorize 数据层

## 本地开发

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

默认访问 `http://localhost:3000`。

## Cloudflare Pages

项目构建后会输出：

- `out/` 静态页面资源
- `out/_worker.js` Pages Worker 入口

建议的 Pages 设置：

- Root directory: `apps/web`
- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Build output directory: `out`

建议的运行时环境变量：

- `AI_API_KEY`
- `AI_BASE_URL=https://api.deepseek.com`
- `AI_MODEL=deepseek-chat`
- `AI_REASONING_EFFORT=none`
- `JWT_SECRET=<强随机字符串>`

如果你把前后端都放在同一个 Pages 项目里，`NEXT_PUBLIC_API_URL` 可以不填，前端会默认走同域 `/api/v1/*`。

还需要手动完成：

1. 创建 D1 数据库并应用 `cloudflare/migrations/*.sql`
2. 创建 Vectorize index
3. 在 `wrangler.jsonc` 中填入真实 binding ID

## 一次性初始化

建议在 `apps/web` 下执行：

```bash
pnpm cf:bootstrap:db
pnpm cf:bootstrap:vector
pnpm cf:migrate:remote
```

说明：

- `pnpm cf:bootstrap:db` 会返回 D1 数据库 UUID，请把它填入 `wrangler.jsonc` 的 `database_id`
- `pnpm cf:bootstrap:vector` 会创建名为 `annapod-memory` 的 Vectorize index，维度为 `1536`

## Git 集成部署

当前推荐方式是直接使用 Cloudflare Dashboard 的 Git 集成：

1. 在 Cloudflare Pages 中连接 GitHub 仓库 `kinamind/annapod`
2. 每次 push 到 `main` 后由 Cloudflare 自动构建和发布
3. 运行时密钥统一配置在 Pages 项目的 `Settings -> Variables and Secrets`

至少需要配置：

- `AI_API_KEY`
- `JWT_SECRET`

建议同时确认这些普通环境变量：

- `AI_BASE_URL=https://api.deepseek.com`
- `AI_MODEL=deepseek-chat`
- `AI_REASONING_EFFORT=none`
- `EMBEDDING_PROVIDER=openai_compatible`
- `EMBEDDING_BASE_URL=https://api.openai.com/v1`
- `EMBEDDING_MODEL=text-embedding-3-small`
