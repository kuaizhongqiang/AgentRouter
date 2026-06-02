<template>
  <div class="layout" :data-theme="theme">
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
          <span class="project-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h3l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
          </span>
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

      <!-- ═══ 凭证设置 ═══ -->
      <div class="sidebar-section">
        <div class="sidebar-title" @click="showCredentials = !showCredentials" style="cursor:pointer">
          <span>{{ showCredentials ? '▾' : '▸' }} 凭证</span>
          <span v-if="hasCredentials" class="dot online" style="width:6px;height:6px;display:inline-block"></span>
        </div>
        <div v-if="showCredentials" class="credentials-form">
          <input v-model="credApiKey" type="password" placeholder="API Key (sk-...)" class="cred-input" />
          <input v-model="credBaseUrl" placeholder="Base URL (https://...)" class="cred-input" />
          <button @click="saveCredentials" class="btn-mini cred-save">保存</button>
          <span v-if="credSaved" class="cred-saved-hint">✓ 已保存</span>
        </div>
      </div>
    </aside>

    <!-- ═══ 中间：对话区 ═══ -->
    <main class="main">
      <!-- Agent + 模式选择器 + 主题切换 -->
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
        <div class="toolbar-item toolbar-right">
          <button class="theme-toggle" @click="toggleTheme" :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'">
            <!-- 太阳图标（浅色模式时显示） -->
            <svg v-if="theme === 'light'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <!-- 月亮图标（深色模式时显示） -->
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
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

              <span class="avatar" :class="'avatar-' + (m.agentName || selectedAgent || 'codewhale').toLowerCase()">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/></svg>
              </span>
              <span class="agent-badge" :class="'agent-' + (m.agentName || selectedAgent || 'codewhale').toLowerCase()">{{ m.agentName || selectedAgent || 'CodeWhale' }}</span>

              <span v-if="m.senderId" class="sender-id">{{ m.senderId }}</span>
            </template>
            <template v-else-if="m.role === 'reasoning'">
              <span class="avatar avatar-reasoning">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              </span>
              <span class="reasoning-label">推理中</span>
            </template>
            <template v-else>
              <span class="avatar avatar-user">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              {{ { user: '你', system: '系统' }[m.role] || m.role }}
            </template>
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
        <button @click="send" :disabled="agentStatus !== 'online'" class="btn-send">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
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
          <span class="task-icon">
            <!-- pending -->
            <svg v-if="t.status === 'pending'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <!-- running -->
            <svg v-else-if="t.status === 'running'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <!-- completed -->
            <svg v-else-if="t.status === 'completed'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            <!-- archived -->
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </span>
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
        <div class="suggestion-actions" v-if="suggestionPaused">
          <button @click.stop="approveSuggestion" class="btn-approve">采纳</button>
          <button @click.stop="rejectSuggestion" class="btn-reject">拒绝</button>
        </div>
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

 ── 凭证状态 ──
const credentials = window.credentials || { get: () => ({ apiKey: '', baseUrl: '' }), set: () => {} }
const showCredentials = ref(false)
const credApiKey = ref('')
const credBaseUrl = ref('https://api.deepseek.com')
const credSaved = ref(false)
const hasCredentials = ref(false)

async function loadCredentials() {
  try {
    const c = await credentials.get()
    credApiKey.value = c.apiKey || ''
    credBaseUrl.value = c.baseUrl || 'https://api.deepseek.com'
    hasCredentials.value = !!c.apiKey
  } catch (_) { /* preload not available in dev */ }
}

async function saveCredentials() {
  try {
    await credentials.set({ apiKey: credApiKey.value, baseUrl: credBaseUrl.value })
    hasCredentials.value = !!credApiKey.value
    credSaved.value = true
    setTimeout(() => { credSaved.value = false }, 2000)
  } catch (_) { /* preload not available */ }
}


// ── Mission 模式状态 ──
const expandedTask = ref(null)
const taskLogs = ref({})
const showApproveButton = ref(false)
const showSummarizeButton = ref(false)
const showSuggestion = ref(false)
const suggestionPaused = ref(false)

