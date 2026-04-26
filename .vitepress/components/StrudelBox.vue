<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { highlightStrudel } from './mininotation-highlighter'
import type { HighlightLocation, SliderWidget } from './audio/engine'

const props = defineProps<{
  code?: string
}>()

const slots = defineSlots()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const highlightRef = ref<HTMLDivElement | null>(null)
const isActive = ref(false)
const isLoading = ref(false)
const isFocused = ref(false)
const copied = ref(false)
const errorMessage = ref('')
const codeContent = ref('')

// Menus
const showRecMenu = ref(false)
const showCodeMenu = ref(false)
const midiCycles = ref(4)

// Recording state
type RecMode = 'midi' | 'audio' | null
type RecState = 'idle' | 'armed' | 'recording'
const recMode = ref<RecMode>(null)
const recState = ref<RecState>('idle')

// Estado de carga de samples
const samplesLoading = ref(false)
const samplesLoaded = ref(0)
const samplesTotal = ref(0)
const currentSampleFile = ref('')

// Estado de highlight en tiempo real
const activeLocations = ref<HighlightLocation[]>([])

// Widgets
const widgets = ref<SliderWidget[]>([])

let unsubscribeLoading: (() => void) | null = null
let unsubscribeHighlight: (() => void) | null = null

const highlightedCode = computed(() => {
  return highlightStrudel(codeContent.value)
})

watch([activeLocations, highlightRef], () => {
  if (!highlightRef.value || !isActive.value) return
  updateActiveHighlights()
}, { deep: true })

function updateActiveHighlights() {
  if (!highlightRef.value) return
  highlightRef.value.querySelectorAll('.hl-active').forEach(el => {
    el.classList.remove('hl-active')
  })
  if (activeLocations.value.length === 0) return
  const spans = highlightRef.value.querySelectorAll('[data-start][data-end]')
  for (const span of spans) {
    const spanStart = parseInt(span.getAttribute('data-start') || '0', 10)
    const spanEnd = parseInt(span.getAttribute('data-end') || '0', 10)
    for (const loc of activeLocations.value) {
      if (spanStart < loc.end && spanEnd > loc.start) {
        span.classList.add('hl-active')
        break
      }
    }
  }
}

function addAnalyzer(code: string): string {
  return code.includes('.analyze(') ? code : code.trim() + '.analyze(1)'
}

// --- Recording ---
function armRecording(mode: RecMode) {
  recMode.value = mode
  if (isActive.value) {
    startRecordingNow()
  } else {
    recState.value = 'armed'
  }
  showRecMenu.value = false
}

async function startRecordingNow() {
  const engine = await import('./audio/engine')
  recState.value = 'recording'
  if (recMode.value === 'midi') {
    engine.startRecording()
  } else if (recMode.value === 'audio') {
    await engine.startAudioRecording()
  }
}

async function stopRecordingAndDownload() {
  const engine = await import('./audio/engine')
  if (recMode.value === 'midi') {
    const { haps, duration, cps } = engine.stopRecording()
    const { downloadMidi } = await import('./midi-export')
    downloadMidi(haps, duration, cps)
  } else if (recMode.value === 'audio') {
    engine.stopAudioRecording()
  }
  recState.value = 'idle'
  recMode.value = null
}

function cancelRecording() {
  recState.value = 'idle'
  recMode.value = null
}

async function handleRecButton() {
  if (recState.value === 'recording') {
    await stopRecordingAndDownload()
  } else if (recState.value === 'armed') {
    cancelRecording()
  } else {
    showRecMenu.value = !showRecMenu.value
  }
}

