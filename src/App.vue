<template>
  <div class="layout">
    <!-- ═══ 左侧：项目列表 ═══ -->
    <aside class="sidebar sidebar-left">
      <div class="sidebar-title">
        <span>项目</span>
        <button class="icon-btn" @click="showNewProject = true" title="新建项目">＋</button>
      </div>
      <div class="project-list">
        <div v-for="p in projects" :key="p.id"
          class="project-item"
          :class="{ active: currentProject?.id === p.id }"
          @click="selectProject(p)"
        >
          <span class="project-icon">📁</span>
          <span class="project-name">{{ p.name }}</span>
          <button class="icon-btn small" @click.stop="removeProject(p.id)" title="移除">✕</button>
        </div>
      </div>

      <div v-if="showNewProject" class="dialog-overlay" @click.self="showNewProject = false">
        <div class="dialog">
          <h3>新建项目</h3>
          <input v-model="newProjectName" placeholder="项目名称" />
          <input v-model="newProjectPath" placeholder="文件夹路径" />
          <div class="dialog-actions">
            <button @click="showNewProject = false">取消</button>
            <button @click="createProject" class="primary">创建</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- ═══ 中间：对话区 ═══ -->
    <main class="main">
      <div class="session-tabs" v-if="currentProject">
        <div class="tabs-scroll">
          <button
            v-for="s in sessions" :key="s.id"
            class="tab"
            :class="{ active: currentSession?.id === s.id }"
            @click="selectSession(s)"
          >
            {{ s.title }}
            <span class="tab-close" @click.stop="removeSession(s.id)">✕</span>
          </button>
          <button class="tab new" @click="createSession">＋</button>
        </div>
      </div>

      <div class="messages" ref="msgRef" v-if="currentSession">
        <div v-for="m in messages" :key="m.id" class="msg" :class="m.role">
          <div class="msg-role">{{ { user: '你', agent: 'CodeWhale', system: '系统' }[m.role] }}</div>
          <div class="msg-content">{{ m.content }}</div>
        </div>
      </div>
      <div class="placeholder" v-else>
        {{ currentProject ? '选择或新建一个对话' : '请先选择一个项目' }}
      </div>

      <div class="input-bar" v-if="currentSession">
        <input
          v-model="userInput"
          placeholder="输入命令给 CodeWhale..."
          @keydown.enter="send"
          :disabled="agentStatus !== 'online'"
        />
        <button @click="send" :disabled="agentStatus !== 'online'" class="btn-send">发送</button>
      </div>
      <div class="status-bar">
        <span class="dot" :class="agentStatus"></span>
        <span class="status-text">{{ { online:'就绪', offline:'离线', starting:'启动中' }[agentStatus] }}</span>
        <button @click="doctor" class="btn-mini">诊断</button>
      </div>
    </main>

    <!-- ═══ 右侧：任务列表 ═══ -->
    <aside class="sidebar sidebar-right">
      <div class="sidebar-title"><span>任务</span></div>
      <div class="task-list">
        <div v-for="t in tasks" :key="t.id" class="task-item" :class="t.status">
          <span class="task-icon">{{ { pending:'⏳', running:'🔄', completed:'✅', archived:'📦' }[t.status] }}</span>
          <span class="task-title">{{ t.title }}</span>
          <span class="task-status">{{ { pending:'排队', running:'运行中', completed:'完成', archived:'已归档' }[t.status] }}</span>
        </div>
      </div>
      <div class="placeholder small" v-if="tasks.length === 0">暂无任务</div>
    </aside>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const agent = window.agent
const db = window.db

const projects = ref([])
const sessions = ref([])
const messages = ref([])
const tasks = ref([])
const currentProject = ref(null)
const currentSession = ref(null)
const userInput = ref('')
const agentStatus = ref('offline')
const showNewProject = ref(false)
const newProjectName = ref('')
const newProjectPath = ref('')
const msgRef = ref(null)

// ── 项目 ──

