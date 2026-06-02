/**
 * AgentRouter — Cline CLI NDJSON 包装层
 *
 * 将 Cline CLI (`cline --json --yolo`) 的输出转译为 AgentRouter NDJSON 事件流。
 *
 * 使用方式: node platform.js exec <command>
 *            node platform.js doctor
 *
 * Cline `--json` 输出格式示例:
 *   {"type":"task_started","taskId":"..."}
 *   {"ts":...,"type":"say","say":"text","text":"Hello!","partial":false}
 *   {"ts":...,"type":"say","say":"completion_result","text":"..."}
 *
 * 转译后:
 *   {"protocol_version":"0.2","type":"event","event":"progress","data":{"content":"..."}}
 *   {"protocol_version":"0.2","type":"event","event":"completion","data":{...}}
 */

const { spawn } = require('child_process');

const args = process.argv.slice(2);
const subcommand = args[0];
const command = args.slice(1).join(' ');

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emitEvent(eventType, data) {
  const event = JSON.stringify({
    protocol_version: '0.2',
    id: uid(),
    session_id: process.env.AGENTROUTER_SESSION_ID || '',
    type: 'event',
    event: eventType,
    data: data || {},
    timestamp: new Date().toISOString(),
  });
  process.stdout.write(event + '\n');
}

function runCline(cliArgs) {
  return spawn('cline', cliArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
    shell: process.platform === 'win32',
  });
}

// ── exec: 执行命令 ──
if (subcommand === 'exec') {
  emitEvent('task:start', { message: command });

  const model = process.env.CLINE_MODEL || process.env.AGENTROUTER_MODEL || 'deepseek-v4-flash';

  const proc = runCline(['--json', '--yolo', '--model', model, '--timeout', '180', '--', command]);

  let buf = '';
  let fullText = '';

  proc.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        const topType = parsed.type;

        if (topType === 'agent_event') {
          // agent_event 有多种子类型
          const ev = parsed.event || {};
          const evType = ev.type;
          const contentType = ev.contentType;
          const text = ev.text || '';

          // text / content_start + contentType:text → 正常文本输出
          if (text && (evType === 'content_start' || evType === 'text' || evType === 'content_end')) {
            if (contentType === 'text' || !contentType) {
              fullText += text;
              emitEvent('progress', { content: text, channel: 'default' });
            } else if (contentType === 'reasoning') {
              emitEvent('progress', { content: text, channel: 'reasoning' });
            } else if (contentType === 'error') {
              emitEvent('error', { error: text });
            }
          } else if (evType === 'error') {
            const errMsg = ev.error?.message || ev.error || text || 'Unknown error';
            emitEvent('error', { error: errMsg, recoverable: ev.recoverable });
          }
        } else if (topType === 'say') {
          // say: { say: 'text'|'api_req_started'|'completion_result'|..., text: '...' }
          const sayType = parsed.say || '';
          const text = parsed.text || '';
          if (sayType === 'text' || sayType === 'reasoning') {
            if (text) {
              fullText += text;
              emitEvent('progress', { content: text, channel: sayType === 'reasoning' ? 'reasoning' : 'default' });
            }
          }
        } else if (topType === 'run_result') {
          // run_result: { text: "...", finishReason: "..." }
          const resultText = parsed.text || '';
          if (resultText) {
            fullText += resultText;
          }
          // completion 事件在 close 中统一发出
        } else if (topType === 'error' && parsed.message) {
          emitEvent('error', { error: parsed.message });
        }
        // task_started, api_req_started 等忽略
      } catch {
        // 非 JSON 行
        if (trimmed.length > 0) {
          fullText += trimmed + '\n';
          emitEvent('progress', { content: trimmed, channel: 'default' });
        }
      }
    }
  });

  // stderr 只打日志不转发（避免 ANSI 码污染）
  proc.stderr.on('data', () => {});

  proc.on('error', (err) => {
    emitEvent('error', { error: err.message });
    process.exit(1);
  });

  proc.on('close', (code) => {
    emitEvent('completion', { exitCode: code, summary: fullText.trim() });
    process.exit(0);
  });

// ── doctor: 诊断 ──
} else if (subcommand === 'doctor') {
  const proc = runCline(['--version']);
  let output = '';
  proc.stdout.on('data', (chunk) => { output += chunk.toString(); });
  proc.on('close', () => { process.stdout.write(output.trim()); process.exit(0); });
  proc.on('error', () => { process.exit(1); });

} else {
  console.error(`[ClineWrapper] Unknown subcommand: ${subcommand}`);
  process.exit(1);
}
