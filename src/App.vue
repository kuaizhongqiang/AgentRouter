<template>
  <Splitpanes class="layout" :data-theme="theme">
    <!-- ═══ 左侧：项目列表 ═══ -->
    <Pane :min-size="17" class="sidebar-pane">
    <aside class="sidebar sidebar-left">
      <div class="sidebar-title">
        <span>{{ $t('sidebar.projects') }}</span>
        <button class="icon-btn" @click="showNewProject = true" :title="$t('sidebar.newProject')">＋</button>
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
          <button class="icon-btn small" @click.stop="removeProject(p.id)" :title="$t('sidebar.remove')">✕</button>
        </div>
      </div>

      <div v-if="showNewProject" class="dialog-overlay" @click.self="showNewProject = false">
        <div class="dialog">
          <h3>{{ $t('sidebar.dialog.title') }}</h3>
          <input v-model="newProjectName" :placeholder="$t('sidebar.dialog.name')" />
          <input v-model="newProjectPath" :placeholder="$t('sidebar.dialog.path')" />
          <div class="dialog-actions">
            <button @click="showNewProject = false">{{ $t('sidebar.dialog.cancel') }}</button>
            <button @click="createProject" class="primary">{{ $t('sidebar.dialog.create') }}</button>
          </div>
        </div>
      </div>

      <!-- ═══ 凭证设置 ═══ -->
      <div class="sidebar-section">
        <div class="sidebar-title" @click="showCredentials = !showCredentials" style="cursor:pointer">
          <span>{{ showCredentials ? '▾' : '▸' }} {{ $t('sidebar.credentials') }}</span>
          <span v-if="hasCredentials" class="dot online" style="width:6px;height:6px;display:inline-block"></span>
        </div>
        <div v-if="showCredentials" class="credentials-form">
          <input v-model="credApiKey" type="password" :placeholder="$t('sidebar.apiKeyPlaceholder')" class="cred-input" />
          <input v-model="credBaseUrl" :placeholder="$t('sidebar.baseUrlPlaceholder')" class="cred-input" />
          <button @click="saveCredentials" class="btn-mini cred-save">{{ $t('sidebar.save') }}</button>
          <span v-if="credSaved" class="cred-saved-hint">✓ {{ $t('sidebar.saved') }}</span>
        </div>
      </div>
    </aside>
    </Pane>

    <!-- ═══ 中间：对话区 ═══ -->
    <Pane class="main-pane">
    <main class="main">
      <!-- Agent + 模式选择器 + 主题切换 -->
      <div class="toolbar" v-if="currentProject">
        <div class="toolbar-item">
          <select v-model="selectedAgent" class="toolbar-select agent-select">
            <option v-for="a in agents" :key="a.name" :value="a.name"
              :disabled="a.health && !a.health.healthy"
              :title="(a.health && !a.health.healthy ? '⚠️ ' + (a.health.error || '不可用') + ' — ' : '') + (a.manifest?.tagline || '')">
              {{ a.label || a.name }}
              {{ a.health ? (a.health.healthy ? '✅' : '❌') : '' }}
            </option>
          </select>
          <span v-if="selectedAgentManifest?.tagline" class="agent-tagline" :title="selectedAgentManifest.tagline">{{ selectedAgentManifest.tagline }}</span>
        </div>
        <div class="toolbar-item">
          <select v-model="selectedMode" class="toolbar-select mode-select">
            <option v-for="m in modes" :key="m" :value="m">{{ { '对话': $t('toolbar.modes.dialog'), 'PM 拆解': $t('toolbar.modes.pm'), 'YOLO': 'YOLO', '审批': $t('toolbar.modes.approval'), '逐步': $t('toolbar.modes.stepwise'), '预览': $t('toolbar.modes.preview'), '代码审查': $t('toolbar.modes.codeReview') }[m] || m }}</option>
          </select>
        </div>
        <div class="toolbar-item toolbar-right">
          <button class="theme-toggle" @click="showSettings = true" :title="$t('toolbar.settings')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button class="theme-toggle" @click="toggleTheme" :title="theme === 'dark' ? $t('toolbar.switchLight') : $t('toolbar.switchDark')">
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
              <span class="reasoning-label">{{ $t('messages.reasoningLabel') }}</span>
            </template>
            <template v-else>
              <span class="avatar avatar-user">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              {{ m.role === 'user' ? $t('chat.user') : m.role === 'system' ? $t('chat.system') : m.role }}
            </template>
          </div>
          <div class="msg-content" :class="{ 'reasoning-content': m.role === 'reasoning' }">
            <MarkdownRenderer v-if="m.role !== 'reasoning'" :content="m.content" />
            <template v-else>{{ m.content }}</template>
          </div>
          <!-- 代码审查：接受 / 拒绝 -->
          <div v-if="m.role === 'agent' && selectedMode === '代码审查' && m.content && !m._reviewDone" class="review-actions">
            <button class="btn-review-accept" @click="acceptReview(m)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              {{ $t('review.accept') }}
            </button>
            <button class="btn-review-reject" @click="rejectReview(m)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              {{ $t('review.reject') }}
            </button>
          </div>
          <div v-if="m._reviewResult" class="review-result" :class="m._reviewResult">
            {{ m._reviewResult === 'accepted' ? $t('review.accepted') : $t('review.rejected') }}
          </div>
          <!-- Token 消耗 -->
          <div v-if="m.role === 'agent' && m._tokenInfo" class="msg-tokens">
            <span>↑ {{ formatTokens(m._tokenInfo.promptTokens) }}</span>
            <span>↓ {{ formatTokens(m._tokenInfo.completionTokens) }}</span>
            <span class="msg-tokens-total">{{ $t('messages.tokenInfo', { count: formatTokens(m._tokenInfo.totalTokens) }) }}</span>
            <span v-if="m._tokenInfo.model" class="msg-tokens-model">{{ m._tokenInfo.model }}</span>
          </div>
        </div>
      </div>
      <div class="placeholder" v-else>
        {{ currentProject ? $t('chat.noSession') : $t('chat.noProject') }}
      </div>

      <!-- Issue #22: 首次消息引导 -->
      <div v-if="currentSession && messages.length === 0" class="first-message-hint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>{{ $t('chat.firstMessageHint') }}</span>
      </div>
      <div class="input-bar" v-if="currentSession" style="position:relative">
        <!-- 斜杠命令面板 -->
        <div v-if="showCommandPalette" class="command-palette">
          <div
            v-for="(cmd, i) in filteredCommands"
            :key="cmd.name"
            class="command-item"
            :class="{ highlight: i === selectedCommandIndex }"
            @click="selectCommand(cmd)"
            @mouseenter="selectedCommandIndex = i"
          >
            <span class="cmd-name">{{ cmd.name }}</span>
            <span class="cmd-desc">{{ cmd.description }}</span>
            <span class="cmd-detail">{{ cmd.detail }}</span>
          </div>
          <div v-if="filteredCommands.length === 0" class="command-empty">{{ $t('commands.noMatch') }}</div>
        </div>
        <input
          ref="inputRef"
          v-model="userInput"
          :placeholder="selectedMode === 'PM 拆解' ? $t('chat.placeholder.pm') : selectedMode === '代码审查' ? $t('chat.placeholder.codeReview') : $t('chat.placeholder.default', { agent: selectedAgent || 'Agent' })"
          @keydown="handleInputKeydown"
          :disabled="agentStatus !== 'online'"
        />
        <button @click="send" :disabled="agentStatus !== 'online'" class="btn-send">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div class="status-bar">
        <span class="dot" :class="agentStatus"></span>
        <span class="status-text">{{ selectedAgent || 'Agent' }} {{ { online: $t('toolbar.agent.online'), offline: $t('toolbar.agent.offline'), starting: $t('toolbar.agent.starting') }[agentStatus] }}</span>
        <span v-if="sessionTokenUsage" class="status-tokens" :title="$t('token.title')">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {{ formatTokens(sessionTokenUsage.totalTokens) }}
        </span>
        <button @click="doctor" class="btn-mini">{{ $t('toolbar.agent.doctor') }}</button>
      </div>
    </main>
    </Pane>

    <!-- ═══ 右侧：任务列表 / Diff ═══ -->
    <Pane :min-size="21" class="sidebar-pane">
    <aside class="sidebar sidebar-right">
      <div class="sidebar-tabs">
        <button class="sidebar-tab" :class="{ active: rightTab === 'tasks' }" @click="rightTab = 'tasks'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          {{ $t('tasks.title') }}
        </button>
        <button class="sidebar-tab" :class="{ active: rightTab === 'diff' }" @click="rightTab = 'diff'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Diff
          <span v-if="collectedDiffs.length > 0" class="tab-badge">{{ collectedDiffs.length }}</span>
        </button>
        <button class="sidebar-tab" :class="{ active: rightTab === 'token' }" @click="rightTab = 'token'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {{ $t('token.title') }}
        </button>
      </div>

      <!-- 任务标签页 -->
      <template v-if="rightTab === 'tasks'">
      <!-- Issue #2: 任务筛选 -->
      <div class="task-filter-bar">
        <input v-model="taskFilter" class="task-filter-input" :placeholder="$t('tasks.searchPlaceholder')" />
        <select v-model="taskStatusFilter" class="task-filter-select">
          <option value="">{{ $t('tasks.allStatus') }}</option>
          <option value="pending">{{ $t('tasks.pending') }}</option>
          <option value="running">{{ $t('tasks.running') }}</option>
          <option value="completed">{{ $t('tasks.completed') }}</option>
          <option value="archived">{{ $t('tasks.archived') }}</option>
        </select>
      </div>
      <div class="task-list">
        <div v-for="t in filteredTasks" :key="t.id" class="task-item" :class="[t.status, t.status === 'running' ? 'running-anim' : '']" @click="toggleTask(t.id)">
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
          <span class="task-status-tag" :class="t.status">{{ { pending: $t('tasks.pending'), running: $t('tasks.running'), completed: $t('tasks.completed'), archived: $t('tasks.archived') }[t.status] || t.status }}</span>
          <div v-if="expandedTask === t.id" class="task-detail">
            <p v-if="t.description" class="task-description">{{ t.description }}</p>
            <div class="task-log">{{ taskLogs[t.id] || '' }}</div>
          </div>
        </div>
      </div>
      <div v-if="showApproveButton" class="task-actions">
        <button @click.stop="approvePlan" class="btn-approve">{{ $t('tasks.approvePlan') }}</button>
      </div>
      <div v-if="showSummarizeButton" class="task-actions">
        <button @click.stop="summarizeMission" class="btn-summarize">{{ $t('tasks.summarize') }}</button>
      </div>
      <div v-if="showSuggestion" class="task-actions suggestion-banner">
        <span>{{ $t('tasks.suggestion') }}</span>
        <div class="suggestion-actions" v-if="suggestionPaused">
          <button @click.stop="approveSuggestion" class="btn-approve">{{ $t('tasks.approve') }}</button>
          <button @click.stop="rejectSuggestion" class="btn-reject">{{ $t('tasks.reject') }}</button>
        </div>
      </div>
      <div class="placeholder small" v-if="tasks.length === 0">{{ $t('tasks.empty') }}</div>

      <!-- Issue #19: 任务模板 -->
      <div class="template-bar">
        <button class="template-toggle" @click="showTemplatePanel = !showTemplatePanel; if (showTemplatePanel) loadTemplates()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          {{ $t('tasks.templates') }}
        </button>
        <button class="template-save-btn" @click="showSaveTemplate = true" :disabled="tasks.length === 0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {{ $t('tasks.saveAsTemplate') }}
        </button>
      </div>
      <div v-if="showTemplatePanel" class="template-panel">
        <div v-if="showSaveTemplate" class="template-save-form">
          <input v-model="templateName" :placeholder="$t('tasks.templateNamePlaceholder')" />
          <input v-model="templateDesc" :placeholder="$t('tasks.templateDescPlaceholder')" />
          <button @click="saveTemplate" class="btn-approve" style="width:100%;margin-top:6px">{{ $t('common.save') }}</button>
          <button @click="showSaveTemplate = false; templateName = ''; templateDesc = ''" class="btn-back" style="width:100%;margin-top:4px">{{ $t('common.cancel') }}</button>
        </div>
        <div v-for="tpl in templates" :key="tpl.id" class="template-item">
          <div class="template-item-header">
            <span class="template-item-name">{{ tpl.name }}</span>
            <button class="template-delete-btn" @click="deleteTemplate(tpl.id)">✕</button>
          </div>
          <p class="template-item-desc">{{ tpl.description }}</p>
        </div>
        <div class="placeholder small" v-if="templates.length === 0 && !showSaveTemplate">{{ $t('tasks.noTemplates') }}</div>
      </div>
      </template>

      <!-- Diff 标签页 -->
      <template v-if="rightTab === 'diff'">
        <div class="sidebar-diff-body">
          <DiffPanel :diffs="collectedDiffs" />
        </div>
      </template>

      <!-- Token 标签页 -->
      <template v-if="rightTab === 'token'">
        <div class="sidebar-token-body">
          <div class="token-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>{{ $t('token.title') }}</span>
          </div>
          <div v-if="sessionTokenUsage" class="token-stats">
            <div class="token-row">
              <span class="token-label">{{ $t('token.prompt') }}</span>
              <span class="token-value">{{ formatTokens(sessionTokenUsage.promptTokens) }}</span>
            </div>
            <div class="token-row">
              <span class="token-label">{{ $t('token.completion') }}</span>
              <span class="token-value">{{ formatTokens(sessionTokenUsage.completionTokens) }}</span>
            </div>
            <div class="token-row token-total">
              <span class="token-label">{{ $t('token.total') }}</span>
              <span class="token-value">{{ formatTokens(sessionTokenUsage.totalTokens) }}</span>
            </div>
            <div v-if="sessionTokenUsage.model" class="token-model">
              {{ $t('token.model') }}：{{ sessionTokenUsage.model }}
            </div>
          </div>
          <div v-else class="token-empty">{{ $t('token.empty') }}</div>
        </div>
      </template>
    </aside>
    </Pane>
  </Splitpanes>

  <!-- 文件选择器（代码审查模式） -->
  <div v-if="showFileSelector" class="dialog-overlay" @click.self="showFileSelector = false">
    <div class="dialog file-selector-dialog">
      <h3>{{ $t('review.fileSelector.title') }}</h3>
      <p class="file-selector-hint">{{ $t('review.fileSelector.hint') }}</p>

      <div class="file-selector-search">
        <input v-model="reviewFileFilter" :placeholder="$t('review.fileSelector.search')" />
      </div>

      <div class="file-selector-list">
        <div
          v-for="f in filteredSourceFiles"
          :key="f.path"
          class="file-selector-item"
          :class="{ dir: f.isDir }"
          @click="!f.isDir && toggleReviewFile(f.path)"
        >
          <input
            type="checkbox"
            :checked="selectedReviewFiles.indexOf(f.path) >= 0"
            :disabled="f.isDir"
            @click.stop="!f.isDir && toggleReviewFile(f.path)"
          />
          <span class="file-sel-icon">
            <svg v-if="f.isDir" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h3l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </span>
          <span class="file-sel-name">{{ f.path }}</span>
        </div>
        <div v-if="filteredSourceFiles.length === 0" class="file-selector-empty">{{ $t('review.fileSelector.noMatch') }}</div>
      </div>

      <div class="file-selector-focus">
        <label>{{ $t('review.fileSelector.focus') }}</label>
        <textarea v-model="reviewFocusInput" rows="2" :placeholder="$t('review.fileSelector.focusPlaceholder')"></textarea>
      </div>

      <div class="dialog-actions">
        <span class="file-sel-count">{{ $t('review.fileSelector.selected', { count: selectedReviewFiles.length }) }}</span>
        <button @click="showFileSelector = false">{{ $t('review.fileSelector.cancel') }}</button>
        <button @click="confirmReviewFiles" class="primary" :disabled="selectedReviewFiles.length === 0">{{ $t('review.fileSelector.start') }}</button>
      </div>
    </div>
  </div>

  <Settings
    v-model="showSettings"
    :agents="agents"
    :modes="modes"
    :current-theme="theme"
    @update:theme="(t) => { theme.value = t; localStorage.setItem('theme', t) }"
  />

  <Onboarding
    v-model="showOnboarding"
    :agents="agents"
    @create-project="onOnboardingCreateProject"
    @select-agent="onOnboardingSelectAgent"
    @finished="onOnboardingFinished"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import Settings from './Settings.vue'