async function loadProjects() {
  projects.value = await db.listProjects()
}

async function selectProject(p) {
  currentProject.value = p
  currentSession.value = null
  messages.value = []
  sessions.value = await db.listSessions(p.id)
  tasks.value = await db.listTasks(p.id)
}

async function createProject() {
  if (!newProjectName.value || !newProjectPath.value) return
  const p = await db.createProject(newProjectName.value, newProjectPath.value)
  projects.value.push(p)
  showNewProject.value = false
  newProjectName.value = ''
  newProjectPath.value = ''
  selectProject(p)
}

async function removeProject(id) {
  await db.removeProject(id)
  if (currentProject.value?.id === id) {
    currentProject.value = null
    currentSession.value = null
    sessions.value = []
    messages.value = []
    tasks.value = []
  }
  await loadProjects()
}

// ── 对话 ──

async function selectSession(s) {
  currentSession.value = s
  messages.value = await db.listMessages(s.id)
  tasks.value = await db.listTasks(currentProject.value.id)
  scrollDown()
}

async function createSession() {
  if (!currentProject.value) return
  const s = await db.createSession(currentProject.value.id, new Date().toLocaleString('zh-CN'))
  sessions.value.unshift(s)
  selectSession(s)
}

async function removeSession(id) {
  await db.removeSession(id)
  sessions.value = sessions.value.filter(s => s.id !== id)
  if (currentSession.value?.id === id) {
    currentSession.value = sessions.value[0] || null
    messages.value = currentSession.value ? await db.listMessages(currentSession.value.id) : []
  }
}

// ── 消息与发送 ──

function scrollDown() {
  nextTick(() => { if (msgRef.value) msgRef.value.scrollTop = msgRef.value.scrollHeight })
}

async function send() {
  const cmd = userInput.value.trim()
  if (!cmd || !currentSession.value) return

  const um = await db.addMessage(currentSession.value.id, 'user', cmd)
  messages.value.push(um)
  userInput.value = ''
  scrollDown()

  let reply = ''
  const cleanup = agent.onOutput((data) => {
    reply += data + '\n'
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'agent') {
      last.content = reply
    } else {
      messages.value.push({ id: 'tmp', role: 'agent', content: reply, timestamp: Date.now() })
    }
    scrollDown()
  })

  agent.exec(cmd)
  await new Promise(r => setTimeout(r, 2000))

  if (reply.trim()) {
    await db.addMessage(currentSession.value.id, 'agent', reply.trim())
  }
  cleanup()
}

// ── 诊断 ──

function doctor() { agent.doctor() }

// ── 生命周期 ──

onMounted(async () => {
  await loadProjects()
  if (agent) {
    agent.onStatus((s) => { agentStatus.value = s })
  }
})
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e; color: #e0e0e0; font-size: 14px; overflow: hidden;
}
.layout { display: flex; height: 100vh; }

