/**
 * AgentRouter CLI — 凭证管理命令
 *
 * 子命令:
 *   show             查看当前凭证状态
 *   set --key <key>  保存 API Key（可选 --url）
 *   test             检查凭证有效性
 */
import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

export default async function handler(args, options) {
  const subcommand = args[0] || 'show';

  try {
    switch (subcommand) {
      case 'show':
        return cmdShow();
      case 'set':
        return cmdSet(options);
      case 'test':
        return cmdTest();
      default:
        output.fatal(`未知子命令: ${subcommand}\n用法: ar credential show|set|test`);
    }
  } catch (err) {
    output.fatal(err.message);
  }
}

function cmdShow() {
  const { credentials } = getModules();
  const creds = credentials.getCredentials();

  if (output.isJsonMode()) {
    output.json(creds);
    return;
  }

  const maskedKey = creds.apiKey
    ? creds.apiKey.slice(0, 4) + '...' + creds.apiKey.slice(-4)
    : '(未设置)';

  output.kv('API Key', maskedKey);
  output.kv('Base URL', creds.baseUrl || '(未设置)');
  output.kv('Model', 'deepseek-v4-flash');
}

function cmdSet(options) {
  const { credentials } = getModules();
  const apiKey = options.key || options.k;
  if (!apiKey) {
    output.fatal('请提供 --key <apiKey>');
  }

  const existing = credentials.getCredentials();
  const baseUrl = options.url || options.u || existing.baseUrl;

  credentials.setCredentials({ apiKey, baseUrl });
  output.success('凭证已保存');
}

function cmdTest() {
  const { credentials } = getModules();
  const creds = credentials.getCredentials();

  if (!creds.apiKey) {
    output.error('API Key 未设置');
    return;
  }

  if (creds.apiKey.length < 8) {
    output.error('API Key 格式不正确（长度过短）');
    return;
  }

  // 合理的 API Key 通常以 sk- 开头
  if (creds.apiKey.startsWith('sk-') || creds.apiKey.length >= 20) {
    output.success('API Key 格式检查通过');
  } else {
    output.warn('API Key 可能格式不正确（不以 sk- 开头且长度较短）');
  }

  output.kv('Base URL', creds.baseUrl);
}
