/**
 * AgentRouter CLI — 参数解析器
 *
 * 极简参数解析，无外部依赖。
 * 支持: ar <command> [subcommand] [args...] [--flags]
 *
 * 格式:
 *   ar exec codewhale "指令" --mode "PM 拆解" --json
 *   ar project list --json
 *   ar --help
 */
export function parseArgs(argv) {
  // argv = process.argv.slice(2)
  const args = argv.slice();
  const options = {};
  const positional = [];

  // 解析 --name value 或 --name=value 或 -f
  let i = 0;
  while (i < args.length) {
    const a = args[i];

    if (a === '--') {
      // -- 之后全是 positional
      positional.push(...args.slice(i + 1));
      break;
    }

    if (a.startsWith('--')) {
      const eqIdx = a.indexOf('=');
      if (eqIdx > 0) {
        // --name=value
        const name = a.slice(2, eqIdx);
        const value = a.slice(eqIdx + 1);
        options[name] = coerceValue(value);
      } else {
        const name = a.slice(2);
        // 看下一个参数是否为值（不以 -- 开头）
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          i++;
          options[name] = coerceValue(args[i]);
        } else {
          options[name] = true; // boolean flag
        }
      }
      i++;
      continue;
    }

    if (a.startsWith('-') && a.length === 2 && !a.startsWith('--')) {
      // -f style short flag
      const name = a.slice(1);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        i++;
        options[name] = coerceValue(args[i]);
      } else {
        options[name] = true;
      }
      i++;
      continue;
    }

    positional.push(a);
    i++;
  }

  return { positional, options };
}

function coerceValue(v) {
  if (v === 'true' || v === 'yes') return true;
  if (v === 'false' || v === 'no') return false;
  if (v === 'null') return null;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  if (/^\d+\.\d+$/.test(v)) return parseFloat(v);
  return v;
}

/**
 * 帮助文本生成
 */
export function getHelp(command, subcommand) {
  // 全局帮助
  if (!command) {
    return `
AgentRouter CLI — 桌面端的终端等价物

用法: ar <command> [subcommand] [args...] [options]

核心命令:
  exec <agent> <指令>      执行 Agent 指令
  fix|feat|review|refactor  快捷场景（等价 exec）
  |doc|goal

编译与测试:
  build                    编译 dist-electron/
  build --frontend         构建前端
  build --all              全量构建
  build --agent <name>     构建指定 Agent
  test run [flags]         运行测试
  test list                列出测试文件

Agent 管理:
  agent list               列出 Agent 及其健康状态
  agent info <name>        查看 Agent 详情
  agent disable <name>     禁用 Agent
  agent enable <name>      启用 Agent
  doctor [agent]           诊断 Agent 健康
  kill [agent]             终止运行中的 Agent

项目管理:
  project list             列出项目
  project create <name> <path>  创建项目
  project use <id>         选择当前项目
  project show <id>        查看项目详情
  project rm <id>          删除项目
  project config           配置操作

会话管理:
  session list <project>   列出会话
  session create <project> 创建会话
  session show <id>        查看会话
  session rename <id> <title>  重命名
  session rm <id>          删除会话

任务与消息:
  task list <project>      列出任务
  task show <id>           查看任务详情
  task approve <session>   批准计划
  msg list <session>       查看消息历史

系统:
  status                   全局状态概览
  credential show|set      凭证管理
  token usage|stats        Token 用量
  memory list|get|set|rm   记忆操作
  replay <session>         Session 回放
  log <agent>              查看 Agent 日志
  db <sql>                 直接查询数据库
  git diff|log|status      Git 操作
  diag                     深度诊断
  env                      环境信息
  clean                    清理构建产物
  watch                    监听文件变化
  version                  显示版本
  help [command]           显示帮助

全局选项:
  --json                   JSON 格式输出
  --quiet                  静默模式
  --project <id>           指定项目上下文
  --yes                    自动确认
  -h, --help               显示帮助

示例:
  ar exec codewhale "修复登录页 Bug"
  ar review src/auth/login.ts
  ar doctor --all
  ar status --json
`;
  }

  // 子命令帮助
  if (command === 'exec') {
    return `
用法: ar exec <agent> <指令> [options]

参数:
  agent     Agent 名称 (codewhale, reasonix, deepcode, opencode, cline, continue)
  command   要执行的指令文本

选项:
  --mode    执行模式 (对话|PM 拆解|YOLO|审批|逐步|预览|代码审查)
  --session 指定会话 ID（默认自动创建）
  --project 指定项目 ID
  --json    JSON 格式输出
  --quiet   静默模式

示例:
  ar exec codewhale "修复登录页 Bug"
  ar exec reasonix "设计权限系统" --mode "PM 拆解" --json
`;
  }

  if (command === 'build') {
    return `
用法: ar build [options]

编译 AgentRouter 后端/前端模块。

选项:
  --frontend      仅构建 Vite 前端
  --all           全量构建（electron + frontend）
  --agent <name>  构建指定 Agent 二进制
  --list          列出可构建的 Agent
  --json          JSON 格式输出

示例:
  ar build                 编译 dist-electron/
  ar build --frontend      构建前端
  ar build --all           全量构建
  ar build --agent codewhale  构建 CodeWhale
  ar build --list          查看 Agent 构建状态
`;
  }

  if (command === 'test') {
    return `
用法: ar test <subcommand> [options]

子命令:
  run [file]      运行测试
  list            列出测试文件

选项:
  --cli           运行 CLI 测试
  --phase7        运行 Phase 7 测试
  --smoke         运行 Smoke 测试
  --runtime       运行 Runtime 测试
  --json          JSON 格式输出

示例:
  ar test list                列出所有测试
  ar test run                 运行全部测试
  ar test run --cli           运行 CLI 测试
  ar test run --phase7        运行 Phase 7 测试
`;
  }

  return `用法: ar ${command} [subcommand] [args...]\n输入 ar help 查看所有命令。`;
}
