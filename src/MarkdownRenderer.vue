<template>
  <div class="md-renderer" v-html="rendered"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

// 配置 marked：使用 highlight.js 做代码高亮
marked.setOptions({
  gfm: true,
  breaks: true,
  highlight(code: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch {}
    }
    // 无语言或未知语言：自动检测
    try {
      return hljs.highlightAuto(code).value
    } catch {}
    return code
  },
})

const props = defineProps<{
  content: string
}>()

const rendered = computed(() => {
  if (!props.content) return ''
  try {
    return marked(props.content)
  } catch {
    return props.content
  }
})
</script>

<style scoped>
.md-renderer {
  line-height: 1.7;
  font-size: 13px;
  word-break: break-word;
  overflow-wrap: break-word;
}
.md-renderer :deep(p) {
  margin: 0 0 8px;
}
.md-renderer :deep(p:last-child) {
  margin-bottom: 0;
}
.md-renderer :deep(strong) {
  font-weight: 700;
  color: var(--color-text);
}
.md-renderer :deep(code) {
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  padding: 1px 5px;
  background: var(--bg-msg-reasoning);
  border-radius: 3px;
  color: var(--color-accent);
}
.md-renderer :deep(pre) {
  margin: 8px 0;
  padding: 10px 12px;
  background: #1e1e2e;
  border-radius: var(--radius-md);
  overflow-x: auto;
}
.md-renderer :deep(pre code) {
  background: none;
  padding: 0;
  color: #cdd6f4;
  font-size: 12px;
  line-height: 1.5;
}
.md-renderer :deep(h1),
.md-renderer :deep(h2),
.md-renderer :deep(h3),
.md-renderer :deep(h4) {
  margin: 12px 0 6px;
  font-weight: 700;
  color: var(--color-text);
}
.md-renderer :deep(h1) { font-size: 16px; }
.md-renderer :deep(h2) { font-size: 15px; }
.md-renderer :deep(h3) { font-size: 14px; }
.md-renderer :deep(h4) { font-size: 13px; }
.md-renderer :deep(ul),
.md-renderer :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}
.md-renderer :deep(li) {
  margin: 2px 0;
}
.md-renderer :deep(blockquote) {
  margin: 8px 0;
  padding: 4px 10px;
  border-left: 3px solid var(--color-accent);
  color: var(--color-text-secondary);
  background: var(--bg-msg-reasoning);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.md-renderer :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12px;
  width: 100%;
}
.md-renderer :deep(th),
.md-renderer :deep(td) {
  border: 1px solid var(--color-border);
  padding: 4px 8px;
  text-align: left;
}
.md-renderer :deep(th) {
  background: var(--bg-msg-reasoning);
  font-weight: 600;
}
.md-renderer :deep(a) {
  color: var(--color-accent);
  text-decoration: none;
}
.md-renderer :deep(a:hover) {
  text-decoration: underline;
}
.md-renderer :deep(img) {
  max-width: 100%;
  border-radius: var(--radius-sm);
}
.md-renderer :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 12px 0;
}
</style>
