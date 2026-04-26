<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { withBase } from 'vitepress'
import { highlightStrudel } from './mininotation-highlighter'
import GuidedEditor from './GuidedEditor.vue'
import { parseGuidedTemplate } from './guided-parser'
import { snippetLibrary } from './snippets'
import { getAlternatives } from './strudel-taxonomy'
import type { HighlightLocation, SliderWidget } from './audio/engine'

const props = defineProps<{
  code?: string
  mode?: 'guided' | 'quiz'
  snippets?: boolean
  interchange?: boolean
  autoplay?: boolean
  tall?: boolean
  initialNotes?: string
  initialHistory?: any[]
}>()

const slots = defineSlots()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const highlightRef = ref<HTMLDivElement | null>(null)
const isActive = ref(false)
const isLoading = ref(false)
const isFocused = ref(false)
const copied = ref(false)
const showNotes = ref(false)
const showLineNumbers = ref(false)
const wordWrap = ref(false)
const showHistory = ref(false)
const autoSnapshot = ref(false)
const notes = ref('')
const errorMessage = ref('')

// History
type Snapshot = { time: string; code: string; notes: string; label: string; auto: boolean }
const snapshots = ref<Snapshot[]>([])
const selectedSnapshot = ref(-1)
const historyPlaying = ref(false)
let historyTimer: ReturnType<typeof setInterval> | null = null
let historyKey = ''
const codeContent = ref('')
const rawTemplate = ref('')
const isGuided = computed(() => props.mode === 'guided' || props.mode === 'quiz')
const isQuiz = computed(() => props.mode === 'quiz')

// Menus
const showRecMenu = ref(false)
const showCodeMenu = ref(false)
const showEditorMenu = ref(false)
const showProcessMenu = ref(false)
const showSnippets = ref(false)
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
  const html = highlightStrudel(codeContent.value)
  if (!showLineNumbers.value) return html
  const lines = html.split('\n')
  const pad = String(lines.length).length
  return lines.map((line, i) => {
    const num = String(i + 1).padStart(pad, ' ')
    return `<span class="line-num">${num}</span>${line}`
  }).join('\n')
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
    if (autoSnapshot.value) addSnapshot(true)

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
    if (autoSnapshot.value) addSnapshot(true)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

// --- Guided mode ---
async function onGuidedCodeChange(code: string) {
  codeContent.value = code
  if (isActive.value) {
    try {
      const { reEvaluate, getWidgets } = await import('./audio/engine')
      await reEvaluate(addAnalyzer(code))
      widgets.value = getWidgets()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
    }
  }
}

// --- Code export ---
async function copyCode() {
  try {
    await navigator.clipboard.writeText(codeWithNotes())
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    downloadCode()
  }
  showCodeMenu.value = false
}

async function shareLink() {
  const payload = notes.value.trim()
    ? JSON.stringify({ code: codeContent.value, notes: notes.value })
    : codeContent.value
  const encoded = encodeURIComponent(btoa(payload))
  const url = window.location.origin + withBase('/play') + '#code=' + encoded
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {}
  showCodeMenu.value = false
}

function downloadCode() {
  const blob = new Blob([codeWithNotes()], { type: 'text/plain' })
  const link = document.createElement('a')
  link.download = `strudel-${Date.now()}.txt`
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
  showCodeMenu.value = false
}

// --- Interchange ---
const interchangePopup = ref<{ x: number; y: number; original: string; alternatives: string[]; start: number; end: number } | null>(null)

function handleInterchangeClick() {
  if (!props.interchange || !textareaRef.value || !highlightRef.value) {
    console.log('[Interchange] skip: interchange=', props.interchange, 'textarea=', !!textareaRef.value, 'highlight=', !!highlightRef.value)
    return
  }
  const pos = textareaRef.value.selectionStart
  console.log('[Interchange] click at pos:', pos, 'code:', codeContent.value.slice(Math.max(0, pos - 3), pos + 3))

  const spans = highlightRef.value.querySelectorAll('[data-start][data-end]')
  console.log('[Interchange] spans found:', spans.length)

  for (const span of spans) {
    const start = parseInt(span.getAttribute('data-start') || '0', 10)
    const end = parseInt(span.getAttribute('data-end') || '0', 10)
    if (pos >= start && pos < end) {
      const text = span.textContent || ''
      const clean = text.replace(/^\./, '')
      const alts = getAlternatives(clean)
      console.log('[Interchange] match:', text, 'clean:', clean, 'alts:', alts)
      if (!alts || alts.length === 0) break

      const rect = (span as HTMLElement).getBoundingClientRect()

      interchangePopup.value = {
        x: rect.left,
        y: rect.bottom + 4,
        original: text,
        alternatives: alts.map(a => text.startsWith('.') ? `.${a}` : a),
        start,
        end,
      }
      console.log('[Interchange] popup:', interchangePopup.value)
      return
    }
  }
  console.log('[Interchange] no match at pos', pos)
  interchangePopup.value = null
}