import Onboarding from './Onboarding.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import DiffPanel from './DiffPanel.vue'

const { t } = useI18n()

const agent = window.agent
const db = window.db
const notification = window.notification

/** 聊天模式列表（这些模式不弹系统通知） */
const CHAT_MODES = ['对话', 'PM 拆解']

/** 将技术错误转为用户友好提示 */
function formatError(msg) {
  const map = {
    ENOENT: '文件或目录不存在',
    ECONNREFUSED: '连接被拒绝',
    ECONNRESET: '连接被重置',
    ETIMEDOUT: '连接超时',
    EACCES: '权限不足',
    ENOTFOUND: '网络连接失败',
    ENOSPC: '磁盘空间不足',
    'Unknown agent': '未知的 Agent',
    'Session not found': '会话不存在',
    'Project not found': '项目不存在',
  }
  for (const [key, friendly] of Object.entries(map)) {
    if (msg && msg.includes(key)) return friendly
  }
  if (msg && msg.length > 80) return msg.slice(0, 77) + '...'
  return msg || '未知错误'
}

// Phase 7 #48: 启动状态
const startupPhase = ref('')
const startupMessage = ref('')

const projects = ref([])
const sessions = ref([])
const messages = ref([])
const tasks = ref([])
const currentProject = ref(null)
const currentSession = ref(null)
const userInput = ref('')
const agentStatus = ref('offline')
const showNewProject = ref(false)
const showOnboarding = ref(false)
const newProjectName = ref('')
const newProjectPath = ref('')
const msgRef = ref(null)
const inputRef = ref(null)

