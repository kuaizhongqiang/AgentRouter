const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('agent', {
  exec: (cmd) => ipcRenderer.invoke('agent:exec', cmd),
  doctor: () => ipcRenderer.invoke('agent:doctor'),

  onOutput: (fn) => {
    const h = (_e, d) => fn(d)
    ipcRenderer.on('agent:output', h)
    return () => ipcRenderer.removeListener('agent:output', h)
  },
  onStatus: (fn) => {
    const h = (_e, s) => fn(s)
    ipcRenderer.on('agent:status', h)
    return () => ipcRenderer.removeListener('agent:status', h)
  },
})

contextBridge.exposeInMainWorld('db', {
  listProjects: () => ipcRenderer.invoke('db:listProjects'),
  createProject: (name, path) => ipcRenderer.invoke('db:createProject', name, path),
  removeProject: (id) => ipcRenderer.invoke('db:removeProject', id),
  listSessions: (projectId) => ipcRenderer.invoke('db:listSessions', projectId),
  createSession: (projectId, title) => ipcRenderer.invoke('db:createSession', projectId, title),
  removeSession: (id) => ipcRenderer.invoke('db:removeSession', id),
  renameSession: (id, title) => ipcRenderer.invoke('db:renameSession', id, title),
  listMessages: (sessionId) => ipcRenderer.invoke('db:listMessages', sessionId),
  addMessage: (sessionId, role, content) => ipcRenderer.invoke('db:addMessage', sessionId, role, content),
  listTasks: (projectId, status) => ipcRenderer.invoke('db:listTasks', projectId, status),
  addTask: (sessionId, projectId, title) => ipcRenderer.invoke('db:addTask', sessionId, projectId, title),
  updateTaskStatus: (id, status) => ipcRenderer.invoke('db:updateTaskStatus', id, status),
  archiveTask: (id) => ipcRenderer.invoke('db:archiveTask', id),
})