// ── Agent 与模式 ──
const agents = ref([])
const selectedAgent = ref(null)
const selectedMode = ref('对话')
const modes = ['对话', 'PM 拆解', 'YOLO', '审批', '逐步', '预览']

// PM 拆解模式自动切换到有 can_suggest 能力的 Agent
watch(selectedMode, (newMode) => {
  if (newMode === 'PM 拆解') {
    // 优先选 manifest 中声明 can_suggest 的 agent
    const pmAgent = agents.value.find(a => a.manifest?.capabilities?.can_suggest)
    if (pmAgent) {
      selectedAgent.value = pmAgent.name
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
    const text = data?.event?.data?.message || data?.event?.data?.content || data?.event?.data?.error || data?.raw || ''
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
      // 审批/逐步模式：标记暂停
      if (data?._meta?.paused) {
        suggestionPaused.value = true
      }
    }
    // Phase 5: 检测 resume 信号（用户已响应建议）
    if (data?._meta?.resume) {
      suggestionPaused.value = false
      showSuggestion.value = false
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
          const text = data?.event?.data?.message || data?.event?.data?.content || data?.event?.data?.error || data?.raw || ''
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

// Phase 5: 用户响应 suggestion
async function approveSuggestion() {
  suggestionPaused.value = false
  showSuggestion.value = false
  if (currentSession.value) {
    await agent.respondSuggestion(currentSession.value.id, true)
  }
}

async function rejectSuggestion() {
  suggestionPaused.value = false
  showSuggestion.value = false
  if (currentSession.value) {
    await agent.respondSuggestion(currentSession.value.id, false)
  }
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

   // 调用 PM Agent 汇总任务执行结果（选 can_suggest 的 agent，默认 reasonix）
  const pmAgentName = agents.value.find(a => a.manifest?.capabilities?.can_suggest)?.name || 'reasonix'
  let reply = ''
  let done = false
  let senderId = ''
  const cleanup = agent.onOutput((data) => {
    const text = data?.event?.data?.message || data?.event?.data?.content || data?.event?.data?.error || data?.raw || ''
    if (data?.event?._sender?.id) senderId = data.event._sender.id
    if (text) {
      reply += text
      const last = messages.value[messages.value.length - 1]
      if (last && last.role === 'agent') {
        last.content = reply
        if (senderId) last.senderId = senderId
      } else {
        messages.value.push({ id: 'tmp', role: 'agent', agentName: pmAgentName, content: reply, timestamp: Date.now() })
      }
    }
    if (data?.event?.event === 'completion' || data?.event?.event === 'error') {
      done = true
    }
  })
  try {
    await agent.exec(pmAgentName, msg, currentSession.value.id, currentProject.value.id, '对话')
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
  await loadCredentials()
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
/* ═══ CSS 变量：深色主题（默认） ═══ */
:root,
[data-theme="dark"] {
  --bg-body: #0d0d0d;
  --bg-sidebar: #111;
  --bg-sidebar-hover: rgba(15, 52, 96, 0.2);
  --bg-sidebar-active: rgba(233, 69, 96, 0.12);
  --bg-main: #0d0d0d;
  --bg-panel: #111;
  --bg-input: #1a1a2e;
  --bg-msg-user: #0f3460;
  --bg-msg-agent: #111;
  --bg-msg-reasoning: rgba(124, 77, 255, 0.08);
  --bg-dialog: #16213e;
  --bg-dialog-input: #1a1a2e;
  --bg-status-bar: #0d0d1a;
  --bg-badge-codewhale: #1b5e20;
  --bg-badge-reasonix: #4a148c;
  --bg-badge-pm: #e65100;
  --color-text: #e0e0e0;
  --color-text-secondary: #888;
  --color-text-muted: #555;
  --color-border: rgba(255, 255, 255, 0.06);
  --color-border-strong: rgba(255, 255, 255, 0.1);
  --color-accent: #e94560;
  --color-accent-hover: #d33650;
  --color-dot-online: #4caf50;
  --color-dot-offline: #9c27b0;
  --color-dot-starting: #ff9800;
  --color-agent-codewhale: #a5d6a7;
  --color-agent-reasonix: #ce93d8;
  --color-agent-pm: #ffe0b2;
  --color-reasoning: #b388ff;
  --color-reasoning-label: #7c4dff;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-dialog: 0 8px 32px rgba(0,0,0,0.5);
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --transition: 0.2s ease;
}

/* ═══ CSS 变量：浅色主题 ═══ */
[data-theme="light"] {
  --bg-body: #f5f5f5;
  --bg-sidebar: #fff;
  --bg-sidebar-hover: rgba(0, 0, 0, 0.04);
  --bg-sidebar-active: rgba(233, 69, 96, 0.08);
  --bg-main: #f5f5f5;
  --bg-panel: #fff;
  --bg-input: #fff;
  --bg-msg-user: #e3f2fd;
  --bg-msg-agent: #fff;
  --bg-msg-reasoning: rgba(124, 77, 255, 0.06);
  --bg-dialog: #fff;
  --bg-dialog-input: #fff;
  --bg-status-bar: #fafafa;
  --bg-badge-codewhale: #e8f5e9;
  --bg-badge-reasonix: #f3e5f5;
  --bg-badge-pm: #fff3e0;
  --color-text: #1a1a1a;
  --color-text-secondary: #666;
  --color-text-muted: #aaa;
  --color-border: rgba(0, 0, 0, 0.08);
  --color-border-strong: rgba(0, 0, 0, 0.15);
  --color-accent: #e94560;
  --color-accent-hover: #d33650;
  --color-dot-online: #4caf50;
  --color-dot-offline: #9c27b0;
  --color-dot-starting: #ff9800;
  --color-agent-codewhale: #2e7d32;
  --color-agent-reasonix: #7b1fa2;
  --color-agent-pm: #e65100;
  --color-reasoning: #7c4dff;
  --color-reasoning-label: #5e35b1;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-dialog: 0 8px 32px rgba(0,0,0,0.15);
}

/* ═══ 全局 ═══ */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', sans-serif;
  background: var(--bg-body);
  color: var(--color-text);
  font-size: 14px;
  overflow: hidden;
  transition: background var(--transition), color var(--transition);
}
.layout { display: flex; height: 100vh; }

/* ═══ 侧边栏 ═══ */
.sidebar {
  width: 220px;
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  transition: background var(--transition), border-color var(--transition);
}
.sidebar-right {
  border-right: none;
  border-left: 1px solid var(--color-border);
}
.sidebar-title {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  transition: border-color var(--transition);
}
.project-list, .task-list { flex: 1; overflow-y: auto; }
.project-list::-webkit-scrollbar,
.task-list::-webkit-scrollbar { width: 4px; }
.project-list::-webkit-scrollbar-thumb,
.task-list::-webkit-scrollbar-thumb {
  background: var(--color-border-strong);
  border-radius: 4px;
}

.project-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; cursor: pointer; font-size: 13px;
  border-bottom: 1px solid var(--color-border);
  transition: background var(--transition);
}
.project-item:hover { background: var(--bg-sidebar-hover); }
.project-item.active {
  background: var(--bg-sidebar-active);
  color: var(--color-accent);
}
.project-item.active .project-name { color: var(--color-accent); font-weight: 600; }
.project-icon { display: flex; align-items: center; color: var(--color-text-secondary); }
.project-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text); }
.icon-btn { background: none; border: none; color: var(--color-text-secondary); font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: var(--radius-sm); transition: color var(--transition), background var(--transition); }
.icon-btn:hover { color: var(--color-accent); background: var(--bg-sidebar-hover); }
.icon-btn.small { font-size: 11px; opacity: 0; }
.project-item:hover .icon-btn.small { opacity: 0.6; }

/* ═══ 主区域 ═══ */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg-main); transition: background var(--transition); }