async function exportMidiCycles() {
  try {
    const { queryPattern, getCps } = await import('./audio/engine')
    const { downloadMidi } = await import('./midi-export')
    const haps = queryPattern(0, midiCycles.value)
    downloadMidi(haps, midiCycles.value, getCps())
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  showRecMenu.value = false
}

// --- Play / Stop / Reload ---
async function play() {
  errorMessage.value = ''
  isLoading.value = true

  try {
    const engine = await import('./audio/engine')
    engine.resumeAudio()
    engine.stop()

    document.querySelectorAll('.strudel-box').forEach(box => {
      box.classList.remove('is-active')
    })

    const code = textareaRef.value?.value || codeContent.value
    await engine.evaluate(addAnalyzer(code))
    widgets.value = engine.getWidgets()
    isActive.value = true

    if (recState.value === 'armed') {
      await startRecordingNow()
    }
  } catch (error) {
    console.error('[StrudelBox] Play error:', error)
    errorMessage.value = error instanceof Error ? error.message : String(error)
    isActive.value = false
  } finally {
    isLoading.value = false
  }
}

async function stop() {
  if (recState.value === 'recording') {
    await stopRecordingAndDownload()
  } else {
    cancelRecording()
  }
  try {
    const { stop: engineStop } = await import('./audio/engine')
    engineStop()
  } catch (error) {
    console.error('[StrudelBox] Stop error:', error)
  }
  isActive.value = false
  errorMessage.value = ''
  activeLocations.value = []
  widgets.value = []
}

async function reload() {
  if (!isActive.value) return
  errorMessage.value = ''
  try {
    const { reEvaluate, getWidgets } = await import('./audio/engine')
    const code = textareaRef.value?.value || codeContent.value
    await reEvaluate(addAnalyzer(code))
    widgets.value = getWidgets()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

// --- Code export ---
async function copyCode() {
  try {
    await navigator.clipboard.writeText(codeContent.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    downloadCode()
  }
  showCodeMenu.value = false
}

function downloadCode() {
  const blob = new Blob([codeContent.value], { type: 'text/plain' })
  const link = document.createElement('a')
  link.download = `strudel-${Date.now()}.txt`
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
  showCodeMenu.value = false
}

// --- Widgets ---
function widgetLabel(widget: SliderWidget): string {
  const before = codeContent.value.slice(0, widget.from)
  const match = before.match(/\.(\w+)\s*\(\s*$/)
  if (match) return match[1]
  const funcMatch = before.match(/(\w+)\s*\(\s*$/)
  if (funcMatch) return funcMatch[1]
  return 'slider'
}

async function handleSliderChange(widget: SliderWidget, newValue: number) {
  const newValueStr = String(newValue)
  const code = codeContent.value
  codeContent.value = code.slice(0, widget.from) + newValueStr + code.slice(widget.to)
  try {
    const { reEvaluate, getWidgets } = await import('./audio/engine')
    await reEvaluate(addAnalyzer(codeContent.value))
    widgets.value = getWidgets()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

// --- Focus ---
function toggleFocus() {
  isFocused.value = !isFocused.value
  document.body.style.overflow = isFocused.value ? 'hidden' : ''
}

// --- Keyboard ---
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFocused.value) {
    e.preventDefault()
    toggleFocus()
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    if (isActive.value) reload()
    else play()
  } else if ((e.ctrlKey || e.metaKey) && e.key === '.') {
    e.preventDefault()
    stop()
  }
}

function syncScroll() {
  if (textareaRef.value && highlightRef.value) {
    highlightRef.value.scrollTop = textareaRef.value.scrollTop
    highlightRef.value.scrollLeft = textareaRef.value.scrollLeft
  }
}

// Close menus on outside click
function closeMenus(e: Event) {
  const target = e.target as HTMLElement
  if (!target.closest('.rec-menu-wrap')) showRecMenu.value = false
  if (!target.closest('.code-menu-wrap')) showCodeMenu.value = false
}

onMounted(async () => {
  if (props.code) {
    codeContent.value = props.code.trim()
  } else if (slots.default) {
    const slotContent = slots.default()
    if (slotContent[0]?.children) {
      codeContent.value = String(slotContent[0].children).trim()
    }
  }

  document.addEventListener('click', closeMenus)

  try {
    const engine = await import('./audio/engine')
    engine.beginInitialization()

    unsubscribeLoading = engine.onLoadingStateChange((state) => {
      samplesLoading.value = state.isLoading
      samplesLoaded.value = state.loaded
      samplesTotal.value = state.total
      currentSampleFile.value = state.currentFile
    })

    unsubscribeHighlight = engine.onHighlightEvent((event) => {
      if (isActive.value) {
        activeLocations.value = event.locations
      }
    })
  } catch (e) {
    // SSR
  }
})

onUnmounted(() => {
  document.body.style.overflow = ''
  document.removeEventListener('click', closeMenus)
  if (unsubscribeLoading) unsubscribeLoading()
  if (unsubscribeHighlight) unsubscribeHighlight()
})
</script>

<template>
  <div class="strudel-box" :class="{ 'is-active': isActive, 'has-error': errorMessage, 'is-focused': isFocused }">
    <div v-if="samplesLoading" class="loading-bar">
      <div class="loading-bar-progress" :style="{ width: `${(samplesLoaded / samplesTotal) * 100}%` }"></div>
      <span class="loading-bar-text">
        Cargando samples ({{ samplesLoaded }}/{{ samplesTotal }})
        <span v-if="currentSampleFile" class="loading-file">{{ currentSampleFile }}</span>
      </span>
    </div>
    <div class="strudel-box-header">
      <button class="play-btn" @click="play" :disabled="isLoading || samplesLoading">
        {{ isLoading ? '⏳' : '▶' }} Play
      </button>
      <button class="stop-btn" @click="stop">■ Stop</button>
      <button v-if="isActive" class="reload-btn" @click="reload" title="Recargar (Ctrl+Enter)">↻</button>

      <!-- Rec button -->
      <div class="rec-menu-wrap">
        <button
          class="rec-toggle-btn"
          :class="{ 'is-armed': recState === 'armed', 'is-recording': recState === 'recording' }"
          @click.stop="handleRecButton"
          :title="recState === 'recording' ? 'Parar grabación' : recState === 'armed' ? 'Cancelar' : 'Grabar'"
        >
          {{ recState === 'recording' ? `⏹ ${recMode === 'midi' ? 'MIDI' : 'Audio'}` : recState === 'armed' ? `⏺ ${recMode === 'midi' ? 'MIDI' : 'Audio'}` : '⏺ Rec ▾' }}
        </button>
        <div v-if="showRecMenu && recState === 'idle'" class="sb-popover">
          <button @click.stop="armRecording('audio')">⏺ Grabar Audio</button>
          <button @click.stop="armRecording('midi')">⏺ Grabar MIDI</button>
          <div class="popover-divider"></div>
          <div class="popover-row">
            <label>MIDI <select v-model.number="midiCycles" @click.stop>
              <option v-for="n in [1,2,4,8,16,32]" :key="n" :value="n">{{ n }}c</option>
            </select></label>
            <button @click.stop="exportMidiCycles">Exportar</button>
          </div>
        </div>
      </div>

      <!-- Code menu -->
      <div class="code-menu-wrap">
        <button class="code-toggle-btn" @click.stop="showCodeMenu = !showCodeMenu" title="Código">
          {{ copied ? '✓' : '⧉ ▾' }}
        </button>
        <div v-if="showCodeMenu" class="sb-popover">
          <button @click.stop="copyCode">⧉ Copiar código</button>
          <button @click.stop="downloadCode">↓ Descargar .txt</button>
        </div>
      </div>

      <button class="focus-btn" @click="toggleFocus" :title="isFocused ? 'Salir (Esc)' : 'Focus'">
        {{ isFocused ? '✕' : '⛶' }}
      </button>
      <span v-if="isActive" class="active-indicator">♪</span>
    </div>
    <div class="editor-container">
      <div
        ref="highlightRef"
        class="highlight-layer"
        v-html="highlightedCode + '\n'"
        aria-hidden="true"
      ></div>
      <textarea
        ref="textareaRef"
        :value="codeContent"
        @input="(e) => { codeContent = (e.target as HTMLTextAreaElement).value; errorMessage = '' }"
        @scroll="syncScroll"
        @keydown="handleKeydown"
        spellcheck="false"
        class="code-textarea"
      />
    </div>
    <div v-if="widgets.length > 0" class="widget-panel">
      <div v-for="(w, i) in widgets" :key="i" class="widget-slider">
        <label class="widget-label">{{ widgetLabel(w) }}</label>
        <input
          type="range"
          :min="w.min"
          :max="w.max"
          :step="w.step || (w.max - w.min) / 100"
          :value="parseFloat(w.value)"
          @input="(e) => handleSliderChange(w, parseFloat((e.target as HTMLInputElement).value))"
        />
        <span class="widget-value">{{ parseFloat(w.value).toFixed(2) }}</span>
      </div>
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<style scoped>
.loading-bar {
  position: relative;
  height: 24px;
  background: #1a1a2e;
  border-radius: 4px 4px 0 0;
  overflow: hidden;
}

.loading-bar-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #4f46e5, #7c3aed);
  transition: width 0.3s ease;
}

.loading-bar-text {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 0.75rem;
  color: #e0e0e0;
  z-index: 1;
  gap: 0.5rem;
}

.loading-file {
  opacity: 0.7;
  font-family: monospace;
  font-size: 0.7rem;
}

/* Editor con syntax highlighting */
.editor-container {
  position: relative;
  min-height: 120px;
}

.highlight-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: auto;
  pointer-events: none;
  color: #e0e0e0;
}

.code-textarea {
  position: relative;
  width: 100%;
  min-height: 120px;
  padding: 16px;
  border: none;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  background: transparent;
  resize: vertical;
  color: transparent;
  caret-color: #fff;
}

.code-textarea::selection {
  background: rgba(99, 102, 241, 0.4);
}

.code-textarea:focus {
  outline: none;
}

.has-error .code-textarea {
  border-color: #ef4444;
}

/* Widget panel */
.widget-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 16px;
  background: #1a1a2e;
  border-top: 1px solid #334155;
}

.widget-slider {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;
  flex: 1;
}

.widget-label {
  font-size: 0.75rem;
  color: #a78bfa;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 500;
  min-width: 50px;
}

.widget-slider input[type="range"] {
  flex: 1;
  height: 4px;
  accent-color: #7c3aed;
  cursor: pointer;
}

.widget-value {
  font-size: 0.75rem;
  color: #94a3b8;
  font-family: 'IBM Plex Mono', monospace;
  min-width: 40px;
  text-align: right;
}

.error-message {
  color: #ef4444;
  font-size: 0.875rem;
  padding: 0.5rem;
  background: #fef2f2;
  border-top: 1px solid #fecaca;
  font-family: monospace;
  white-space: pre-wrap;
}

/* Dropdown menus */
.rec-menu-wrap,
.code-menu-wrap {
  position: relative;
}

.sb-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: #1e293b;
  border: 1px solid #475569;
  border-radius: 8px;
  padding: 6px;
  z-index: 50;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 160px;
}

.sb-popover button {
  background: transparent;
  color: #e2e8f0;
  border: none;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  font-family: 'Space Grotesk', sans-serif;
}

.sb-popover button:hover {
  background: #334155;
}

.popover-divider {
  height: 1px;
  background: #334155;
  margin: 4px 0;
}

.popover-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
}

.popover-row label {
  color: #94a3b8;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.popover-row select {
  background: #334155;
  color: #e2e8f0;
  border: none;
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 12px;
}

.popover-row button {
  background: #3b82f6 !important;
  color: white !important;
  border-radius: 4px !important;
  padding: 4px 10px !important;
}

.popover-row button:hover {
  background: #2563eb !important;
}

/* Syntax highlighting colors */
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

:deep(.hl-active) {
  background: rgba(99, 102, 241, 0.4);
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.6);
  animation: pulse-glow 0.3s ease-out;
}

@keyframes pulse-glow {
  0% { background: rgba(99, 102, 241, 0.8); box-shadow: 0 0 16px rgba(99, 102, 241, 0.9); }
  100% { background: rgba(99, 102, 241, 0.4); box-shadow: 0 0 8px rgba(99, 102, 241, 0.6); }
}
</style>