// ── 斜杠命令面板 ──
const commands = ref([
  { name: '/fix', description: t('commands.fix'), detail: t('commands.fixDetail') },
  { name: '/feat', description: t('commands.feat'), detail: t('commands.featDetail') },
  { name: '/review', description: t('commands.review'), detail: t('commands.reviewDetail') },
  { name: '/refactor', description: t('commands.refactor'), detail: t('commands.refactorDetail') },
  { name: '/test', description: t('commands.test'), detail: t('commands.testDetail') },
  { name: '/doc', description: t('commands.doc'), detail: t('commands.docDetail') },
])
const showCommandPalette = ref(false)
const commandFilter = ref('')
const selectedCommandIndex = ref(0)

// ── Diff 面板 ──
const rightTab = ref('tasks')
const collectedDiffs = ref([])

// ── 代码审查模式 ──
const showFileSelector = ref(false)
const sourceFiles = ref([])
const selectedReviewFiles = ref([])
const reviewFocusInput = ref(t('review.fileSelector.focusPlaceholder'))
const reviewFileFilter = ref('')

const filteredSourceFiles = computed(() => {
  if (!reviewFileFilter.value) return sourceFiles.value
  const q = reviewFileFilter.value.toLowerCase()
  return sourceFiles.value.filter(f => f.path.toLowerCase().includes(q))
})