/* ═══ Toolbar ═══ */
.toolbar {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: var(--bg-panel);
  border-bottom: 1px solid var(--color-border);
  transition: background var(--transition), border-color var(--transition);
}
.toolbar-item { display: flex; align-items: center; }
.toolbar-right { margin-left: auto; }
.theme-toggle {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--bg-panel); color: var(--color-text-secondary);
  cursor: pointer; transition: all var(--transition);
}
.theme-toggle:hover { background: var(--bg-sidebar-hover); color: var(--color-accent); border-color: var(--color-accent); }

.toolbar-select {
  appearance: none; -webkit-appearance: none;
  padding: 5px 24px 5px 10px; font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--bg-input) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E") no-repeat right 8px center;
  color: var(--color-text); cursor: pointer; outline: none;
  min-width: 90px; transition: all var(--transition);
}
.toolbar-select:focus { border-color: var(--color-accent); }
.toolbar-select option { background: var(--bg-panel); color: var(--color-text); }
.agent-select { min-width: 100px; }
.mode-select { min-width: 72px; }
.agent-tagline { font-size: 11px; color: var(--color-text-secondary); margin-left: 8px; cursor: help; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ═══ 标签页 ═══ */
.session-tabs { background: var(--bg-panel); border-bottom: 1px solid var(--color-border); padding: 0 8px; transition: background var(--transition), border-color var(--transition); }
.tabs-scroll { display: flex; gap: 2px; overflow-x: auto; }
.tab {
  padding: 8px 12px; font-size: 12px; border: none; background: none;
  color: var(--color-text-secondary); cursor: pointer; white-space: nowrap;
  display: flex; align-items: center; gap: 4px;
  border-bottom: 2px solid transparent;
  transition: all var(--transition);
}
.tab:hover { color: var(--color-text); background: var(--bg-sidebar-hover); }
.tab.active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
.tab.new { color: var(--color-accent); font-size: 16px; }
.tab-close { font-size: 10px; opacity: 0; transition: opacity var(--transition); }
.tab:hover .tab-close { opacity: 0.6; }

/* ═══ 消息区 ═══ */
.messages { flex: 1; overflow-y: auto; padding: 16px 20px; }
.messages::-webkit-scrollbar { width: 4px; }
.messages::-webkit-scrollbar-thumb { background: var(--color-border-strong); border-radius: 4px; }
.msg { margin-bottom: 16px; max-width: 85%; transition: all var(--transition); }
.msg.user { margin-left: auto; }
.msg-role {
  font-size: 11px; font-weight: 600; margin-bottom: 6px;
  display: flex; align-items: center; gap: 6px;
}
.msg.user .msg-role { color: #42a5f5; justify-content: flex-end; }
.msg.agent .msg-role { color: var(--color-agent-codewhale); }

/* 头像 */
.avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
}
.avatar svg { display: block; }
.avatar-codewhale { background: var(--bg-badge-codewhale); color: var(--color-agent-codewhale); }
.avatar-reasoning { background: var(--bg-badge-reasonix); color: var(--color-agent-reasonix); }
.avatar-user { background: #e3f2fd; color: #1565c0; }
[data-theme="dark"] .avatar-user { background: #0d47a1; color: #90caf9; }

/* 消息气泡 */
.msg-content {
  white-space: pre-wrap; word-break: break-word;
  font-size: 13px; line-height: 1.6;
  padding: 10px 14px; border-radius: var(--radius-lg);
  transition: background var(--transition), color var(--transition);
}
.msg.user .msg-content {
  background: var(--bg-msg-user);
  border-bottom-right-radius: 4px;
  color: var(--color-text);
}
.msg.agent .msg-content {
  background: var(--bg-msg-agent);
  border: 1px solid var(--color-border);
  border-bottom-left-radius: 4px;
  color: var(--color-text);
  box-shadow: var(--shadow-card);
}
.msg.user .msg-content { background: var(--bg-msg-user); color: var(--color-text); }
[data-theme="dark"] .msg.user .msg-content { color: #e0e0e0; }

.reasoning-label { color: var(--color-reasoning-label); font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.reasoning-content {
  color: var(--color-reasoning);
  font-style: italic;
  background: var(--bg-msg-reasoning);
  border-radius: var(--radius-md);
  padding: 6px 10px; margin-top: 2px;
  font-size: 13px;
  border: 1px solid rgba(124, 77, 255, 0.15);
}
.sender-id { font-size: 10px; color: var(--color-text-secondary); margin-left: 4px; font-family: 'Cascadia Code', 'Fira Code', monospace; }

.placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); font-size: 14px; }
.placeholder.small { padding: 20px; font-size: 12px; }

/* ═══ Agent 徽章 ═══ */
.agent-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 10px; border-radius: 10px;
  font-size: 11px; font-weight: 600;
  transition: all var(--transition);
}
.agent-badge-sm { font-size: 10px; padding: 0 6px; border-radius: 8px; }
.agent-codewhale { background: var(--bg-badge-codewhale); color: var(--color-agent-codewhale); }
.agent-reasonix { background: var(--bg-badge-reasonix); color: var(--color-agent-reasonix); }
.agent-pm { background: var(--bg-badge-pm); color: var(--color-agent-pm); }

/* ═══ 输入栏 ═══ */
.input-bar {
  display: flex; gap: 8px; padding: 10px 16px;
  border-top: 1px solid var(--color-border);
  background: var(--bg-panel);
  transition: background var(--transition), border-color var(--transition);
}
.input-bar input {
  flex: 1; padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-input); color: var(--color-text);
  font-size: 14px; outline: none;
  transition: all var(--transition);
}
.input-bar input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 2px rgba(233, 69, 96, 0.15); }
.btn-send {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border: none; border-radius: var(--radius-md);
  background: var(--color-accent); color: #fff; cursor: pointer;
  transition: background var(--transition), transform 0.1s;
}
.btn-send:hover:not(:disabled) { background: var(--color-accent-hover); transform: scale(1.05); }
.btn-send:active:not(:disabled) { transform: scale(0.95); }
.btn-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

