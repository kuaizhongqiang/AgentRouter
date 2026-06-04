/**
 * AgentRouter — 极简 MCP Server
 *
 * 遵循 MCP (Model Context Protocol) stdio 传输规范，
 * 向 Agent 暴露文件读/写/搜索工具。
 *
 * Reasonix 通过 --mcp "{\"transport\":\"stdio\",\"command\":\"node\",\"args\":[\"dist-electron/mcp/server.js\"]}"
 * 连接到此服务器。
 */
import { stdin, stdout } from 'node:process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

interface McpRequest {
  id: string;
  type: 'tool_request';
  tool: string;
  args: Record<string, unknown>;
}

interface McpResponse {
  id: string;
  type: 'tool_result';
  result: unknown;
  error?: string;
}

// 从 dist-electron/mcp/ 向上 2 层到项目根目录
const projectRoot = path.resolve(__dirname, '..', '..');

const tools = {
  'file.read': async (args: { path?: string }) => {
    const target = path.resolve(args.path || '');
    const content = await readFile(target, 'utf-8');
    return { content, size: content.length };
  },
  'file.write': async (args: { path?: string; content?: string }) => {
    const target = path.resolve(args.path || '');
    await writeFile(target, args.content || '', 'utf-8');
    return { written: true, path: target };
  },
  'file.search': async (args: { pattern?: string; dir?: string }) => {
    const dir = path.resolve(args.dir || '.');
    const files = await readdir(dir, { recursive: true });
    const regex = args.pattern ? new RegExp(args.pattern, 'i') : null;
    const matches = files.filter(f => !regex || regex.test(f));
    return { matches: matches.slice(0, 50), total: matches.length };
  },

  // ── M3: Git 工具 ──

  'git.status': async (args: { cwd?: string }) => {
    const cwd = args.cwd || projectRoot;
    const output = execSync('git status --short', { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const lines = output.split('\n').filter(l => l.trim());
    return { data: lines, count: lines.length };
  },

  'git.log': async (args: { cwd?: string; maxCount?: number }) => {
    const cwd = args.cwd || projectRoot;
    const count = args.maxCount || 20;
    const output = execSync(`git log --oneline -${count}`, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const lines = output.split('\n').filter(l => l.trim());
    return { data: lines, count: lines.length };
  },

  // ── M3: Web 工具 ──

  'web.fetch': async (args: { url?: string }) => {
    const url = args.url || '';
    if (!url) return { data: null, error: 'URL is required' };

    const response = await fetch(url);
    if (!response.ok) return { data: null, error: `HTTP ${response.status}: ${response.statusText}` };

    const text = await response.text();
    // 简单 Markdown 化：保留文本，移除 HTML
    const markdown = text
      // 移除 <script> 块
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // 移除 <style> 块
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // 移除 HTML 标签
      .replace(/<[^>]+>/g, '')
      // 压缩多余空行
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { data: markdown, contentLength: markdown.length, url };
  },

  // ── Phase 7 #36: Wiki 工具（通过 LeafWiki HTTP API）──

  'wiki.read': async (args: { page?: string; wikiHost?: string }) => {
    const host = args.wikiHost || 'http://127.0.0.1:18963';
    const page = args.page || 'index';
    try {
      const res = await fetch(`${host}/api/page/${encodeURIComponent(page)}`);
      if (!res.ok) return { data: null, error: `Wiki page not found (HTTP ${res.status})` };
      const json = await res.json();
      return { data: json.content || '', meta: json.meta };
    } catch (err) {
      return { data: null, error: `Wiki unavailable: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  'wiki.write': async (args: { page?: string; content?: string; wikiHost?: string }) => {
    const host = args.wikiHost || 'http://127.0.0.1:18963';
    const page = args.page || 'index';
    if (!args.content) return { data: null, error: 'content is required' };
    try {
      const res = await fetch(`${host}/api/page/${encodeURIComponent(page)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: args.content }),
      });
      if (!res.ok) return { data: null, error: `Wiki write failed (HTTP ${res.status})` };
      return { written: true, page };
    } catch (err) {
      return { data: null, error: `Wiki unavailable: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  'wiki.search': async (args: { query?: string; wikiHost?: string }) => {
    const host = args.wikiHost || 'http://127.0.0.1:18963';
    try {
      const q = args.query || '';
      const res = await fetch(`${host}/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return { data: null, error: `Wiki search failed (HTTP ${res.status})` };
      const json = await res.json();
      return { matches: json.results || [], total: json.total || 0 };
    } catch (err) {
      return { data: null, error: `Wiki unavailable: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  'wiki.list': async (args: { wikiHost?: string }) => {
    const host = args.wikiHost || 'http://127.0.0.1:18963';
    try {
      const res = await fetch(`${host}/api/pages`);
      if (!res.ok) return { data: null, error: `Wiki list failed (HTTP ${res.status})` };
      const json = await res.json();
      return { pages: json.pages || [], total: json.total || 0 };
    } catch (err) {
      return { data: null, error: `Wiki unavailable: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

function respond(res: McpResponse): void {
  stdout.write(JSON.stringify(res) + '\n');
}

let buf = '';
stdin.on('data', (chunk: Buffer) => {
  buf += chunk.toString();
  const lines = buf.split('\n');
  buf = lines.pop() || '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const req: McpRequest = JSON.parse(trimmed);
      if (req.type !== 'tool_request' || !tools[req.tool as keyof typeof tools]) {
        respond({ id: req.id, type: 'tool_result', result: null, error: `Unknown tool: ${req.tool}` });
        continue;
      }

      tools[req.tool as keyof typeof tools](req.args)
        .then(result => respond({ id: req.id, type: 'tool_result', result }))
        .catch(err => respond({ id: req.id, type: 'tool_result', result: null, error: err.message }));
    } catch {
      // Non-JSON or protocol handshake — ignore
    }
  }
});

// 通知平台 MCP Server 已就绪
console.log('[MCP] Server ready — tools: file.read, file.write, file.search, git.status, git.log, web.fetch');
