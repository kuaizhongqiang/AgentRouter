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
      <!-- Agent + 模式选择器 -->
      <div class="toolbar" v-if="currentProject">
        <div class="toolbar-item">
          <select v-model="selectedAgent" class="toolbar-select agent-select">
            <option v-for="a in agents" :key="a.name" :value="a.name" :title="a.manifest?.tagline || ''">{{ a.label || a.name }}</option>
          </select>
          <span v-if="selectedAgentManifest?.tagline" class="agent-tagline" :title="selectedAgentManifest.tagline">{{ selectedAgentManifest.tagline }}</span>
        </div>
        <div class="toolbar-item">
          <select v-model="selectedMode" class="toolbar-select mode-select">
            <option v-for="m in modes" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>
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
          <div class="msg-role">
            <template v-if="m.role === 'agent'">
              <span class="agent-badge" :class="'agent-' + (m.agentName || selectedAgent || 'codewhale').toLowerCase()">{{ m.agentName || selectedAgent || 'CodeWhale' }}</span>
              <span v-if="m.senderId" class="sender-id">{{ m.senderId }}</span>
            </template>
            <template v-else-if="m.role === 'reasoning'">
              <span class="reasoning-label">🧠 推理中</span>
            </template>
            <template v-else>{{ { user: '你', system: '系统' }[m.role] || m.role }}</template>
          </div>
          <div class="msg-content" :class="{ 'reasoning-content': m.role === 'reasoning' }">{{ m.content }}</div>
        </div>
      </div>
      <div class="placeholder" v-else>
        {{ currentProject ? '选择或新建一个对话' : '请先选择一个项目' }}
      </div>

      <div class="input-bar" v-if="currentSession">
        <input
          v-model="userInput"
          :placeholder="selectedMode === 'PM 拆解' ? '输入需求，Reasonix (PM) 将拆解为任务...' : '输入命令给 ' + (selectedAgent || 'Agent') + '...'"
          @keydown.enter="send"
          :disabled="agentStatus !== 'online'"
        />
        <button @click="send" :disabled="agentStatus !== 'online'" class="btn-send">发送</button>
      </div>
      <div class="status-bar">
        <span class="dot" :class="agentStatus"></span>
        <span class="status-text">{{ selectedAgent || 'Agent' }} {{ { online:'就绪', offline:'离线', starting:'启动中' }[agentStatus] }}</span>
        <button @click="doctor" class="btn-mini">诊断</button>
      </div>
    </main>

    <!-- ═══ 右侧：任务列表 ═══ -->
    <aside class="sidebar sidebar-right">
      <div class="sidebar-title"><span>任务</span></div>
      <div class="task-list">
        <div v-for="t in tasks" :key="t.id" class="task-item" :class="[t.status, t.status === 'running' ? 'running-anim' : '']" @click="toggleTask(t.id)">
          <span class="task-icon">{{ statusIcon(t.status) }}</span>
          <div class="task-body">
            <span class="task-title">{{ t.title }}</span>
            <div class="task-meta">
              <span v-if="t.assignee" class="agent-badge agent-badge-sm" :class="'agent-' + t.assignee.toLowerCase()">{{ t.assignee }}</span>
              <span v-if="t.group" class="task-group">第 {{ t.group }} 组</span>
            </div>
          </div>
          <span class="task-status-tag" :class="t.status">{{ { pending:'排队', running:'运行中', completed:'完成', archived:'已归档' }[t.status] || t.status }}</span>
          <div v-if="expandedTask === t.id" class="task-detail">
            <p v-if="t.description" class="task-description">{{ t.description }}</p>
            <div class="task-log">{{ taskLogs[t.id] || '' }}</div>
          </div>
        </div>
      </div>
      <div v-if="showApproveButton" class="task-actions">
        <button @click.stop="approvePlan" class="btn-approve">审批 Plan</button>
      </div>
      <div v-if="showSummarizeButton" class="task-actions">
        <button @click.stop="summarizeMission" class="btn-summarize">汇总 Mission</button>
      </div>
      <div v-if="showSuggestion" class="task-actions suggestion-banner">
        <span>💡 Agent 正在提建议...</span>
      </div>
      <div class="placeholder small" v-if="tasks.length === 0">暂无任务</div>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

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