async function openFileSelector() {
  if (!currentProject.value?.path) return
  try {
    sourceFiles.value = await db.listSourceFiles(currentProject.value.path) || []
    // 默认选中 src/ 目录下的非目录文件
    selectedReviewFiles.value = sourceFiles.value
      .filter(f => !f.isDir && (f.path.startsWith('src/') || f.path.startsWith('electron/')))
      .map(f => f.path)
    showFileSelector.value = true
  } catch (err) {
    console.error('[Review] Failed to list source files:', err)
  }
}

function toggleReviewFile(filePath) {
  const idx = selectedReviewFiles.value.indexOf(filePath)
  if (idx >= 0) {
    selectedReviewFiles.value.splice(idx, 1)
  } else {
    selectedReviewFiles.value.push(filePath)
  }
}

function confirmReviewFiles() {
  showFileSelector.value = false
  if (selectedReviewFiles.value.length === 0) return

  // 清空之前的 diff
  collectedDiffs.value = []
  // 切换到 Diff 标签
  rightTab.value = 'diff'

  // 构造审查指令
  const files = selectedReviewFiles.value.join(', ')
  const focus = reviewFocusInput.value.trim() || '代码质量、性能、安全、可维护性'
  const cmd = `请审查以下文件：${files}\n关注：${focus}`
  userInput.value = cmd
  // 清空选择缓存
  selectedReviewFiles.value = []
}

