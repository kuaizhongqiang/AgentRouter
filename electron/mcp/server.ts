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
console.log('[MCP] Server ready — tools: file.read, file.write, file.search');