function applyInterchange(replacement: string) {
  console.log('[Interchange] apply:', replacement, 'popup:', !!interchangePopup.value)
  if (!interchangePopup.value) return
  const { start, end } = interchangePopup.value
  const code = codeContent.value
  codeContent.value = code.slice(0, start) + replacement + code.slice(end)
  interchangePopup.value = null
  nextTick(() => textareaRef.value?.focus())
  if (isActive.value) reload()
}

// --- History ---
function initHistory() {
  historyKey = 'strudel-history-' + btoa(codeContent.value.slice(0, 50)).slice(0, 20)
  if (props.initialHistory && props.initialHistory.length > 0) {
    snapshots.value = props.initialHistory
    showHistory.value = true
    saveHistory()
  } else {
    const saved = localStorage.getItem(historyKey)
    if (saved) {
      try { snapshots.value = JSON.parse(saved) } catch {}
    }
  }
}

function saveHistory() {
  if (historyKey) localStorage.setItem(historyKey, JSON.stringify(snapshots.value))
}

function addSnapshot(isAuto: boolean, label = '') {
  const now = new Date()
  const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const last = snapshots.value[snapshots.value.length - 1]
  if (last && last.code === codeContent.value) return
  snapshots.value.push({ time, code: codeContent.value, notes: notes.value, label, auto: isAuto })
  saveHistory()
}

function manualSnapshot() {
  const label = prompt('Etiqueta del snapshot (opcional):') || ''
  addSnapshot(false, label)
}

function selectSnapshot(i: number) {
  selectedSnapshot.value = i
}

function restoreSnapshot(i: number) {
  const s = snapshots.value[i]
  if (!s) return
  codeContent.value = s.code
  notes.value = s.notes
  if (isActive.value) reload()
}

async function previewSnapshot(i: number) {
  const s = snapshots.value[i]
  if (!s) return
  try {
    const { reEvaluate } = await import('./audio/engine')
    await reEvaluate(addAnalyzer(s.code))
  } catch {}
}

function playHistory() {
  if (historyPlaying.value) {
    stopHistoryPlayback()
    return
  }
  if (snapshots.value.length === 0) return
  historyPlaying.value = true
  selectedSnapshot.value = 0
  previewSnapshot(0)
  historyTimer = setInterval(() => {
    if (selectedSnapshot.value < snapshots.value.length - 1) {
      selectedSnapshot.value++
      previewSnapshot(selectedSnapshot.value)
    } else {
      stopHistoryPlayback()
    }
  }, 3000)
}

function stopHistoryPlayback() {
  historyPlaying.value = false
  if (historyTimer) { clearInterval(historyTimer); historyTimer = null }
}

function clearHistory() {
  if (!confirm('¿Borrar todo el historial?')) return
  snapshots.value = []
  selectedSnapshot.value = -1
  saveHistory()
}