// ── 代码审查状态 ──
const reviewAccepted = ref(new Set())
const reviewRejected = ref(new Set())

// ── Token 计费 ──
const sessionTokenUsage = ref(null)

async function loadTokenUsage(sessionId) {
  if (!sessionId || !window.token?.getUsage) return
  try {
    const usage = await window.token.getUsage(sessionId)
    sessionTokenUsage.value = usage
    // 将 token 信息挂到最后一条 agent 消息上
    if (usage) {
      const msgs = messages.value
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'agent') {
          msgs[i]._tokenInfo = usage
          break
        }
      }
    }
  } catch { /* backend not ready */ }
}

function formatTokens(n) {
  if (n == null) return '—'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function collectDiffs(deltas) {
  if (!deltas || deltas.length === 0) return
  for (const d of deltas) {
    // 去重：同文件同名仅保留最新
    const idx = collectedDiffs.value.findIndex(e => e.file === d.file)
    if (idx >= 0) {
      collectedDiffs.value[idx] = d
    } else {
      collectedDiffs.value.push(d)
    }
  }
}

function acceptReview(msg) {
  msg._reviewDone = true
  msg._reviewResult = 'accepted'
}

function rejectReview(msg) {
  msg._reviewDone = true
  msg._reviewResult = 'rejected'
}

const filteredCommands = computed(() => {
  if (!commandFilter.value) return commands.value
  const q = commandFilter.value.toLowerCase()
  return commands.value.filter(c =>
    c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
  )
})

function handleInputKeydown(e) {
  const input = e.target
  const val = input.value

  if (showCommandPalette.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedCommandIndex.value = Math.min(selectedCommandIndex.value + 1, filteredCommands.value.length - 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedCommandIndex.value = Math.max(selectedCommandIndex.value - 1, 0)
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (filteredCommands.value.length > 0) {
        selectCommand(filteredCommands.value[selectedCommandIndex.value])
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      closeCommandPalette()
      return
    }
  }

  // 检查是否按下 / 且当前已在输入框开头
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // 只有在输入框开头或刚有空格后按 / 才触发
    if (val === '' || val.endsWith(' ')) {
      // 延迟一帧等待字符输入
      requestAnimationFrame(() => {
        commandFilter.value = ''
        selectedCommandIndex.value = 0
        showCommandPalette.value = true
      })
      return
    }
  }

  // 清除命令面板（非 / 开头时）
  if (showCommandPalette.value) {
    const slashIdx = val.lastIndexOf('/')
    if (slashIdx >= 0) {
      commandFilter.value = val.slice(slashIdx + 1)
    } else {
      closeCommandPalette()
    }
  }

  // Enter 发送
  if (e.key === 'Enter') {
    send()
  }
}

function selectCommand(cmd) {
  userInput.value = cmd.name + ' '
  showCommandPalette.value = false
  commandFilter.value = ''
  inputRef.value?.focus()
}

function closeCommandPalette() {
  showCommandPalette.value = false
  commandFilter.value = ''
}

// 点击外部关闭命令面板
function onDocumentClick(e) {
  if (showCommandPalette.value && !e.target.closest('.command-palette') && !e.target.closest('.input-bar input')) {
    closeCommandPalette()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})

// ── 主题切换 ──
const theme = ref(localStorage.getItem('theme') || 'dark')

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('theme', theme.value)
}

const showSettings = ref(false)
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

// ── Onboarding 事件 ──

async function onOnboardingCreateProject(pName, pPath) {
  try {
    const p = await db.createProject(pName, pPath)
    projects.value.push(p)
    selectProject(p)
  } catch (err) {
    console.error('[Onboarding] Failed to create project:', err)
  }
}

function onOnboardingSelectAgent(aName) {
  selectedAgent.value = aName
  localStorage.setItem('settings_defaultAgent', aName)
}

