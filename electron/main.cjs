const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { AgentManager } = require('./agent-manager.cjs')
const db = require('./database.cjs')

let win, mgr

app.whenReady().then(async () => {
  await db.init()

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'AgentRouter',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Agent 随窗口启动自动就绪
  mgr = new AgentManager(win)
  mgr.start()

  // IPC — Agent 执行
  ipcMain.handle('agent:exec', (_e, cmd) => mgr.exec(cmd))
  ipcMain.handle('agent:doctor', () => mgr.doctor())

  // IPC — 数据库
  ipcMain.handle('db:listProjects', () => db.listProjects())
  ipcMain.handle('db:createProject', (_e, name, p) => db.createProject(name, p))
  ipcMain.handle('db:removeProject', (_e, id) => db.removeProject(id))
  ipcMain.handle('db:listSessions', (_e, projectId) => db.listSessions(projectId))
  ipcMain.handle('db:createSession', (_e, projectId, title) => db.createSession(projectId, title))
  ipcMain.handle('db:removeSession', (_e, id) => db.removeSession(id))
  ipcMain.handle('db:renameSession', (_e, id, title) => db.renameSession(id, title))
  ipcMain.handle('db:listMessages', (_e, sessionId) => db.listMessages(sessionId))
  ipcMain.handle('db:addMessage', (_e, sessionId, role, content) => db.addMessage(sessionId, role, content))
  ipcMain.handle('db:listTasks', (_e, projectId, status) => db.listTasks(projectId, status))
  ipcMain.handle('db:addTask', (_e, sessionId, projectId, title) => db.addTask(sessionId, projectId, title))
  ipcMain.handle('db:updateTaskStatus', (_e, id, status) => db.updateTaskStatus(id, status))
  ipcMain.handle('db:archiveTask', (_e, id) => db.archiveTask(id))
})

app.on('window-all-closed', () => {
  if (mgr) mgr.stop()
  app.quit()
})
