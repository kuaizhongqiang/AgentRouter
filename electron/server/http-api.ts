/**
 * AgentRouter — HTTP API Server (Phase B C/S 模式)
 *
 * 在 Electron 主进程中启动 HTTP 服务器，
 * 让远程 CLI/Web/移动端通过 REST API 调用后端能力。
 *
 * 默认端口: 18080（避开常见冲突）
 * 鉴权: Authorization: Bearer <token>
 *
 * 无外部依赖，使用 Node.js 内置 http 模块。
 */
import http from 'http';
import crypto from 'crypto';
import type { AgentManager } from '../agents/manager';

// ── 类型 ──

interface ApiConfig {
  port: number;
  token: string;
}

interface ApiContext {
  manager: AgentManager | null;
}

// ── 默认配置 ──

const DEFAULT_CONFIG: ApiConfig = {
  port: parseInt(process.env.AGENTROUTER_API_PORT || '18080', 10),
  token: process.env.AGENTROUTER_API_TOKEN || '',
};

// 如果没配置 token，自动生成一个
if (!DEFAULT_CONFIG.token) {
  DEFAULT_CONFIG.token = crypto.randomBytes(16).toString('hex');
  console.log(`[API] Auto-generated API token: ${DEFAULT_CONFIG.token}`);
}

// ── 路由表 ──

type RouteHandler = (body: any, ctx: ApiContext) => Promise<any>;

interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: RegExp;
  handler: RouteHandler;
}

// ── 请求解析 ──

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      resolve(null);
      return;
    }
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

// ── Token 验证 ──

function checkAuth(req: http.IncomingMessage, config: ApiConfig): boolean {
  if (!config.token) return true; // 无 token 时跳过鉴权（开发模式）
  const auth = req.headers['authorization'] || '';
  return auth === `Bearer ${config.token}`;
}

// ── 服务器创建 ──

export function createApiServer(
  manager: AgentManager | null,
  config: Partial<ApiConfig> = {}
): http.Server {
  const cfg: ApiConfig = { ...DEFAULT_CONFIG, ...config };
  const ctx: ApiContext = { manager };

  const routes: Route[] = [
    // ── 系统 ──
    { method: 'GET', path: /^\/api\/status$/, handler: async () => {
      const agents = ctx.manager?.listWithHealth() || [];
      return {
        status: 'online',
        agents: agents.map(a => ({
          name: a.name, label: a.label,
          healthy: a.health?.healthy ?? false,
          status: a.health?.status ?? 'untested',
        })),
        version: '0.1.0',
      };
    }},

    // ── Agent ──
    { method: 'GET', path: /^\/api\/agents$/, handler: async () => {
      return ctx.manager?.listWithHealth() || [];
    }},

    { method: 'POST', path: /^\/api\/exec$/, handler: async (body) => {
      if (!ctx.manager) throw new Error('Manager not ready');
      if (!body?.agent || !body?.command) throw new Error('Missing agent or command');
      const { agent, command, sessionId, projectId, cwd, mode } = body;
      const logId = await ctx.manager.exec(agent, command, sessionId || 'remote', projectId || 'remote', cwd, mode);
      return { logId, agent, status: 'executed' };
    }},

    { method: 'POST', path: /^\/api\/doctor$/, handler: async (body) => {
      if (!ctx.manager) throw new Error('Manager not ready');
      if (body?.agent) {
        const result = await ctx.manager.doctor(body.agent);
        return { agent: body.agent, result };
      }
      const results = await ctx.manager.checkAllAgentsHealth();
      return { results };
    }},

    { method: 'POST', path: /^\/api\/kill$/, handler: async (body) => {
      ctx.manager?.kill(body?.agent);
      return { killed: true, agent: body?.agent || 'all' };
    }},

    // ── 健康 ──
    { method: 'GET', path: /^\/api\/health$/, handler: async () => {
      return { ok: true, timestamp: new Date().toISOString() };
    }},

    // ─️ Token 信息 ──
    { method: 'GET', path: /^\/api\/token-info$/, handler: async () => {
      return { tokenConfigured: !!cfg.token };
    }},
  ];

  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 鉴权（/api/health 和 /api/token-info 例外）
    if (!req.url?.startsWith('/api/health') && !req.url?.startsWith('/api/token-info')) {
      if (!checkAuth(req, cfg)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', message: '需要有效的 Authorization: Bearer <token>' }));
        return;
      }
    }

    // 路由匹配
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    let matched = false;
    for (const route of routes) {
      if (route.method === req.method && route.path.test(pathname)) {
        matched = true;
        try {
          const body = await parseBody(req);
          const result = await route.handler(body, ctx);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        break;
      }
    }

    if (!matched) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', path: pathname }));
    }
  });

  return server;
}

/**
 * 启动 API 服务器
 */
export function startApiServer(manager: AgentManager | null, config?: Partial<ApiConfig>): http.Server {
  const server = createApiServer(manager, config);
  const port = config?.port || DEFAULT_CONFIG.port;

  server.listen(port, () => {
    console.log(`[API] HTTP API Server started on port ${port}`);
    console.log(`[API] Token: ${config?.token || DEFAULT_CONFIG.token}`);
    console.log(`[API] Endpoints:`);
    console.log(`[API]   GET  /api/status`);
    console.log(`[API]   GET  /api/agents`);
    console.log(`[API]   POST /api/exec`);
    console.log(`[API]   POST /api/doctor`);
    console.log(`[API]   POST /api/kill`);
    console.log(`[API]   GET  /api/health`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[API] Port ${port} already in use, API server disabled`);
    } else {
      console.error(`[API] Server error:`, err.message);
    }
  });

  return server;
}