function onOnboardingFinished() {
  localStorage.setItem('onboarding_done', 'true')
  loadProjects()
  // 引导完成后后台快速初始化项目
  setTimeout(async () => {
    if (currentProject.value?.id) {
      try { await db.quickInit(currentProject.value.id) } catch (e) { console.warn('[QuickInit]', e) }
    }
  }, 500)
}


// ── Mission 模式状态 ──
const expandedTask = ref(null)
const taskLogs = ref({})
const taskFilter = ref('')
const taskStatusFilter = ref('')
const filteredTasks = computed(() => {
  let list = tasks.value
  if (taskStatusFilter.value) {
    list = list.filter(t => t.status === taskStatusFilter.value)
  }
  if (taskFilter.value.trim()) {
    const q = taskFilter.value.trim().toLowerCase()
    list = list.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
  }
  return list
})
const showApproveButton = ref(false)
const showSummarizeButton = ref(false)
const showSuggestion = ref(false)
const showTemplatePanel = ref(false)
const showSaveTemplate = ref(false)
const templates = ref([])
const templateName = ref('')
const templateDesc = ref('')
const suggestionPaused = ref(false)

// ── Agent 与模式 ──
const agents = ref([])
// Phase 7 #40: 从 localStorage 恢复上次选择的 Agent 和模式
const selectedAgent = ref(localStorage.getItem('settings_defaultAgent') || null)
const selectedMode = ref(localStorage.getItem('settings_defaultMode') || '对话')
const modes = ['对话', 'PM 拆解', 'YOLO', '审批', '逐步', '预览', '代码审查']