/* ═══ 状态栏 ═══ */
.status-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 16px; font-size: 12px; color: var(--color-text-secondary);
  background: var(--bg-status-bar);
  border-top: 1px solid var(--color-border);
  transition: background var(--transition), border-color var(--transition);
}
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.online { background: var(--color-dot-online); box-shadow: 0 0 6px rgba(76, 175, 80, 0.4); }
.dot.offline { background: var(--color-dot-offline); }
.dot.starting { background: var(--color-dot-starting); animation: pulse 1s ease-in-out infinite; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.btn-mini {
  padding: 2px 10px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: var(--bg-panel);
  color: var(--color-text-secondary); font-size: 11px; cursor: pointer;
  transition: all var(--transition);
}
.btn-mini:hover { color: var(--color-text); border-color: var(--color-text-secondary); }

/* ═══ 任务列表 ═══ */
.task-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.task-item {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; font-size: 12px;
  cursor: pointer; transition: background var(--transition);
  border-bottom: 1px solid var(--color-border);
}
.task-item:hover { background: var(--bg-sidebar-hover); }
.task-icon { display: flex; align-items: center; color: var(--color-text-secondary); flex-shrink: 0; margin-top: 1px; }
.task-body { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.task-meta { display: flex; align-items: center; gap: 4px; }
.task-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text); font-size: 12.5px; }
.task-group { font-size: 10px; color: var(--color-text-secondary); }
.task-status-tag {
  font-size: 10px; padding: 1px 8px; border-radius: 8px;
  background: var(--color-border); white-space: nowrap; flex-shrink: 0;
  color: var(--color-text-secondary);
  transition: all var(--transition);
}
.task-status-tag.running { background: var(--bg-badge-pm); color: var(--color-agent-pm); }
.task-status-tag.completed { background: var(--bg-badge-codewhale); color: var(--color-agent-codewhale); }
.task-item.completed { opacity: 0.6; }
.task-item.archived { opacity: 0.4; }
.task-item.error { border-left: 3px solid #b71c1c; }

/* 运行动画 */
@keyframes running-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.running-anim .task-icon { animation: running-pulse 1s ease-in-out infinite; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* 任务展开详情 */
.task-detail {
  grid-column: 1 / -1;
  padding: 8px 0 4px 0;
  border-top: 1px solid var(--color-border);
  margin-top: 6px; font-size: 11px; line-height: 1.5; color: var(--color-text-secondary);
}
.task-description {
  color: var(--color-text-secondary);
  margin-bottom: 6px; white-space: pre-wrap; word-break: break-word;
}
.task-log {
  max-height: 120px; overflow-y: auto;
  background: var(--bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 6px; font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 11px; color: var(--color-text-secondary);
  white-space: pre-wrap; word-break: break-word;
  transition: all var(--transition);
}

/* 任务操作按钮 */
.task-actions { padding: 8px 12px; border-top: 1px solid var(--color-border); transition: border-color var(--transition); }
.btn-approve, .btn-summarize {
  width: 100%; padding: 6px 12px; border: none;
  border-radius: var(--radius-sm); font-size: 12px; font-weight: 600; cursor: pointer;
  transition: background var(--transition);
}
.btn-approve { background: #e65100; color: #ffe0b2; }
.btn-approve:hover { background: #d84315; }
.btn-summarize { background: #1b5e20; color: #a5d6a7; }
.btn-summarize:hover { background: #2e7d32; }
[data-theme="light"] .btn-approve { background: #fff3e0; color: #e65100; }
[data-theme="light"] .btn-approve:hover { background: #ffe0b2; }
[data-theme="light"] .btn-summarize { background: #e8f5e9; color: #2e7d32; }
[data-theme="light"] .btn-summarize:hover { background: #c8e6c9; }

/* Suggestion 提示器 */
.suggestion-banner {
  background: #e65100; color: #fff; padding: 6px 12px;
  border-radius: var(--radius-sm); font-size: 12px; margin-top: 8px;
  transition: background var(--transition);
}
[data-theme="light"] .suggestion-banner { background: #fff3e0; color: #e65100; }
.suggestion-banner span { display: flex; align-items: center; gap: 6px; }
.suggestion-actions { display: flex; gap: 6px; margin-top: 6px; }
.btn-approve { background: #2e7d32; color: #fff; border: none; border-radius: var(--radius-sm); padding: 4px 12px; cursor: pointer; font-size: 12px; }
.btn-reject { background: #c62828; color: #fff; border: none; border-radius: var(--radius-sm); padding: 4px 12px; cursor: pointer; font-size: 12px; }

/* ═══ 弹窗 ═══ */
.dialog-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex;
  align-items: center; justify-content: center; z-index: 100;
  backdrop-filter: blur(2px);
}
.dialog {
  background: var(--bg-dialog); border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg); padding: 20px; width: 400px;
  box-shadow: var(--shadow-dialog);
  transition: background var(--transition), border-color var(--transition);
}
.dialog h3 { margin-bottom: 12px; font-size: 16px; color: var(--color-text); }
.dialog input {
  width: 100%; padding: 8px 10px; margin-bottom: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--bg-dialog-input); color: var(--color-text);
  font-size: 13px; outline: none; transition: all var(--transition);
}
.dialog input:focus { border-color: var(--color-accent); }
.dialog-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
.dialog-actions button {
  padding: 6px 16px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: var(--bg-input);
  color: var(--color-text); cursor: pointer; transition: all var(--transition);
}
ialog-actions button.primary { background: #e94560; border-color: #e94560; color: #fff; }

/* ── 凭证表单 ── */
.sidebar-section { border-top: 1px solid #0f3460; }
.credentials-form { padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
.cred-input {
  width: 100%; padding: 6px 8px; border: 1px solid #0f3460;
  border-radius: 4px; background: #1a1a2e; color: #e0e0e0;
  font-size: 12px; outline: none;
}
.cred-input:focus { border-color: #e94560; }
.cred-save { align-self: flex-start; }
.cred-saved-hint { color: #4caf50; font-size: 11px; }

.dialog-actions button:hover { border-color: var(--color-text-secondary); }
.dialog-actions button.primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; }
.dialog-actions button.primary:hover { background: var(--color-accent-hover); }

</style>