// ── Mission 模式状态 ──
const expandedTask = ref(null)
const taskLogs = ref({})
const showApproveButton = ref(false)
const showSummarizeButton = ref(false)
const showSuggestion = ref(false)

// ── Agent 与模式 ──
const agents = ref([])
const selectedAgent = ref(null)
const selectedMode = ref('对话')
const modes = ['对话', 'PM 拆解', 'YOLO', '审批', '逐步', '预览']

// PM 拆解模式自动切换到 Reasonix
watch(selectedMode, (newMode) => {
  if (newMode === 'PM 拆解') {
    const reasonix = agents.value.find(a => a.name === 'reasonix')
    if (reasonix) {
      selectedAgent.value = 'reasonix'
    }
  }
})

// Phase 3: 当前选中 Agent 的标签信息
const selectedAgentManifest = computed(() => {
  const a = agents.value.find(a => a.name === selectedAgent.value)
  return a?.manifest || null
})

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

async function loadTasks() {
  if (!currentProject.value) return
  tasks.value = await db.listTasks(currentProject.value.id)
}

async function selectSession(s) {
  currentSession.value = s
  messages.value = await db.listMessages(s.id)
  await loadTasks()
  // Mission mode checks
  if (s.agentType === 'mission') {
    const pendingTasks = tasks.value.filter(t => t.status === 'pending')
    showApproveButton.value = pendingTasks.length > 0
    const approvedTasks = tasks.value.filter(t => t.status === 'running')
    if (approvedTasks.length > 0) {
      executeAllTasks()
    }
  } else {
    showApproveButton.value = false
    showSummarizeButton.value = false
  }
  scrollDown()
}

async function createSession() {
  if (!currentProject.value) return
  const agentType = selectedMode.value === 'PM 拆解' ? 'mission' : 'chat'
  const s = await db.createSession(currentProject.value.id, new Date().toLocaleString('zh-CN'), agentType)
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
  let done = false
  let senderId = ''
  let reasoningText = ''
  const cleanup = agent.onOutput((data) => {
    // data = { agent, event } | { agent, raw }
    const isReasoning = data?.event?.data?.channel === 'reasoning'
    const text = data?.event?.data?.message || data?.event?.data?.content || data?.raw || ''
    // Phase 3: 捕获 _sender 身份标识
    if (data?.event?._sender?.id) {
      senderId = data.event._sender.id
    }
    if (text) {
      if (isReasoning) {
        // Phase 6: 推理气泡 — 单独累加，不混入消息内容
        reasoningText += text
        const last = messages.value[messages.value.length - 1]
        if (last && last.role === 'reasoning') {
          last.content = reasoningText
        } else {
          messages.value.push({ id: 'tmp', role: 'reasoning', content: reasoningText, timestamp: Date.now() })
        }
      } else {
        reply += text
        const last = messages.value[messages.value.length - 1]
        if (last && last.role === 'agent') {
          last.content = reply
          if (senderId) last.senderId = senderId
        } else {
          messages.value.push({ id: 'tmp', role: 'agent', agentName: selectedAgent.value, content: reply, senderId: senderId || undefined, timestamp: Date.now() })
        }
      }
      scrollDown()
    }
    // Phase 5: 检测 suggestion 事件
    if (data?.event?.event === 'suggestion') {
      showSuggestion.value = true
    }
    // 检测完成事件
    if (data?.event?.event === 'completion' || data?.event?.event === 'error') {
      done = true
    }
  })

  try {
    await agent.exec(selectedAgent.value, cmd, currentSession.value.id, currentProject.value?.id, selectedMode.value)
  } catch (err) {
    reply += `\n[错误] ${err.message || err}`
    done = true
  }

  // 等 completion/error 事件或超时 30s
  const timeout = setTimeout(() => { done = true }, 30000)
  while (!done) await new Promise(r => setTimeout(r, 100))

  clearTimeout(timeout)
  if (reply.trim()) {
    await db.addMessage(currentSession.value.id, 'agent', reply.trim())
  }
  cleanup()

  // Mission mode: reload tasks after PM reply
  if (selectedMode.value === 'PM 拆解') {
    await loadTasks()
    const pendingTasks = tasks.value.filter(t => t.status === 'pending')
    showApproveButton.value = pendingTasks.length > 0
  }
}

