/**
 * AgentRouter — LeafWiki 包装层 (platform.cjs)
 *
 * LeafWiki 是一个轻量 Markdown Wiki，提供 HTTP API。
 * 本包装层负责管理 LeafWiki 子进程生命周期。
 *
 * 使用方式：
 *   启动：node platform.cjs start --port <port> --data-dir <dir>
 *   停止：node platform.cjs stop
 *   状态：node platform.cjs status
 *
 * LeafWiki 不打包进仓库，首次使用引导用户下载。
 * 包装层检测到二进制不存在时返回友好的错误提示。
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const BINARY_NAME = process.platform === 'win32' ? 'leafwiki.exe' : 'leafwiki';
const BINARY_PATH = path.join(__dirname, BINARY_NAME);
const DEFAULT_PORT = 18963;

function findBinary() {
  // 1) 优先包装层同目录
  if (fs.existsSync(BINARY_PATH)) return BINARY_PATH;
  // 2) 环境变量指定
  if (process.env.LEAFWIKI_BIN && fs.existsSync(process.env.LEAFWIKI_BIN)) return process.env.LEAFWIKI_BIN;
  // 3) PATH 中查找
  try {
    const which = require('child_process').execSync(`where ${BINARY_NAME} 2>nul || which ${BINARY_NAME} 2>/dev/null`, { encoding: 'utf-8' }).trim();
    if (which) return which;
  } catch { /* not found */ }
  return null;
}

function startWiki(port, dataDir) {
  const bin = findBinary();
  if (!bin) {
    console.error('[LeafWiki] Binary not found. Please download LeafWiki from https://github.com/perber/leafwiki');
    process.exit(1);
  }

  const args = [`--port=${port || DEFAULT_PORT}`];
  if (dataDir) args.push(`--data-dir=${dataDir}`);

  const proc = spawn(bin, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  proc.stdout.on('data', (chunk) => {
    process.stdout.write(`[LeafWiki] ${chunk}`);
  });

  proc.stderr.on('data', (chunk) => {
    process.stderr.write(`[LeafWiki] ${chunk}`);
  });

  proc.on('exit', (code) => {
    console.log(`[LeafWiki] Process exited with code ${code}`);
    process.exit(code);
  });

  // 不阻塞 — 子进程持续运行
  proc.unref();
}

// Only run command dispatch when called directly (not when required)
if (require.main === module) {
  const cmd = process.argv[2];
  const port = parseInt(process.argv[3], 10) || DEFAULT_PORT;
  const dataDir = process.argv[4];

  switch (cmd) {
    case 'start':
      startWiki(port, dataDir);
      break;
    case 'doctor':
      // LeafWiki 健康检查：请求 /health 端点
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('[LeafWiki] Healthy');
          process.exit(0);
        } else {
          console.error(`[LeafWiki] Unhealthy: HTTP ${res.statusCode}`);
          process.exit(1);
        }
      });
      req.on('error', (err) => {
        console.error(`[LeafWiki] Health check failed: ${err.message}`);
        process.exit(1);
      });
      req.setTimeout(3000, () => {
        req.destroy();
        console.error('[LeafWiki] Health check timeout');
        process.exit(1);
      });
      break;
    default:
      console.log(`Usage: node platform.cjs <start|doctor> [port] [data-dir]`);
      process.exit(1);
  }
}