function exportHistory() {
  const data = JSON.stringify({ snapshots: snapshots.value }, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const link = document.createElement('a')
  link.download = `strudel-history-${Date.now()}.json`
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
}

function diffLines(prev: string, curr: string): { line: string; type: 'same' | 'add' | 'del' }[] {
  const pLines = prev.split('\n')
  const cLines = curr.split('\n')
  const result: { line: string; type: 'same' | 'add' | 'del' }[] = []
  const max = Math.max(pLines.length, cLines.length)
  for (let i = 0; i < max; i++) {
    if (i >= pLines.length) {
      result.push({ line: cLines[i], type: 'add' })
    } else if (i >= cLines.length) {
      result.push({ line: pLines[i], type: 'del' })
    } else if (pLines[i] !== cLines[i]) {
      result.push({ line: pLines[i], type: 'del' })
      result.push({ line: cLines[i], type: 'add' })
    } else {
      result.push({ line: pLines[i], type: 'same' })
    }
  }
  return result
}

// --- Notes ---
let notesKey = ''

function initNotes() {
  notesKey = 'strudel-notes-' + btoa(codeContent.value.slice(0, 50)).slice(0, 20)
  if (props.initialNotes) {
    notes.value = props.initialNotes
    showNotes.value = true
    saveNotes()
  } else {
    const saved = localStorage.getItem(notesKey)
    if (saved) {
      notes.value = saved
      showNotes.value = true
    }
  }
}

function saveNotes() {
  if (notesKey) localStorage.setItem(notesKey, notes.value)
}

function codeWithNotes(): string {
  const code = codeContent.value
  if (!notes.value.trim()) return code
  const commentedNotes = notes.value.trim().split('\n').map(l => '// ' + l).join('\n')
  return code + '\n\n' + commentedNotes
}

// --- Snippets ---
function insertSnippet(code: string) {
  codeContent.value = code
  showSnippets.value = false
  if (isActive.value) reload()
}

// --- Widgets ---
function widgetLabel(widget: SliderWidget): string {
  const before = codeContent.value.slice(0, widget.from)
  let name = 'param'
  const m = before.match(/\.(\w+)\s*\(\s*slider\s*\(\s*$/)
  if (m) name = m[1]
  else {
    const f = before.match(/(\w+)\s*\(\s*slider\s*\(\s*$/)
    if (f) name = f[1]
    else {
      const d = before.match(/\.(\w+)\s*\(\s*$/)
      if (d) name = d[1]
    }
  }
  const line = before.split('\n').length
  return `L${line} ${name}`
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
  if (!target.closest('.editor-menu-wrap')) showEditorMenu.value = false
  if (!target.closest('.process-menu-wrap')) showProcessMenu.value = false
  if (!target.closest('.snippet-menu-wrap')) showSnippets.value = false
  if (!target.closest('.interchange-popup')) {
    interchangePopup.value = null
  }
}

onMounted(async () => {
  let rawText = ''
  if (props.code) {
    rawText = props.code.trim()
  } else if (slots.default) {
    const slotContent = slots.default()
    if (slotContent[0]?.children) {
      rawText = String(slotContent[0].children).trim()
    }
  }

  if (isGuided.value) {
    rawTemplate.value = rawText
    codeContent.value = parseGuidedTemplate(rawText).initialCode
  } else {
    codeContent.value = rawText
  }

  initNotes()
  initHistory()
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

watch(() => props.autoplay, (val) => {
  if (val && codeContent.value && !isActive.value) {
    play()
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

      <!-- Code/Export menu -->
      <div class="code-menu-wrap">
        <button class="menu-btn" @click.stop="showCodeMenu = !showCodeMenu" title="Exportar">
          {{ copied ? '✓' : '⧉ ▾' }}
        </button>
        <div v-if="showCodeMenu" class="sb-popover">
          <button @click.stop="copyCode">⧉ Copiar código</button>
          <button @click.stop="downloadCode">↓ Descargar .txt</button>
          <button @click.stop="shareLink">🔗 Compartir link</button>
          <button v-if="snapshots.length > 0" @click.stop="exportHistory">📋 Exportar historial</button>
        </div>
      </div>

      <!-- Editor tools menu -->
      <div class="editor-menu-wrap">
        <button class="menu-btn" @click.stop="showEditorMenu = !showEditorMenu" title="Editor">⚙ ▾</button>
        <div v-if="showEditorMenu" class="sb-popover">
          <button @click.stop="showLineNumbers = !showLineNumbers">{{ showLineNumbers ? '✓' : '　' }} Números de línea</button>
          <button @click.stop="wordWrap = !wordWrap">{{ wordWrap ? '✓' : '　' }} Ajuste de línea</button>
          <div v-if="props.snippets" class="popover-divider"></div>
          <button v-if="props.snippets" @click.stop="showEditorMenu = false; showSnippets = !showSnippets">{ } Snippets</button>
        </div>
      </div>

      <!-- Snippets panel (separate from editor menu) -->
      <div v-if="props.snippets && showSnippets" class="snippet-menu-wrap">
        <div class="snippet-panel">
          <div v-for="cat in snippetLibrary" :key="cat.name" class="snippet-category">
            <div class="snippet-cat-name">{{ cat.name }}</div>
            <button
              v-for="s in cat.snippets"
              :key="s.name"
              class="snippet-item"
              @click.stop="insertSnippet(s.code)"
              :title="s.code"
            >{{ s.name }}</button>
          </div>
        </div>
      </div>

      <!-- Process menu -->
      <div class="process-menu-wrap">
        <button class="menu-btn" @click.stop="showProcessMenu = !showProcessMenu" title="Proceso">📋 ▾</button>
        <div v-if="showProcessMenu" class="sb-popover">
          <button @click.stop="showProcessMenu = false; showNotes = !showNotes">📝 {{ showNotes ? 'Cerrar notas' : 'Notas' }}</button>
          <button @click.stop="showProcessMenu = false; showHistory = !showHistory">🕐 Historial {{ snapshots.length > 0 ? '(' + snapshots.length + ')' : '' }}</button>
          <button @click.stop="showProcessMenu = false; manualSnapshot()">📌 Guardar snapshot</button>
        </div>
      </div>

      <button class="focus-btn" @click="toggleFocus" :title="isFocused ? 'Salir (Esc)' : 'Focus'">
        {{ isFocused ? '✕' : '⛶' }}
      </button>
      <span v-if="isActive" class="active-indicator">♪</span>
    </div>
    <!-- Free mode editor -->
    <div v-if="!isGuided" class="editor-container">
      <div
        ref="highlightRef"
        class="highlight-layer"
        :class="{ 'interchange-mode': props.interchange, 'with-linenums': showLineNumbers, 'word-wrap': wordWrap }"
        v-html="highlightedCode + '\n'"
        aria-hidden="true"
      ></div>
      <textarea
        ref="textareaRef"
        :value="codeContent"
        @input="(e) => { codeContent = (e.target as HTMLTextAreaElement).value; errorMessage = '' }"
        @scroll="syncScroll"
        @keydown="handleKeydown"
        @click="handleInterchangeClick"
        spellcheck="false"
        class="code-textarea"
        :class="{ 'code-textarea-tall': props.tall, 'with-linenums': showLineNumbers, 'word-wrap': wordWrap }"
      />
    </div>
    <!-- Guided mode editor -->
    <GuidedEditor
      v-else
      :template="rawTemplate"
      :auto-evaluate="isActive"
      :is-quiz="isQuiz"
      @update:code="onGuidedCodeChange"
      @play="isActive ? reload() : play()"
      @stop="stop()"
    />
    <div v-if="widgets.length > 0" class="widget-panel">
      <div v-for="(w, i) in widgets" :key="i" class="widget-row">
        <span class="widget-label">.{{ widgetLabel(w) }}(</span>
        <input
          type="range"
          :min="w.min"
          :max="w.max"
          :step="w.step || (w.max - w.min) / 200"
          :value="parseFloat(w.value)"
          @input="(e) => handleSliderChange(w, parseFloat((e.target as HTMLInputElement).value))"
        />
        <span class="widget-value">{{ parseFloat(w.value).toFixed(w.max >= 100 ? 0 : 2) }}</span>
        <span class="widget-range">{{ w.min }}–{{ w.max }}</span>
        <span class="widget-label">)</span>
      </div>
    </div>
    <div v-if="showNotes" class="notes-panel">
      <textarea
        class="notes-textarea"
        v-model="notes"
        @input="saveNotes"
        placeholder="Escribe tus notas, reflexiones o ideas sobre este patrón..."
      ></textarea>
    </div>
    <div v-if="showHistory" class="history-panel">
      <div class="history-toolbar">
        <button class="history-play-btn" @click="playHistory">{{ historyPlaying ? '⏹' : '▶' }} {{ historyPlaying ? 'Parar' : 'Reproducir evolución' }}</button>
        <label class="history-auto-label"><input type="checkbox" v-model="autoSnapshot" /> Auto</label>
        <button v-if="snapshots.length > 0" class="history-clear-btn" @click="clearHistory">Borrar</button>
      </div>
      <div v-if="snapshots.length === 0" class="history-empty">Sin snapshots. Pulsa Play o 📌 para guardar.</div>
      <div v-else class="history-timeline">
        <div
          v-for="(s, i) in snapshots"
          :key="i"
          class="timeline-dot"
          :class="{ selected: selectedSnapshot === i, auto: s.auto, manual: !s.auto }"
          @click="selectSnapshot(i)"
          :title="s.time + (s.label ? ' — ' + s.label : '')"
        ></div>
      </div>
      <div v-if="selectedSnapshot >= 0 && snapshots[selectedSnapshot]" class="history-detail">
        <div class="history-meta">
          <span class="history-time">{{ snapshots[selectedSnapshot].time }}</span>
          <span v-if="snapshots[selectedSnapshot].label" class="history-label">{{ snapshots[selectedSnapshot].label }}</span>
          <span class="history-type">{{ snapshots[selectedSnapshot].auto ? 'auto' : 'manual' }}</span>
          <button class="history-restore-btn" @click="restoreSnapshot(selectedSnapshot)">Restaurar</button>
          <button class="history-listen-btn" @click="previewSnapshot(selectedSnapshot)">🔊</button>
        </div>
        <div class="history-diff">
          <div
            v-for="(d, j) in diffLines(selectedSnapshot > 0 ? snapshots[selectedSnapshot - 1].code : '', snapshots[selectedSnapshot].code)"
            :key="j"
            class="diff-line"
            :class="d.type"
          >{{ d.line || ' ' }}</div>
        </div>
      </div>
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
  <div
    v-if="interchangePopup"
    class="interchange-popup"
    :style="{ left: interchangePopup.x + 'px', top: interchangePopup.y + 'px' }"
  >
    <button
      v-for="alt in interchangePopup.alternatives"
      :key="alt"
      @mousedown.prevent.stop="applyInterchange(alt)"
    >{{ alt }}</button>
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

:deep(.line-num) {
  color: #475569;
  margin-right: 12px;
  user-select: none;
  display: inline-block;
  min-width: 1.5em;
  text-align: right;
}

.with-linenums {
  padding-left: 8px !important;
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
  white-space: pre;
  overflow: auto;
  pointer-events: none;
  color: #e0e0e0;
}

.highlight-layer.word-wrap {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.code-textarea {
  position: relative;
  z-index: 1;
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
  white-space: pre;
  overflow-x: auto;
}

.code-textarea.word-wrap {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: hidden;
}

.code-textarea-tall {
  min-height: 300px;
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
  flex-direction: column;
  gap: 4px;
  padding: 8px 16px;
  background: #1a1a2e;
  border-top: 1px solid #334155;
}

.widget-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.widget-label {
  font-size: 0.8rem;
  color: #a78bfa;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 500;
  white-space: nowrap;
}

.widget-row input[type="range"] {
  flex: 1;
  height: 4px;
  accent-color: #7c3aed;
  cursor: pointer;
  min-width: 100px;
}

.widget-value {
  font-size: 0.8rem;
  color: #e0e0e0;
  font-family: 'IBM Plex Mono', monospace;
  min-width: 45px;
  text-align: right;
  font-weight: 600;
}

.widget-range {
  font-size: 0.65rem;
  color: #64748b;
  font-family: 'IBM Plex Mono', monospace;
  white-space: nowrap;
}

/* History */
.history-panel {
  border-top: 1px solid #334155;
  background: var(--vp-c-bg-soft);
  padding: 10px 16px;
}

.history-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.history-play-btn {
  padding: 4px 12px;
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.history-auto-label {
  font-size: 12px;
  color: var(--vp-c-text-2);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.history-clear-btn {
  margin-left: auto;
  padding: 3px 10px;
  background: transparent;
  color: var(--vp-c-text-3);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.history-empty {
  text-align: center;
  color: var(--vp-c-text-3);
  font-size: 13px;
  padding: 12px;
}

.history-timeline {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
  overflow-x: auto;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s;
}

.timeline-dot.auto {
  background: #475569;
}

.timeline-dot.manual {
  background: #3b82f6;
}

.timeline-dot.selected {
  background: #22c55e;
  transform: scale(1.5);
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
}

.timeline-dot:hover {
  transform: scale(1.3);
}

.history-detail {
  margin-top: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  overflow: hidden;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--vp-c-bg-mute);
  font-size: 12px;
}

.history-time {
  color: var(--vp-c-text-1);
  font-weight: 600;
  font-family: 'IBM Plex Mono', monospace;
}

.history-label {
  color: var(--vp-c-brand-1);
  font-style: italic;
}

.history-type {
  color: var(--vp-c-text-3);
  font-size: 10px;
  text-transform: uppercase;
}

.history-restore-btn {
  margin-left: auto;
  padding: 2px 10px;
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.history-listen-btn {
  padding: 2px 8px;
  background: transparent;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.history-diff {
  max-height: 150px;
  overflow-y: auto;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.diff-line {
  padding: 0 10px;
  white-space: pre-wrap;
}

.diff-line.add {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.diff-line.del {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.diff-line.same {
  color: var(--vp-c-text-2);
}

/* Notes */
.notes-panel {
  border-top: 1px solid #334155;
  background: var(--vp-c-bg-soft);
}

.notes-textarea {
  width: 100%;
  min-height: 80px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-1);
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
}

.notes-textarea:focus {
  outline: none;
  background: rgba(99, 102, 241, 0.03);
}

.notes-textarea::placeholder {
  color: var(--vp-c-text-3);
  font-style: italic;
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

/* Interchange mode */
.highlight-layer.interchange-mode :deep([data-start]) {
  border-bottom: 1px dotted rgba(251, 191, 36, 0.4);
}

</style>
