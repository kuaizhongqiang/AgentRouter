<template>
  <div class="diff-panel">
    <div class="diff-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <span>{{ $t('diff.title') }}</span>
      <span class="diff-count">{{ diffs.length }}</span>
    </div>

    <div v-if="diffs.length === 0" class="diff-empty">
      {{ $t('diff.empty') }}
    </div>

    <template v-else>
      <!-- 文件列表 -->
      <div class="diff-file-list">
        <div
          v-for="(d, i) in diffs"
          :key="d.file + i"
          class="diff-file-item"
          :class="{ active: selectedIndex === i }"
          @click="selectedIndex = i"
        >
          <span class="diff-file-type" :class="'type-' + d.type">
            {{ { added: 'A', modified: 'M', deleted: 'D', renamed: 'R' }[d.type] || d.type.charAt(0).toUpperCase() }}
          </span>
          <span class="diff-file-name" :title="d.file">{{ basename(d.file) }}</span>
          <span class="diff-file-path">{{ dirname(d.file) }}</span>
        </div>
      </div>

      <!-- Diff 详情 -->
      <div class="diff-view" v-if="currentDiff">
        <div class="diff-file-header">
          <span class="diff-file-header-path">{{ currentDiff.file }}</span>
          <span class="diff-file-header-type" :class="'type-' + currentDiff.type">
            {{ { added: $t('diff.fileAdded'), modified: $t('diff.fileModified'), deleted: $t('diff.fileDeleted'), renamed: $t('diff.fileRenamed') }[currentDiff.type] || currentDiff.type }}
          </span>
        </div>

        <div class="diff-content" v-if="renderedLines.length > 0">
          <div
            v-for="(line, i) in renderedLines"
            :key="i"
            class="diff-line"
            :class="line.cls"
          >
            <span class="diff-line-num ln-old">{{ line.oldNum || '' }}</span>
            <span class="diff-line-num ln-new">{{ line.newNum || '' }}</span>
            <span class="diff-line-prefix">{{ line.prefix }}</span>
            <span class="diff-line-text">{{ line.text }}</span>
          </div>
        </div>
        <div v-else class="diff-empty">{{ $t('diff.noContent') }}</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import * as diff from 'diff'

const props = defineProps<{
  diffs: Array<{ file: string; type: string; diff?: string }>
}>()

const selectedIndex = ref(0)

const currentDiff = computed(() => {
  if (props.diffs.length === 0) return null
  const idx = Math.min(selectedIndex.value, props.diffs.length - 1)
  return props.diffs[idx]
})

interface DiffLine {
  cls: string
  oldNum: string
  newNum: string
  prefix: string
  text: string
}

const renderedLines = computed(() => {
  const d = currentDiff.value
  if (!d) return []

  // 计算 diff 文本
  let patchText = d.diff || ''
  if (!patchText) {
    // 没有原始 diff 时生成虚拟 diff（仅显示文件变更类型信息）
    patchText = generatePlaceholderDiff(d)
  }

  return parsePatch(patchText)
})

function basename(p: string) {
  return p.replace(/\\/g, '/').split('/').pop() || p
}

function dirname(p: string) {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') : ''
}

function generatePlaceholderDiff(d: { file: string; type: string; diff?: string }): string {
  const oldHeader = d.type === 'added' ? '/dev/null' : `a/${d.file}`
  const newHeader = d.type === 'deleted' ? '/dev/null' : `b/${d.file}`
  const oldTime = '1970-01-01 00:00:00.000000000 +0000'
  const newTime = oldTime

  let oldContent = `--- ${oldHeader}\n`
  let newContent = `+++ ${newHeader}\n`

  if (d.type === 'added') {
    const lines = [
      `@@ -0,0 +1,2 @@`,
      `+// File added: ${d.file}`,
      `+// Check raw diff data for full changes`,
    ]
    return oldContent + newContent + lines.join('\n') + '\n'
  } else if (d.type === 'deleted') {
    return (
      oldContent +
      newContent +
      `@@ -1,2 +0,0 @@\n` +
      `-// File deleted: ${d.file}\n` +
      `-// Check raw diff data for full changes\n`
    )
  } else {
    return (
      oldContent +
      newContent +
      `@@ -1,1 +1,2 @@\n` +
      `  // 文件已变更: ${d.file}\n` +
      `+// 请查看原始 diff 数据获取详细变更内容\n`
    )
  }
}

