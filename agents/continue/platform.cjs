/**
 * AgentRouter — Continue CLI NDJSON 包装层
 *
 * 将 Continue CLI (`cn -p --format json --silent`) 的输出转译为 AgentRouter NDJSON 事件流。
 *
 * 使用方式: node platform.js exec <command>
 *            node platform.js doctor
 *
 * Continue headless JSON 输出格式:
 *   {"response":"...","status":"success"}
 *   {"status":"error","message":"..."}
 *
 * 转译后的 NDJSON:
 *   {"protocol_version":"0.2","type":"event","event":"task:start","data":{...}}
 *   {"protocol_version":"0.2","type":"event","event":"progress","data":{...}}
 *   {"protocol_version":"0.2","type":"event","event":"completion","data":{...}}
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

/**
 * 生成临时 Continue 配置文件，使用统一凭证中的 API Key 和 Base URL。
 * Continue 默认从 ~/.continue/config.yaml 读取配置，
 * 我们通过 --config 指向临时生成的文件。
 */
function ensureTempConfig() {
  const apiKey = process.env.AGENTROUTER_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseUrl = process.env.AGENTROUTER_BASE_URL || process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.CONTINUE_MODEL || process.env.AGENTROUTER_MODEL || 'deepseek/deepseek-chat';

  if (!apiKey) return null;

  const configDir = path.join(os.homedir(), '.agentrouter', 'continue-temp');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configPath = path.join(configDir, 'config.yaml');
  const configContent = `experimental: { inline_diffs: true }
models:
  - title: DeepSeek
    provider: deepseek
    model: ${model}
    apiKey: ${apiKey}
    apiBase: ${baseUrl}
`;
  fs.writeFileSync(configPath, configContent, 'utf-8');
  return configPath;
}

function runContinue(cliArgs) {
  return spawn('cn', cliArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
    shell: process.platform === 'win32',
  });
}

// ── exec: 执行命令 ──
if (subcommand === 'exec') {
  emitEvent('task:start', { message: command });

  // 生成临时配置文件（如凭证已配置）
  const configPath = ensureTempConfig();

  // 构造 cn 参数
  const cnArgs = ['-p', command, '--format', 'json', '--silent', '--auto', '--verbose'];
  if (configPath) {
    cnArgs.push('--config', configPath);
  }

  const proc = runContinue(cnArgs);

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

        if (parsed.status === 'success') {
          const response = parsed.response || '';
          fullText += response;
          if (response) {
            emitEvent('progress', { content: response, channel: 'default' });
          }
        } else if (parsed.status === 'info' || parsed.status === 'warning') {
          const msg = parsed.message || '';
          if (msg) {
            emitEvent('progress', { content: msg, channel: 'default' });
          }
        } else if (parsed.status === 'error') {
          emitEvent('error', { error: parsed.message || 'Unknown error' });
        }
      } catch {
        // 非 JSON 行 — 可能是进度日志，过滤不转发
      }
    }
  });

  // stderr — 可能有额外的 JSON 输出
  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    // Continue 有时在 stderr 输出 JSON
    try {
      const parsed = JSON.parse(text.trim());
      if (parsed.status === 'success') {
        const response = parsed.response || '';
        fullText += response;
        if (response) {
          emitEvent('progress', { content: response, channel: 'default' });
        }
      } else if (parsed.status === 'error') {
        emitEvent('error', { error: parsed.message || 'Unknown error' });
      }
    } catch {
      // 忽略非 JSON 的 stderr（如日志级别信息）
    }
  });

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
  const proc = runContinue(['--version']);
  let output = '';
  proc.stdout.on('data', (chunk) => { output += chunk.toString(); });
  proc.on('close', () => { process.stdout.write(output.trim()); process.exit(0); });
  proc.on('error', () => { process.exit(1); });

} else {
  console.error(`[ContinueWrapper] Unknown subcommand: ${subcommand}`);
  process.exit(1);
}