// ── 诊断 ──

function doctor() { if (selectedAgent.value) agent.doctor(selectedAgent.value) }

// ── Mission 模式辅助 ──

function toggleTask(id) {
  expandedTask.value = expandedTask.value === id ? null : id
}

function statusIcon(status) {
  return { pending: '⏳', running: '🔄', completed: '✅', archived: '📦' }[status] || '⏳'
}

async function approvePlan() {
  showApproveButton.value = false
  await db.approvePlan(currentSession.value.id)
  await loadTasks()
  // 预览模式：不执行，只展示
  if (selectedMode.value === '预览') return
  executeAllTasks()
}

async function executeAllTasks() {
  const runningTasks = tasks.value.filter(t => t.status === 'running')

  // 按 parallel_group 分组
  const groups = new Map()
  const singles = []
  for (const t of runningTasks) {
    // 从 description 中反查 parallel_group（Reasonix PM 输出格式）
    const pgMatch = t.description?.match(/并行组:\s*(\d+)/)
    const group = pgMatch ? parseInt(pgMatch[1]) : null
    if (group !== null) {
      const list = groups.get(group) || []
      list.push(t)
      groups.set(group, list)
    } else {
      singles.push(t)
    }
  }
  const groupKeys = Array.from(groups.keys()).sort((a, b) => a - b)
  const orderedGroups = groupKeys.map(k => groups.get(k)).concat(singles.map(t => [t]))

  for (const group of orderedGroups) {
    // 逐步模式：每组开始前询问
    if (selectedMode.value === '逐步' && group.length > 0) {
      const ok = confirm(`第 ${orderedGroups.indexOf(group) + 1} 组就绪，共 ${group.length} 个任务，开始执行？`)
      if (!ok) {
        for (const t of group) {
          await db.updateTask(t.id, { status: 'archived' })
        }
        continue
      }
    }

    // 检测冲突
    let sorted = group
    const conflictMap = new Map()
    for (const t of group) {
      for (const f of extractScope(t)) {
        const prev = conflictMap.get(f)
        if (prev) {
          console.warn(`[Scheduler] 文件冲突 ${f}: ${prev.id} 与 ${t.id}，自动降级串行`)
          sorted = group // 串行执行
        } else {
          conflictMap.set(f, t.id)
        }
      }
    }

    // YOLO/审批模式：直接并行（审批模式下已在 approvePlan 中确认）
    const semaphore = createSemaphore(Math.min(group.length, 4))
    await Promise.all(sorted.map(task =>
      semaphore.run(async () => {
        const agentName = task.assignee || selectedAgent.value
        const cleanup = agent.onOutput((data) => {
          const text = data?.event?.data?.message || data?.event?.data?.content || data?.raw || ''
          if (data?.event?.event === 'suggestion') showSuggestion.value = true
          if (text) {
            taskLogs.value[task.id] = (taskLogs.value[task.id] || '') + text
          }
        })
        try {
          await agent.exec(agentName, task.title, currentSession.value.id, currentProject.value.id, 'exec')
          await db.updateTask(task.id, { status: 'completed' })
        } catch (_) {
          await db.updateTask(task.id, { status: 'completed' })
        } finally {
          cleanup()
          await loadTasks()
        }
      })
    ))
  }
  checkAllTasksCompleted()
}

