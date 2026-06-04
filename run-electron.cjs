#!/usr/bin/env node
/**
 * Electron 启动包装器
 *
 * VS Code 会设置 ELECTRON_RUN_AS_NODE=1（VS Code 自身是 Electron 应用），
 * Claude Code 在 VS Code 终端中运行时继承了这个环境变量，
 * 导致 Electron 子进程启动时当作普通 Node.js 运行，require('electron') 返回 undefined。
 *
 * 这个包装器在启动 electron 前彻底删除此环境变量。
 */
delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const electron = require('electron');

const child = spawn(electron, process.argv.slice(2), {
  stdio: 'inherit',
  windowsHide: false,
});

child.on('close', (code, signal) => {
  process.exit(code === null ? 1 : code);
});

process.on('SIGINT', () => { if (!child.killed) child.kill('SIGINT'); });
process.on('SIGTERM', () => { if (!child.killed) child.kill('SIGTERM'); });