function parsePatch(patch: string): DiffLine[] {
  const lines = patch.split('\n')
  const result: DiffLine[] = []

  // 跳过文件头（---/+++）
  let i = 0
  while (i < lines.length && (lines[i].startsWith('---') || lines[i].startsWith('+++') || lines[i].startsWith('diff ') || lines[i].startsWith('index '))) {
    i++
  }

  let oldLineNum = 0
  let newLineNum = 0

  for (; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    if (line.startsWith('@@')) {
      // hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldLineNum = parseInt(match[1]) - 1
        newLineNum = parseInt(match[2]) - 1
      }
      result.push({ cls: 'diff-hunk', oldNum: '', newNum: '', prefix: '', text: line })
      continue
    }

    if (line.startsWith('+')) {
      newLineNum++
      result.push({ cls: 'diff-added', oldNum: '', newNum: String(newLineNum), prefix: '+', text: line.slice(1) })
    } else if (line.startsWith('-')) {
      oldLineNum++
      result.push({ cls: 'diff-removed', oldNum: String(oldLineNum), newNum: '', prefix: '-', text: line.slice(1) })
    } else if (line.startsWith('\\')) {
      // No newline at end of file
      result.push({ cls: 'diff-info', oldNum: '', newNum: '', prefix: '', text: line.slice(2) })
    } else {
      oldLineNum++
      newLineNum++
      result.push({ cls: 'diff-context', oldNum: String(oldLineNum), newNum: String(newLineNum), prefix: ' ', text: line })
    }
  }

  return result
}
</script>

<style scoped>
.diff-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 12px;
  color: var(--color-text);
}

.diff-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.diff-count {
  margin-left: auto;
  background: var(--color-accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 8px;
  line-height: 16px;
}

.diff-empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted);
}

/* 文件列表 */
.diff-file-list {
  flex-shrink: 0;
  max-height: 160px;
  overflow-y: auto;
  border-bottom: 1px solid var(--color-border);
}
.diff-file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background var(--transition);
}
.diff-file-item:hover {
  background: var(--bg-sidebar-hover);
}
.diff-file-item.active {
  background: var(--bg-sidebar-active);
  border-left: 2px solid var(--color-accent);
}
.diff-file-type {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
  width: 18px;
  text-align: center;
  line-height: 16px;
}
.diff-file-type.type-added,
.diff-file-type.type-A {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
}
.diff-file-type.type-modified,
.diff-file-type.type-M {
  background: rgba(255, 152, 0, 0.15);
  color: #ff9800;
}
.diff-file-type.type-deleted,
.diff-file-type.type-D {
  background: rgba(244, 67, 54, 0.15);
  color: #f44336;
}
.diff-file-type.type-renamed,
.diff-file-type.type-R {
  background: rgba(33, 150, 243, 0.15);
  color: #2196f3;
}
.diff-file-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.diff-file-path {
  font-size: 10px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: auto;
}

/* Diff 视图 */
.diff-view {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.diff-file-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-inset);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 1;
}
.diff-file-header-path {
  font-size: 11px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  color: var(--color-text);
  word-break: break-all;
}
.diff-file-header-type {
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
}
.diff-file-header-type.type-added { background: rgba(76, 175, 80, 0.15); color: #4caf50; }
.diff-file-header-type.type-modified { background: rgba(255, 152, 0, 0.15); color: #ff9800; }
.diff-file-header-type.type-deleted { background: rgba(244, 67, 54, 0.15); color: #f44336; }

.diff-content {
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
  line-height: 1.5;
}

.diff-line {
  display: flex;
  padding: 0 8px;
  min-height: 20px;
  align-items: stretch;
}

.diff-line-num {
  display: inline-block;
  width: 36px;
  text-align: right;
  padding-right: 8px;
  color: var(--color-text-muted);
  user-select: none;
  font-size: 10px;
  line-height: 20px;
  flex-shrink: 0;
}

.diff-line-prefix {
  display: inline-block;
  width: 14px;
  text-align: center;
  font-weight: 700;
  flex-shrink: 0;
  line-height: 20px;
}

.diff-line-text {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 20px;
  padding-left: 4px;
}

/* diff 行的着色 */
.diff-line.diff-added {
  background: rgba(76, 175, 80, 0.1);
}
.diff-line.diff-added .diff-line-prefix {
  color: #4caf50;
}

.diff-line.diff-removed {
  background: rgba(244, 67, 54, 0.1);
}
.diff-line.diff-removed .diff-line-prefix {
  color: #f44336;
}

.diff-line.diff-context {
  background: transparent;
}
.diff-line.diff-context .diff-line-prefix {
  color: var(--color-text-muted);
}

.diff-line.diff-hunk {
  background: rgba(33, 150, 243, 0.08);
  color: #2196f3;
  font-weight: 600;
  font-size: 10px;
}
.diff-line.diff-hunk .diff-line-text {
  color: #2196f3;
}

.diff-line.diff-info {
  background: transparent;
  color: var(--color-text-muted);
  font-style: italic;
  font-size: 10px;
}
</style>
