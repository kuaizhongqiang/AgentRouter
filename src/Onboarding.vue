<template>
  <div class="dialog-overlay" v-if="modelValue" @click.self="skip">
    <div class="onboarding-modal" @click.stop>
      <!-- 步骤指示器 -->
      <div class="step-indicator">
        <span
          v-for="s in 4"
          :key="s"
          class="step-dot"
          :class="{ active: step === s, done: step > s }"
        ></span>
      </div>

      <!-- 步骤 1: 欢迎 -->
      <div v-if="step === 1" class="onboarding-step">
        <div class="onboarding-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/>
            <line x1="12" y1="12" x2="12" y2="16"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <h2>{{ $t('onboarding.welcome.title') }}</h2>
        <p class="onboarding-desc">{{ $t('onboarding.welcome.desc') }}</p>
        <div class="onboarding-features">
          <div class="feature-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/></svg>
            <span>{{ $t('onboarding.welcome.multiAgent') }}</span>
          </div>
          <div class="feature-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            <span>{{ $t('onboarding.welcome.taskSplitting') }}</span>
          </div>
          <div class="feature-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>{{ $t('onboarding.welcome.flexibleModes') }}</span>
          </div>
        </div>
      </div>

      <!-- 步骤 2: 创建项目 -->
      <div v-if="step === 2" class="onboarding-step">
        <div class="onboarding-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h3l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
          </svg>
        </div>
        <h2>{{ $t('onboarding.createProject.title') }}</h2>
        <p class="onboarding-desc">{{ $t('onboarding.createProject.desc') }}</p>
        <div class="onboarding-form">
          <label>{{ $t('onboarding.createProject.name') }}</label>
          <input v-model="projectName" :placeholder="$t('onboarding.createProject.name') + ' e.g. MyApp'" @keydown.enter="projectPath.length > 0 && next" />
          <label>{{ $t('onboarding.createProject.path') }}</label>
          <div class="path-input-row">
            <input v-model="projectPath" :placeholder="$t('onboarding.createProject.path') + ' e.g. D:/Projects/MyApp'" @keydown.enter="projectName && next" />
          </div>
          <p v-if="createError" class="onboarding-error">{{ createError }}</p>
        </div>
        <!-- API Key 配置（未配置时显示） -->
        <div v-if="!hasCredentials" class="onboarding-api-section">
          <div class="api-divider">
            <span>{{ $t('onboarding.apiKey.optional') }}</span>
          </div>
          <div class="onboarding-form">
            <label>{{ $t('onboarding.apiKey.key') }}</label>
            <input v-model="apiKey" type="password" :placeholder="'sk-...'" @keydown.enter="projectName && projectPath && next" />
            <label>{{ $t('onboarding.apiKey.baseUrl') }}</label>
            <input v-model="apiBaseUrl" :placeholder="'https://api.deepseek.com'" @keydown.enter="projectName && projectPath && next" />
          </div>
        </div>
      </div>

      <!-- 步骤 3: 选择 Agent -->
      <div v-if="step === 3" class="onboarding-step">
        <div class="onboarding-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h2>{{ $t('onboarding.selectAgent.title') }}</h2>
        <p class="onboarding-desc">{{ $t('onboarding.selectAgent.desc') }}</p>
        <div class="agent-grid">
          <div
            v-for="a in agents"
            :key="a.name"
            class="agent-option"
            :class="{ selected: selectedAgentName === a.name }"
            @click="selectedAgentName = a.name"
          >
            <span class="agent-option-icon">{{ (a.label || a.name).charAt(0).toUpperCase() }}</span>
            <span class="agent-option-name">{{ a.label || a.name }}</span>
            <span class="agent-option-tagline">{{ a.manifest?.tagline || '' }}</span>
          </div>
        </div>
      </div>

      <!-- 步骤 4: 首次对话 -->
      <div v-if="step === 4" class="onboarding-step">
        <div class="onboarding-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h2>{{ $t('onboarding.ready.title') }}</h2>
        <p class="onboarding-desc">{{ $t('onboarding.ready.desc', { project: projectName, agent: selectedAgentLabel }) }}</p>
        <div class="onboarding-tip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span v-html="$t('onboarding.ready.tip', { code: '<code>/</code>' })"></span>
        </div>
      </div>

      <!-- 底部导航 -->
      <div class="onboarding-nav">
        <button class="btn-skip" @click="skip">{{ $t('onboarding.skip') }}</button>
        <div class="nav-right">
          <button
            v-if="step > 1"
            class="btn-back"
            @click="step--"
          >{{ $t('onboarding.prev') }}</button>
          <button
            class="btn-next"
            :disabled="!canProceed"
            @click="next"
          >{{ step === 4 ? $t('onboarding.start') : $t('onboarding.next') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  agents: any[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'createProject': [name: string, path: string]
  'selectAgent': [name: string]
  'finished': []
}>()

const step = ref(1)
const projectName = ref('')
const projectPath = ref('')
const selectedAgentName = ref('')
const createError = ref('')
const apiKey = ref('')
const apiBaseUrl = ref('https://api.deepseek.com')
const savingCredentials = ref(false)

const hasCredentials = computed(() => {
  return !!(window as any).credentials?.get()?.apiKey
})

const selectedAgentLabel = computed(() => {
  const a = props.agents.find(a => a.name === selectedAgentName.value)
  return a?.label || a?.name || selectedAgentName.value
})

const canProceed = computed(() => {
  switch (step.value) {
    case 1: return true
    case 2: return projectName.value.trim().length > 0 && projectPath.value.trim().length > 0
    case 3: return selectedAgentName.value.length > 0
    case 4: return true
    default: return false
  }
})

function next() {
  if (!canProceed.value) return

  if (step.value === 2) {
    // 保存 API Key（如果有输入）
    if (apiKey.value.trim()) {
      savingCredentials.value = true
      try {
        (window as any).credentials?.set({ apiKey: apiKey.value.trim(), baseUrl: apiBaseUrl.value.trim() || 'https://api.deepseek.com' })
      } catch (e) {
        console.warn('[Onboarding] Failed to save credentials:', e)
      }
      savingCredentials.value = false
    }
    // 创建项目
    createError.value = ''
    emit('createProject', projectName.value.trim(), projectPath.value.trim())
  }

  if (step.value === 3) {
    emit('selectAgent', selectedAgentName.value)
  }

  if (step.value < 4) {
    step.value++
  } else {
    finish()
  }
}

function skip() {
  step.value = 1
  projectName.value = ''
  projectPath.value = ''
  selectedAgentName.value = ''
  createError.value = ''
  emit('update:modelValue', false)
  emit('finished')
}

function finish() {
  step.value = 1
  const name = projectName.value
  const path = projectPath.value
  projectName.value = ''
  projectPath.value = ''
  selectedAgentName.value = ''
  createError.value = ''
  emit('update:modelValue', false)
  emit('finished')
}

function reset() {
  step.value = 1
  projectName.value = ''
  projectPath.value = ''
  selectedAgentName.value = ''
  createError.value = ''
}

// 外部重置
defineExpose({ reset })
</script>

<style scoped>
.onboarding-modal {
  background: var(--bg-dialog);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  width: 520px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-dialog);
  transition: background var(--transition), border-color var(--transition);
}

.step-indicator {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 20px 20px 0;
}
.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border-strong);
  transition: all var(--transition);
}
.step-dot.active {
  background: var(--color-accent);
  box-shadow: 0 0 6px rgba(233, 69, 96, 0.4);
  transform: scale(1.3);
}
.step-dot.done {
  background: var(--color-accent);
  opacity: 0.5;
}

