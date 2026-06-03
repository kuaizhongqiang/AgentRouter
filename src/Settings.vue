<template>
  <div class="dialog-overlay" v-if="modelValue" @click.self="close">
    <div class="settings-modal" @click.stop>
      <div class="settings-header">
        <h3>{{ $t('settings.title') }}</h3>
        <button class="icon-btn" @click="close">✕</button>
      </div>
      <div class="settings-body">
        <div class="setting-row">
          <label>{{ $t('settings.defaultAgent') }}</label>
          <select v-model="localSettings.defaultAgent">
            <option v-for="a in agents" :key="a.name" :value="a.name">{{ a.label || a.name }}</option>
          </select>
        </div>
        <div class="setting-row">
          <label>{{ $t('settings.defaultMode') }}</label>
          <select v-model="localSettings.defaultMode">
            <option v-for="m in modes" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div class="setting-row">
          <label>{{ $t('settings.language') }}</label>
          <select v-model="localSettings.language">
            <option value="zh-CN">{{ $t('settings.langZh') }}</option>
            <option value="en-US">{{ $t('settings.langEn') }}</option>
          </select>
        </div>
        <div class="setting-row">
          <label>{{ $t('settings.theme') }}</label>
          <div class="theme-options">
            <button
              class="theme-option"
              :class="{ active: localSettings.theme === 'dark' }"
              @click="setTheme('dark')"
            >{{ $t('settings.themeDark') }}</button>
            <button
              class="theme-option"
              :class="{ active: localSettings.theme === 'light' }"
              @click="setTheme('light')"
            >{{ $t('settings.themeLight') }}</button>
          </div>
        </div>
      </div>
      <div class="settings-footer">
        <button @click="close">{{ $t('settings.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const props = defineProps<{
  modelValue: boolean
  agents: any[]
  modes: string[]
  currentTheme: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:theme': [value: string]
}>()

const localSettings = ref({
  defaultAgent: localStorage.getItem('settings_defaultAgent') || '',
  defaultMode: localStorage.getItem('settings_defaultMode') || '对话',
  language: localStorage.getItem('settings_language') || 'zh-CN',
  theme: props.currentTheme
})

function setTheme(theme: string) {
  localSettings.value.theme = theme
  emit('update:theme', theme)
}

function close() {
  emit('update:modelValue', false)
}

watch(() => localSettings.value.defaultAgent, (v) => {
  localStorage.setItem('settings_defaultAgent', v)
})

watch(() => localSettings.value.defaultMode, (v) => {
  localStorage.setItem('settings_defaultMode', v)
})

watch(() => localSettings.value.language, (v) => {
  localStorage.setItem('settings_language', v)
  locale.value = v
})
</script>

<style scoped>
.settings-modal {
  background: var(--bg-dialog);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  width: 440px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-dialog);
  transition: background var(--transition), border-color var(--transition);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.settings-header h3 {
  font-size: 16px;
  color: var(--color-text);
}

.settings-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.setting-row label {
  font-size: 13px;
  color: var(--color-text);
  font-weight: 500;
  min-width: 100px;
}

.setting-row select {
  flex: 1;
  max-width: 240px;
  padding: 7px 10px;
  font-size: 13px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--bg-dialog-input);
  color: var(--color-text);
  outline: none;
  cursor: pointer;
  transition: all var(--transition);
}

.setting-row select:focus {
  border-color: var(--color-accent);
}

.theme-options {
  display: flex;
  gap: 6px;
}

.theme-option {
  padding: 6px 16px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition);
}

.theme-option:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.theme-option.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.settings-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
}

.settings-footer button {
  padding: 6px 20px;
  font-size: 13px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition);
}

.settings-footer button:hover {
  border-color: var(--color-text-secondary);
  color: var(--color-text);
}
</style>