// Phase 7 #40: Agent/模式选择变化时持久化到 localStorage
watch(selectedAgent, (val) => {
  if (val) localStorage.setItem('settings_defaultAgent', val)
})
watch(selectedMode, (val) => {
  if (val) localStorage.setItem('settings_defaultMode', val)
})

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
  sessionTokenUsage.value = null
  sessions.value = await db.listSessions(p.id)
  tasks.value = await db.listTasks(p.id)
  // Phase 7 #33: 选择项目时初始化 Agent 记忆目录
  if (p.path && db.initAgentDirs) {
    db.initAgentDirs(p.path).catch((err) => console.warn('[Project] Failed to init agent dirs:', err))
  }
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
  if (!confirm('确定要删除此项目？所有对话和任务将一并删除，此操作不可撤销。')) return
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
  // M4: 获取 Token 消耗
  await loadTokenUsage(s.id)
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
  if (!confirm('确定要删除此对话？此操作不可撤销。')) return
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

  // 代码审查模式：弹出文件选择器，不直接发送
  if (selectedMode.value === '代码审查') {
    await openFileSelector()
    return
  }

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
    // M3: 收集 deltas
    if (data?.event?._sender?.context?.deltas) {
      collectDiffs(data.event._sender.context.deltas)
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
      // Issue #34: 聊天模式不弹系统通知
      if (!CHAT_MODES.includes(selectedMode.value)) {
        if (data?.event?.event === 'completion') {
          notification?.send('AgentRouter', t('notification.completed', { agent: selectedAgent.value }))
        } else {
          notification?.send('AgentRouter', t('notification.error', { agent: selectedAgent.value, error: formatError(data?.event?.data?.error) }))
        }
      }
    }
  })

  try {
    await agent.exec(selectedAgent.value, cmd, currentSession.value.id, currentProject.value?.id, selectedMode.value)
  } catch (err) {
    reply += `\n[错误] ${formatError(err.message || err)}`
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

  // M4: 获取 Token 消耗
  await loadTokenUsage(currentSession.value.id)

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

// ── Issue #19: 任务模板 ──
async function loadTemplates() {
  try {
    templates.value = await window.taskTemplate.list()
  } catch (e) {
    templates.value = []
  }
}
async function saveTemplate() {
  const name = templateName.value.trim()
  if (!name) return
  const desc = templateDesc.value.trim()
  const taskData = JSON.stringify(tasks.value.map(t => ({
    title: t.title, assignee: t.assignee, description: t.description
  })))
  try {
    await window.taskTemplate.create(name, desc, taskData)
    templateName.value = ''
    templateDesc.value = ''
    showSaveTemplate.value = false
    await loadTemplates()
  } catch (e) {
    console.error('[Template] Save failed:', e)
  }
}
async function deleteTemplate(id) {
  if (!confirm('确定要删除此模板？')) return
  try {
    await window.taskTemplate.delete(id)
    await loadTemplates()
  } catch (e) {
    console.error('[Template] Delete failed:', e)
  }
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
        } catch (err) {
          await db.updateTask(task.id, { status: 'completed' })
          notification?.send('AgentRouter', `任务 "${task.title}" 执行出错: ${err?.message || '未知错误'}`)
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
  if (allDone && tasks.value.length > 0) {
    notification?.send('AgentRouter', '所有任务执行完成，请查看汇总')
  }
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
    notification?.send('AgentRouter', `汇总出错: ${err.message || '未知错误'}`)
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

  // 首次引导：projects 为空且未完成过引导时自动弹出
  const onboardingDone = localStorage.getItem('onboarding_done')
  if (projects.value.length === 0 && !onboardingDone) {
    showOnboarding.value = true
  }
  if (agent) {
    agent.onStatus((s) => {
      const st = typeof s === 'string' ? s : s.status || 'offline'
      // completed/killed 表示执行结束，恢复到 online 让输入框可用
      agentStatus.value = (st === 'completed' || st === 'killed') ? 'online' : st
    })
    try {
      // Phase 7 #46: 使用含健康状态的列表
      if (agent.listWithHealth) {
        agents.value = await agent.listWithHealth() || []
      } else {
        agents.value = await agent.list() || []
      }
    } catch (_) {
      agents.value = [{ name: 'codewhale', label: 'CodeWhale', health: null }]
    }
    // Phase 7 #46: 启动时对所有 Agent 执行健康检查（不阻塞）
    if (agent.checkHealth) {
      agent.checkHealth().then(healthResults => {
        if (healthResults && Array.isArray(healthResults)) {
          for (const h of healthResults) {
            const existing = agents.value.find(a => a.name === h.agentName)
            if (existing) existing.health = h
          }
        }
      }).catch((err) => console.warn('[Health] Check failed:', err))
    }
    // Phase 7 #40: 恢复上次选择的 Agent；如果 localStorage 无值或已不存在，回退到第一个
    const savedAgent = localStorage.getItem('settings_defaultAgent')
    if (savedAgent && agents.value.some(a => a.name === savedAgent)) {
      selectedAgent.value = savedAgent
    } else if (agents.value.length > 0) {
      selectedAgent.value = agents.value[0].name || agents.value[0]
      localStorage.setItem('settings_defaultAgent', selectedAgent.value)
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
    // Phase 7 #48: 监听启动进度
    if (agent.onStartup) {
      agent.onStartup((data) => {
        if (data && typeof data === 'object') {
          const d = data
          startupPhase.value = d.phase || ''
          startupMessage.value = d.message || ''
        }
      })
    }
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
.layout { height: 100vh; }

/* ═══ Pane 高度约束 — 防止 flex 溢出推走输入框 ═══ */
.main-pane, .sidebar-pane {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.main-pane > .main {
  flex: 1;
  min-height: 0;
}

/* ═══ Splitpanes 自定义样式 ═══ */
.splitpanes__splitter {
  background: var(--color-border);
  position: relative;
  transition: background var(--transition);
}
.splitpanes--vertical > .splitpanes__splitter {
  width: 4px;
  min-width: 4px;
}
.splitpanes__splitter:hover {
  background: var(--color-accent);
}
.splitpanes__pane {
  overflow: hidden;
  transition: background var(--transition);
}
.splitpanes__splitter::after {
  display: none;
}

/* ═══ 侧边栏 ═══ */
.sidebar {
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  transition: background var(--transition), border-color var(--transition);
  overflow: hidden;
}
.sidebar-left { min-width: 200px; }
.sidebar-right {
  border-right: none;
  border-left: 1px solid var(--color-border);
  min-width: 250px;
}
/* ═══ 右侧面板标签 ═══ */
.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  transition: border-color var(--transition);
  flex-shrink: 0;
}
.sidebar-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  transition: all var(--transition);
  position: relative;
}
.sidebar-tab:hover {
  color: var(--color-text);
  background: var(--bg-sidebar-hover);
}
.sidebar-tab.active {
  color: var(--color-accent);
}
.sidebar-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--color-accent);
  border-radius: 1px;
}
.tab-badge {
  font-size: 10px;
  font-weight: 700;
  background: var(--color-accent);
  color: #fff;
  border-radius: 8px;
  padding: 0 5px;
  line-height: 16px;
  min-width: 16px;
  text-align: center;
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

/* 右侧 Diff 面板容器 */
.sidebar-diff-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.sidebar-diff-body > * {
  flex: 1;
}
.sidebar-diff-body .diff-empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted);
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
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--bg-main); transition: background var(--transition); }

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
.messages { flex: 1; overflow-y: auto; padding: 16px 20px; min-height: 0; }
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
.first-message-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  margin: 0 8px 4px;
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--bg-msg-reasoning);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  opacity: 0.7;
}
.first-message-hint svg {
  flex-shrink: 0;
  color: var(--color-reasoning);
}
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

/* ═══ 斜杠命令面板 ═══ */
.command-palette {
  position: absolute;
  bottom: 100%;
  left: 16px;
  right: 16px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--bg-dialog);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-dialog);
  z-index: 50;
  margin-bottom: 4px;
}
.command-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background var(--transition);
  border-bottom: 1px solid var(--color-border);
}
.command-item:last-child { border-bottom: none; }
.command-item:hover,
.command-item.highlight {
  background: var(--bg-sidebar-hover);
}
.command-item.highlight {
  border-left: 3px solid var(--color-accent);
}
.cmd-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-accent);
  min-width: 60px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}