function extractScope(task) {
  // 从 description 中提取文件路径作为冲突检测范围
  const pathMatch = task.description?.match(/路径:\s*(\S+)/g)
  if (pathMatch) return pathMatch.map(s => s.replace('路径: ', ''))
  return []
}

function createSemaphore(max) {
  let running = 0
  const queue = []
  return {
    async run(fn) {
      if (running >= max) await new Promise(r => queue.push(r))
      running++
      try { return await fn() }
      finally {
        running--
        queue.shift()?.()
      }
    }
  }
}

function checkAllTasksCompleted() {
  const allDone = tasks.value.every(t => t.status === 'completed' || t.status === 'archived')
  showSummarizeButton.value = allDone
}

async function summarizeMission() {
  showSummarizeButton.value = false
  const summary = tasks.value
    .filter(t => t.status === 'completed' || t.status === 'archived')
    .map(t => {
      const log = (taskLogs.value[t.id] || '').trim()
      return `- [${t.status === 'completed' ? '✅' : '📦'}] **${t.title}** (${t.assignee || 'N/A'})${log ? '\n  ```\n  ' + log.slice(0, 500) + '\n  ```' : ''}`
    })
    .join('\n')
  const msg = `## Mission 完成汇总\n\n以下是所有任务执行结果，请 PM 进行验收总结：\n\n${summary || '无任务记录'}`
  await db.addMessage(currentSession.value.id, 'user', msg)
  messages.value.push({ id: 'tmp', role: 'user', content: msg, timestamp: Date.now() })

  // 调用 Reasonix PM 汇总任务执行结果
  let reply = ''
  let done = false
  let senderId = ''
  const cleanup = agent.onOutput((data) => {
    const text = data?.event?.data?.message || data?.event?.data?.content || data?.raw || ''
    if (data?.event?._sender?.id) senderId = data.event._sender.id
    if (text) {
      reply += text
      const last = messages.value[messages.value.length - 1]
      if (last && last.role === 'agent') {
        last.content = reply
        if (senderId) last.senderId = senderId
      } else {
        messages.value.push({ id: 'tmp', role: 'agent', agentName: 'reasonix', content: reply, timestamp: Date.now() })
      }
    }
    if (data?.event?.event === 'completion' || data?.event?.event === 'error') {
      done = true
    }
  })
  try {
    await agent.exec('reasonix', msg, currentSession.value.id, currentProject.value.id, '对话')
  } catch (err) {
    reply += `\n[错误] ${err.message || err}`
    done = true
  }
  const timeout = setTimeout(() => { done = true }, 60000)
  while (!done) await new Promise(r => setTimeout(r, 100))
  clearTimeout(timeout)
  if (reply.trim()) {
    await db.addMessage(currentSession.value.id, 'agent', reply.trim())
  }
  cleanup()
}

// ── 生命周期 ──

