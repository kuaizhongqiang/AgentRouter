/**
 * Agent Manager — 只做一件事：spawn codewhale exec 并把输出发给渲染进程
 */
const { spawn } = require('child_process')

class AgentManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow
    this.running = false
  }

  /** 启动 — 只是设个标记，不做检查 */
  start() {
    this.running = true
    this.send('status', 'online')
    this.send('output', '[系统] CodeWhale 已就绪')
  }

  /** 停止 */
  stop() {
    this.running = false
    this.send('status', 'offline')
    this.send('output', '[系统] 已停止')
  }

  /** 执行命令 */
  exec(command) {
    if (!this.running) {
      this.send('output', '[系统] 请先启动')
      return
    }
    this.send('output', `> ${command}`)

    const proc = spawn('codewhale', ['exec', '--output-format', 'stream-json', command], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let buf = ''
    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        if (line.trim()) this.send('output', line)
      }
    })
    proc.stderr.on('data', (chunk) => {
      this.send('output', chunk.toString())
    })
    proc.on('error', (err) => {
      this.send('output', `[错误] ${err.message}`)
    })
    proc.on('close', (code) => {
      this.send('output', `[完成] 退出码 ${code}`)
    })
  }

  /** 诊断 */
  doctor() {
    this.send('output', '[诊断] 开始检查...')
    const proc = spawn('codewhale', ['doctor', '--json'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    proc.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n')) {
        if (line.trim()) this.send('output', `  ${line}`)
      }
    })
    proc.on('close', (code) => {
      this.send('output', code === 0 ? '[诊断] ✅ 正常' : `[诊断] ❌ 失败, code=${code}`)
    })
    proc.on('error', (err) => {
      this.send('output', `[诊断] ❌ ${err.message}`)
    })
  }

  send(type, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('agent:' + type, data)
    }
  }
}

module.exports = { AgentManager }
