import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

const savedLang = localStorage.getItem('settings_language') || 'zh-CN'

const i18n = createI18n({
  locale: savedLang,
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

const app = createApp(App)
app.use(i18n)
app.mount('#app')

export { i18n }