/* ── 侧边栏 ── */
.sidebar {
  width: 220px; background: #16213e; display: flex; flex-direction: column;
  border-right: 1px solid #0f3460;
}
.sidebar-right { border-right: none; border-left: 1px solid #0f3460; }
.sidebar-title {
  padding: 10px 12px; font-size: 13px; font-weight: 600;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid #0f3460;
}
.project-list, .task-list { flex: 1; overflow-y: auto; }
.project-item {
  display: flex; align-items: center; gap: 6px; padding: 8px 12px;
  cursor: pointer; font-size: 13px; border-bottom: 1px solid #0f346033;
}
.project-item:hover { background: #0f346066; }
.project-item.active { background: #0f3460; color: #fff; }
.project-icon { font-size: 14px; }
.project-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.task-item {
  display: flex; align-items: center; gap: 6px; padding: 8px 12px;
  font-size: 12px; border-bottom: 1px solid #0f346033; cursor: default;
}
.task-item.completed { opacity: 0.6; }
.task-item.archived { opacity: 0.4; text-decoration: line-through; }
.task-icon { font-size: 12px; }
.task-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-status { font-size: 10px; padding: 1px 6px; border-radius: 8px; background: #0f3460; }
.task-item.running .task-status { background: #e65100; color: #ffe0b2; }
.task-item.completed .task-status { background: #1b5e20; color: #a5d6a7; }

.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

/* ── 标签页 ── */
.session-tabs { background: #16213e; border-bottom: 1px solid #0f3460; padding: 0 8px; }
.tabs-scroll { display: flex; gap: 2px; overflow-x: auto; }
.tab {
  padding: 8px 12px; font-size: 12px; border: none; background: none;
  color: #888; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 4px;
  border-bottom: 2px solid transparent;
}
.tab.active { color: #e94560; border-bottom-color: #e94560; }
.tab.new { color: #e94560; font-size: 16px; }
.tab-close { font-size: 10px; opacity: 0; }
.tab:hover .tab-close { opacity: 0.6; }

/* ── 消息区 ── */
.messages { flex: 1; overflow-y: auto; padding: 12px 16px; }
.msg { margin-bottom: 12px; padding: 10px 14px; border-radius: 8px; max-width: 85%; }
.msg.user { background: #0f3460; margin-left: auto; }
.msg.agent { background: #1a1a3e; border: 1px solid #0f3460; }
.msg-role { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
.msg.user .msg-role { color: #42a5f5; text-align: right; }
.msg.agent .msg-role { color: #66bb6a; }
.msg-content { white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.5; }
.placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: #555; font-size: 14px; }
.placeholder.small { padding: 20px; font-size: 12px; }

/* ── 输入栏 ── */
.input-bar {
  display: flex; gap: 6px; padding: 10px 16px;
  border-top: 1px solid #0f3460; background: #16213e;
}
.input-bar input {
  flex: 1; padding: 8px 12px; border: 1px solid #0f3460;
  border-radius: 6px; background: #1a1a2e; color: #e0e0e0;
  font-size: 14px; outline: none;
}
.input-bar input:focus { border-color: #e94560; }
.btn-send {
  padding: 8px 20px; border: none; border-radius: 6px;
  background: #e94560; color: #fff; font-size: 14px; cursor: pointer;
}
.btn-send:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-send:hover:not(:disabled) { background: #d33650; }

/* ── 底部状态条 ── */
.status-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 16px; font-size: 12px; color: #888;
  background: #0d0d1a; border-top: 1px solid #0f3460;
}
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.online { background: #4caf50; }
.dot.offline { background: #9c27b0; }
.dot.starting { background: #ff9800; }
.btn-mini {
  padding: 2px 10px; border: 1px solid #0f3460; border-radius: 4px;
  background: #16213e; color: #aaa; font-size: 11px; cursor: pointer;
}
.btn-mini:hover { color: #e0e0e0; }

.icon-btn { background: none; border: none; color: #888; font-size: 16px; cursor: pointer; padding: 2px 6px; }
.icon-btn:hover { color: #e94560; }
.icon-btn.small { font-size: 11px; opacity: 0; }
.project-item:hover .icon-btn.small { opacity: 0.6; }

/* ── 弹窗 ── */
.dialog-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100;
}
.dialog {
  background: #16213e; border: 1px solid #0f3460; border-radius: 8px; padding: 20px; width: 400px;
}
.dialog h3 { margin-bottom: 12px; font-size: 16px; }
.dialog input {
  width: 100%; padding: 8px 10px; margin-bottom: 8px; border: 1px solid #0f3460;
  border-radius: 4px; background: #1a1a2e; color: #e0e0e0; font-size: 13px; outline: none;
}
.dialog input:focus { border-color: #e94560; }
.dialog-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
.dialog-actions button {
  padding: 6px 16px; border: 1px solid #0f3460; border-radius: 4px;
  background: #1a1a2e; color: #e0e0e0; cursor: pointer;
}
.dialog-actions button.primary { background: #e94560; border-color: #e94560; color: #fff; }
</style>
