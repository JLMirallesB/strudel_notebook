<script setup lang="ts">
import { ref, watch } from 'vue'
import { parseGuidedTemplate, reconstructCode, checkQuiz, type Segment } from './guided-parser'
import { highlightStrudel } from './mininotation-highlighter'

const props = defineProps<{
  template: string
  autoEvaluate: boolean
  isQuiz: boolean
}>()

const emit = defineEmits<{
  'update:code': [code: string]
  'play': []
  'stop': []
}>()

const segments = ref<Segment[]>([])
const quizChecked = ref(false)
const quizResult = ref<{ correct: number; total: number } | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.template, (tmpl) => {
  if (tmpl) {
    const result = parseGuidedTemplate(tmpl)
    segments.value = result.segments
  }
}, { immediate: true })

function emitCode() {
  quizChecked.value = false
  quizResult.value = null
  // Reset quiz results on change
  for (const seg of segments.value) {
    if (seg.type === 'quiz' || seg.type === 'quiz-text') {
      seg.result = null
    }
  }
  emit('update:code', reconstructCode(segments.value))
}

function onDropdownChange(seg: Segment & { type: 'dropdown' | 'quiz' }, e: Event) {
  seg.selected = (e.target as HTMLSelectElement).value
  emitCode()
}

function onInputChange(seg: Segment & { type: 'placeholder' | 'quiz-text' }, e: Event) {
  seg.value = (e.target as HTMLInputElement).value
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => emitCode(), 200)
}

function checkAnswers() {
  quizResult.value = checkQuiz(segments.value)
  quizChecked.value = true
  // Force reactivity
  segments.value = [...segments.value]
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    emit('play')
  } else if ((e.ctrlKey || e.metaKey) && e.key === '.') {
    e.preventDefault()
    emit('stop')
  }
}

function highlightFragment(text: string): string {
  return highlightStrudel(text)
}

function quizClass(seg: { result?: 'correct' | 'incorrect' | null }): string {
  if (!seg.result) return ''
  return seg.result === 'correct' ? 'quiz-correct' : 'quiz-incorrect'
}
</script>

<template>
  <div class="guided-editor" @keydown="handleKeydown">
    <template v-for="seg in segments" :key="seg.type === 'static' ? seg.text : seg.id">
      <span
        v-if="seg.type === 'static'"
        class="guided-static"
        v-html="highlightFragment(seg.text)"
      ></span>
      <select
        v-else-if="seg.type === 'dropdown'"
        class="guided-dropdown"
        :value="seg.selected"
        @change="onDropdownChange(seg, $event)"
      >
        <option v-for="opt in seg.options" :key="opt" :value="opt">{{ opt }}</option>
      </select>
      <input
        v-else-if="seg.type === 'placeholder'"
        class="guided-input"
        type="text"
        :placeholder="seg.hint"
        :value="seg.value"
        :size="Math.max(seg.hint.length, seg.value.length, 4)"
        @input="onInputChange(seg, $event)"
      />
      <select
        v-else-if="seg.type === 'quiz'"
        class="guided-dropdown quiz-dropdown"
        :class="quizClass(seg)"
        :value="seg.selected"
        @change="onDropdownChange(seg, $event)"
      >
        <option value="" disabled>Elige...</option>
        <option v-for="opt in seg.options" :key="opt" :value="opt">{{ opt }}</option>
      </select>
      <input
        v-else-if="seg.type === 'quiz-text'"
        class="guided-input quiz-input"
        :class="quizClass(seg)"
        type="text"
        :placeholder="seg.hint"
        :value="seg.value"
        :size="Math.max(seg.hint.length, seg.value.length, 6)"
        @input="onInputChange(seg, $event)"
      />
    </template>
  </div>
  <div v-if="isQuiz" class="quiz-bar">
    <button class="quiz-check-btn" @click="checkAnswers">Comprobar</button>
    <span v-if="quizChecked && quizResult" class="quiz-result" :class="quizResult.correct === quizResult.total ? 'quiz-pass' : 'quiz-fail'">
      {{ quizResult.correct === quizResult.total ? '✓ Correcto!' : `${quizResult.correct}/${quizResult.total} correctas` }}
    </span>
  </div>
</template>

<style scoped>
.guided-editor {
  padding: 16px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 14px;
  line-height: 2;
  white-space: pre-wrap;
  word-wrap: break-word;
  min-height: 60px;
  color: #e0e0e0;
}

.guided-dropdown {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  background: rgba(99, 102, 241, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(99, 102, 241, 0.4);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  vertical-align: baseline;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%236366f1'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 4px center;
  padding-right: 16px;
}

.guided-dropdown:hover {
  border-color: rgba(99, 102, 241, 0.7);
  background-color: rgba(99, 102, 241, 0.25);
}

.guided-dropdown:focus, .guided-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);
}

.guided-input {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  background: rgba(52, 211, 153, 0.1);
  color: #e0e0e0;
  border: 1px dashed rgba(52, 211, 153, 0.5);
  border-radius: 4px;
  padding: 2px 6px;
  vertical-align: baseline;
}

.guided-input:focus {
  border-style: solid;
  border-color: rgba(52, 211, 153, 0.8);
  box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.3);
}

.guided-input::placeholder {
  color: rgba(160, 160, 160, 0.5);
  font-style: italic;
}

/* Quiz-specific styles */
.quiz-dropdown {
  background-color: rgba(251, 191, 36, 0.1);
  border-color: rgba(251, 191, 36, 0.4);
}

.quiz-input {
  background-color: rgba(251, 191, 36, 0.1);
  border-color: rgba(251, 191, 36, 0.4);
}

.quiz-correct {
  border-color: #22c55e !important;
  background-color: rgba(34, 197, 94, 0.15) !important;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
}

.quiz-incorrect {
  border-color: #ef4444 !important;
  background-color: rgba(239, 68, 68, 0.15) !important;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3);
}

.quiz-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-top: 1px solid #334155;
  background: #1a1a2e;
}

.quiz-check-btn {
  padding: 6px 16px;
  background: #f59e0b;
  color: #000;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Space Grotesk', sans-serif;
  transition: background 0.2s;
}

.quiz-check-btn:hover {
  background: #d97706;
}

.quiz-result {
  font-size: 14px;
  font-weight: 600;
}

.quiz-pass {
  color: #22c55e;
}

.quiz-fail {
  color: #f59e0b;
}

/* Syntax highlighting */
:deep(.hl-function) { color: #c084fc; font-weight: 500; }
:deep(.hl-method) { color: #a78bfa; }
:deep(.hl-string) { color: #fbbf24; }
:deep(.hl-number) { color: #f472b6; }
:deep(.hl-comment) { color: #6b7280; font-style: italic; }
:deep(.hl-keyword) { color: #f472b6; }
:deep(.hl-bracket) { color: #60a5fa; font-weight: bold; }
:deep(.hl-operator) { color: #f87171; font-weight: bold; }
:deep(.hl-rest) { color: #6b7280; }
:deep(.hl-alt) { color: #34d399; font-weight: bold; }
:deep(.hl-comma) { color: #9ca3af; }
:deep(.hl-note) { color: #4ade80; font-weight: 500; }
:deep(.hl-sample) { color: #fcd34d; }
:deep(.hl-paren) { color: #9ca3af; }
:deep(.hl-op) { color: #f472b6; }
</style>
