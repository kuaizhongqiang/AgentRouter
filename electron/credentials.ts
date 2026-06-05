/**
 * AgentRouter — 统一凭证管理
 *
 * 存储路径: ~/.agentrouter/credentials.json
 *
 * 所有 Agent CLI 共享同一套 API Key + Base URL，
 * spawn 子进程时由 AgentManager 注入各 CLI 对应的环境变量。
 */
import path from 'path';
import fs from 'fs';
import os from 'os';

const DATA_DIR = path.join(os.homedir(), '.agentrouter');
const CREDENTIALS_PATH = path.join(DATA_DIR, 'credentials.json');

export interface AgentCredentials {
  apiKey: string;
  baseUrl: string;
}

const DEFAULTS: AgentCredentials = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
};

/**
 * 确保数据目录存在
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * 读取凭证
 */
export function getCredentials(): AgentCredentials {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      return { ...DEFAULTS };
    }
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const data = JSON.parse(raw) as Partial<AgentCredentials>;
    return {
      apiKey: data.apiKey ?? DEFAULTS.apiKey,
      baseUrl: data.baseUrl ?? DEFAULTS.baseUrl,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * 保存凭证
 */
export function setCredentials(creds: AgentCredentials): void {
  ensureDataDir();
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), 'utf-8');
}

/**
 * 获取注入子进程的环境变量映射
 * 返回所有 CLI 都能识别的变量名，每个都设为同一个值。
 */
export function getCredentialsEnv(): Record<string, string> {
  const creds = getCredentials();
  const { apiKey, baseUrl } = creds;

  if (!apiKey) return {};

  return {
    // CodeWhale + Reasonix
    DEEPSEEK_API_KEY: apiKey,
    DEEPSEEK_BASE_URL: baseUrl,
    CODEWHALE_MODEL: 'deepseek-v4-flash',
    DEEPSEEK_MODEL: 'deepseek-v4-flash',

    // OpenCode + CodeWhale (OpenAI provider)
    OPENAI_API_KEY: apiKey,
    OPENAI_BASE_URL: baseUrl,
    OPENAI_MODEL: 'deepseek-v4-flash',

    // DeepCode (加 DEEPCODE_ 前缀)
    DEEPCODE_API_KEY: apiKey,
    DEEPCODE_BASE_URL: baseUrl,
    DEEPCODE_MODEL: 'deepseek-v4-flash',
    DEEPCODE_THINKING_ENABLED: 'true',
    DEEPCODE_REASONING_EFFORT: 'max',

    // Cline — 注入通用 + 专用变量
    CLINE_MODEL: 'deepseek-v4-flash',
    ANTHROPIC_API_KEY: apiKey,
    ANTHROPIC_BASE_URL: baseUrl,

    // Continue — 通过 AGENTROUTER_ 前缀统一注入
    CONTINUE_MODEL: 'deepseek/deepseek-chat',

    // 统一凭证（wrapper 层使用）
    AGENTROUTER_API_KEY: apiKey,
    AGENTROUTER_BASE_URL: baseUrl,
    AGENTROUTER_MODEL: 'deepseek-v4-flash',
  };
}