.cmd-desc {
  font-size: 12px;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cmd-detail {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-left: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}
.command-empty {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted);
}

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
.task-filter-bar {
  display: flex; gap: 4px; padding: 6px 8px;
  border-bottom: 1px solid var(--color-border);
}
.task-filter-input {
  flex: 1; padding: 4px 6px; font-size: 11px;
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  background: var(--bg-input); color: var(--color-text); outline: none;
}
.task-filter-input:focus { border-color: var(--color-accent); }
.task-filter-select {
  width: 72px; padding: 4px; font-size: 11px;
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  background: var(--bg-input); color: var(--color-text); outline: none;
}
.template-bar {
  display: flex; gap: 4px; padding: 4px 8px;
  border-top: 1px solid var(--color-border);
}
.template-toggle, .template-save-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 4px; font-size: 10px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: var(--bg-input);
  color: var(--color-text-secondary); cursor: pointer;
}
.template-toggle:hover, .template-save-btn:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-text); }
.template-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.template-panel { padding: 4px 8px; border-top: 1px solid var(--color-border); }
.template-save-form { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.template-save-form input {
  padding: 4px 6px; font-size: 11px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: var(--bg-input); color: var(--color-text); outline: none;
}
.template-item {
  padding: 6px 4px; border-bottom: 1px solid var(--color-border);
  cursor: pointer; transition: background var(--transition);
}
.template-item:hover { background: var(--bg-sidebar-hover); }
.template-item-header { display: flex; justify-content: space-between; align-items: center; }
.template-item-name { font-size: 12px; font-weight: 600; color: var(--color-text); }
.template-item-desc { font-size: 10px; color: var(--color-text-muted); margin: 2px 0 0; }
.template-delete-btn {
  background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 10px; padding: 2px;
}
.template-delete-btn:hover { color: #f44336; }
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

/* ═══ 文件选择器（代码审查） ═══ */
.file-selector-dialog {
  width: 520px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.file-selector-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
}
.file-selector-search {
  margin-bottom: 8px;
}
.file-selector-search input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--bg-dialog-input);
  color: var(--color-text);
  font-size: 13px;
  outline: none;
}
.file-selector-search input:focus {
  border-color: var(--color-accent);
}
.file-selector-list {
  flex: 1;
  overflow-y: auto;
  max-height: 320px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
}
.file-selector-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  cursor: pointer;
  font-size: 12px;
  transition: background var(--transition);
  border-bottom: 1px solid var(--color-border);
}
.file-selector-item:last-child {
  border-bottom: none;
}
.file-selector-item:hover {
  background: var(--bg-sidebar-hover);
}
.file-selector-item.dir {
  cursor: default;
  color: var(--color-text-muted);
  font-weight: 600;
}
.file-selector-item input[type="checkbox"] {
  accent-color: var(--color-accent);
  flex-shrink: 0;
}
.file-sel-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  color: var(--color-text-muted);
}
.file-sel-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text);
}
.file-selector-empty {
  padding: 20px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 12px;
}
.file-selector-focus {
  margin-top: 10px;
}
.file-selector-focus label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.file-selector-focus textarea {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--bg-dialog-input);
  color: var(--color-text);
  font-size: 12px;
  outline: none;
  resize: vertical;
  font-family: inherit;
}
.file-selector-focus textarea:focus {
  border-color: var(--color-accent);
}
.file-sel-count {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-right: auto;
}

/* ═══ 代码审查：接受/拒绝按钮 ═══ */
.review-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--color-border);
}
.btn-review-accept,
.btn-review-reject {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--bg-input);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition);
}
.btn-review-accept:hover {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}
.btn-review-reject:hover {
  border-color: #f44336;
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
}
.review-result {
  font-size: 11px;
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}
.review-result.accepted {
  color: #4caf50;
  background: rgba(76, 175, 80, 0.08);
}
.review-result.rejected {
  color: #f44336;
  background: rgba(244, 67, 54, 0.08);
}

/* ═══ Token 计费 ═══ */
.msg-tokens {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
  padding: 4px 0;
  font-size: 10px;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
}
.msg-tokens span {
  white-space: nowrap;
}
.msg-tokens-total {
  font-weight: 600;
  color: var(--color-text-secondary);
}
.msg-tokens-model {
  margin-left: auto;
  font-style: italic;
}

.status-tokens {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  margin-right: 8px;
  font-size: 11px;
  color: var(--color-text-muted);
  cursor: help;
}
.status-tokens svg {
  opacity: 0.5;
}

/* Token 侧边栏 */
.sidebar-token-body {
  flex: 1;
  overflow-y: auto;
  font-size: 12px;
  color: var(--color-text);
}
.token-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}
.token-stats {
  padding: 12px;
}
.token-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border);
}
.token-row:last-child {
  border-bottom: none;
}
.token-label {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.token-value {
  font-weight: 600;
  font-size: 12px;
  color: var(--color-text);
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}
.token-total {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 2px solid var(--color-border);
}
.token-total .token-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}
.token-total .token-value {
  font-size: 14px;
  color: var(--color-accent);
}
.token-model {
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-text-muted);
  font-style: italic;
}
.token-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 12px;
}

</style>
