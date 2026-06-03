/**
 * AgentRouter — Agent 二进制路径解析
 *
 * 统一处理开发模式与打包后的路径差异。
 * 开发时：从 __dirname 向上回溯到项目根 agents/ 目录
 * 打包后：从 resources/agents/ 目录查找
 */
import path from 'path';

export function resolveAgentPath(...segments: string[]): string {
  // 通过 __dirname 判断是否在 asar 内
  // 开发模式: dist-electron/agents/ -> 项目根/agents/
  // 生产模式: app.asar/dist-electron/agents/ -> resources/agents/
  const inAsar = __dirname.includes('app.asar');
  const base = inAsar
    ? path.join(process.resourcesPath!, 'agents')
    : path.join(__dirname, '..', '..', 'agents');
  return path.join(base, ...segments);
}