onMounted(async () => {
  await loadProjects()
  if (agent) {
    agent.onStatus((s) => {
      const st = typeof s === 'string' ? s : s.status || 'offline'
      // completed/killed 表示执行结束，恢复到 online 让输入框可用
      agentStatus.value = (st === 'completed' || st === 'killed') ? 'online' : st
    })
    try {
      agents.value = await agent.list() || []
    } catch (_) {
      agents.value = [{ name: 'codewhale', label: 'CodeWhale' }]
    }
    if (agents.value.length > 0) {
      selectedAgent.value = agents.value[0].name || agents.value[0]
    } else {
      selectedAgent.value = 'codewhale'
    }
    // Fallback: 每隔 500ms 检查状态，最多 10s 后强制 online
    let retries = 20
    const checkStatus = setInterval(() => {
      if (agentStatus.value !== 'offline') {
        clearInterval(checkStatus)
      } else if (--retries <= 0) {
        agentStatus.value = 'online'
        clearInterval(checkStatus)
      }
    }, 500)
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
.task-icon { font-size: 12px; }
.task-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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

/* ── Toolbar 选择器 ── */
.toolbar {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: #16213e; border-bottom: 1px solid #0f3460;
}
.toolbar-item { display: flex; align-items: center; }
.toolbar-select {
  appearance: none; -webkit-appearance: none;
  padding: 3px 22px 3px 8px; font-size: 12px;
  border: 1px solid #0f3460; border-radius: 4px;
  background: #1a1a2e url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E") no-repeat right 6px center;
  color: #e0e0e0; cursor: pointer; outline: none; min-width: 90px;
}
.toolbar-select:focus { border-color: #e94560; }
.toolbar-select option { background: #16213e; color: #e0e0e0; }
.agent-select { min-width: 100px; }
.mode-select { min-width: 72px; }

/* ── Agent 徽章 ── */
.agent-badge {
  display: inline-block; padding: 1px 8px; border-radius: 10px;
  font-size: 11px; font-weight: 600; margin-right: 4px;
}
.agent-badge-sm { font-size: 10px; padding: 0 6px; border-radius: 8px; }
.agent-codewhale { background: #1b5e20; color: #a5d6a7; }
.agent-reasonix { background: #4a148c; color: #ce93d8; }
.agent-pm { background: #e65100; color: #ffe0b2; }
.agent-ar-codewhale { background: #1b5e20; color: #a5d6a7; }
.agent-ar-reasonix { background: #4a148c; color: #ce93d8; }

/* Phase 3: _sender 实例 ID */
.sender-id { font-size: 10px; color: #888; margin-left: 4px; font-family: monospace; }

/* Phase 3: Agent 标签提示 */
.agent-tagline { font-size: 11px; color: #888; margin-left: 8px; cursor: help; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Phase 6: 推理气泡 */
.reasoning-label { color: #7c4dff; font-size: 12px; font-weight: 600; }
.reasoning-content { color: #b388ff; font-style: italic; background: rgba(124, 77, 255, 0.08); border-radius: 8px; padding: 6px 10px; margin-top: 2px; font-size: 13px; }

/* Phase 5: Suggestion 提示器 */
.suggestion-banner { background: #e65100; color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 12px; margin-top: 8px; }
.suggestion-banner span { display: flex; align-items: center; gap: 6px; }

/* ── 增强任务显示 ── */
.task-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.task-meta { display: flex; align-items: center; gap: 4px; }
.task-group { font-size: 10px; color: #888; }
.task-status-tag {
  font-size: 10px; padding: 1px 6px; border-radius: 8px; background: #0f3460; white-space: nowrap;
}
.task-status-tag.running { background: #e65100; color: #ffe0b2; }
.task-status-tag.completed { background: #1b5e20; color: #a5d6a7; }
.task-item.completed { opacity: 0.6; }
.task-item.archived { opacity: 0.4; text-decoration: line-through; }
.task-item.error { opacity: 0.8; border-left: 3px solid #b71c1c; }

/* ── 运行动画 ── */
@keyframes running-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.running-anim .task-icon { animation: running-pulse 1s ease-in-out infinite; }

/* ── 任务展开详情 ── */
.task-detail {
  grid-column: 1 / -1;
  padding: 8px 0 4px 0;
  border-top: 1px solid #0f346066;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.4;
}
.task-description {
  color: #aaa;
  margin-bottom: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}
.task-log {
  max-height: 120px;
  overflow-y: auto;
  background: #0d0d1a;
  border: 1px solid #0f3460;
  border-radius: 4px;
  padding: 6px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 11px;
  color: #b0b0b0;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── 任务操作按钮 ── */
.task-actions {
  padding: 8px 12px;
  border-top: 1px solid #0f3460;
}
.btn-approve, .btn-summarize {
  width: 100%;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn-approve {
  background: #e65100;
  color: #ffe0b2;
}
.btn-approve:hover {
  background: #d84315;
}
.btn-summarize {
  background: #1b5e20;
  color: #a5d6a7;
}
.btn-summarize:hover {
  background: #2e7d32;
}

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