.onboarding-step {
  padding: 28px 32px 20px;
  text-align: center;
  flex: 1;
}
.onboarding-icon {
  margin-bottom: 16px;
}
.onboarding-step h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 12px;
}
.onboarding-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  max-width: 400px;
  margin: 0 auto 20px;
}

.onboarding-features {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  margin-top: 16px;
}
.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text);
}

.onboarding-form {
  text-align: left;
  max-width: 380px;
  margin: 0 auto;
}
.onboarding-form label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  margin-top: 12px;
}
.onboarding-form label:first-child {
  margin-top: 0;
}
.onboarding-form input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--bg-dialog-input);
  color: var(--color-text);
  font-size: 13px;
  outline: none;
  transition: all var(--transition);
}
.onboarding-form input:focus {
  border-color: var(--color-accent);
}

.path-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.path-input-row input {
  flex: 1;
}

.onboarding-api-section {
  margin-top: 8px;
  max-width: 380px;
  margin-left: auto;
  margin-right: auto;
}
.api-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0 8px;
}
.api-divider::before,
.api-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}
.api-divider span {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.onboarding-error {
  color: #f44336;
  font-size: 12px;
  margin-top: 8px;
}

.agent-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-width: 380px;
  margin: 0 auto;
}
.agent-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition);
  background: var(--bg-input);
}
.agent-option:hover {
  border-color: var(--color-accent);
  background: var(--bg-sidebar-hover);
}
.agent-option.selected {
  border-color: var(--color-accent);
  background: var(--bg-sidebar-active);
  box-shadow: 0 0 0 1px var(--color-accent);
}
.agent-option-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-accent);
  background: var(--bg-sidebar-hover);
}
.agent-option-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}
.agent-option-tagline {
  font-size: 10px;
  color: var(--color-text-muted);
}

.onboarding-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg-msg-reasoning);
  border: 1px solid rgba(124, 77, 255, 0.15);
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: left;
  margin: 0 auto;
  max-width: 380px;
}
.onboarding-tip code {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  color: var(--color-accent);
  font-size: 12px;
}
.onboarding-tip svg {
  flex-shrink: 0;
  color: var(--color-reasoning);
}

.onboarding-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
}
.nav-right {
  display: flex;
  gap: 8px;
}
.btn-skip {
  padding: 6px 14px;
  font-size: 12px;
  border: none;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition);
}
.btn-skip:hover {
  color: var(--color-text-secondary);
}
.btn-back {
  padding: 6px 16px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition);
}
.btn-back:hover {
  border-color: var(--color-text-secondary);
  color: var(--color-text);
}
.btn-next {
  padding: 6px 20px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #fff;
  cursor: pointer;
  transition: background var(--transition), opacity var(--transition);
}
.btn-next:hover:not(:disabled) {
  background: var(--color-accent-hover);
}
.btn-next:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
