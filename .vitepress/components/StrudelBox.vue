<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { highlightStrudel, highlightStrudelWithMeta, type StringLocation } from './mininotation-highlighter'
import type { HighlightLocation } from './audio/engine'

const props = defineProps<{
  code?: string
}>()

const slots = defineSlots()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const highlightRef = ref<HTMLDivElement | null>(null)
const isActive = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const codeContent = ref('')

// Estado de carga de samples
const samplesLoading = ref(false)
const samplesLoaded = ref(0)
const samplesTotal = ref(0)
const currentSampleFile = ref('')

// Estado de highlight en tiempo real
const activeLocations = ref<HighlightLocation[]>([])
const stringLocations = ref<StringLocation[]>([])

let unsubscribeLoading: (() => void) | null = null
let unsubscribeHighlight: (() => void) | null = null

// Código con syntax highlighting
const highlightedCode = computed(() => {
  const result = highlightStrudelWithMeta(codeContent.value)
  stringLocations.value = result.strings
  return result.html
})

// Actualizar clases de highlight activo cuando cambian las ubicaciones
watch([activeLocations, highlightRef], () => {
  if (!highlightRef.value || !isActive.value) return
  updateActiveHighlights()
}, { deep: true })

function updateActiveHighlights() {
  if (!highlightRef.value) return

  // Quitar clase activa de todos los elementos
  highlightRef.value.querySelectorAll('.hl-active').forEach(el => {
    el.classList.remove('hl-active')
  })

  if (activeLocations.value.length === 0) return

  // Encontrar spans que coincidan con las ubicaciones activas
  const spans = highlightRef.value.querySelectorAll('[data-start][data-end]')

  for (const span of spans) {
    const spanStart = parseInt(span.getAttribute('data-start') || '0', 10)
    const spanEnd = parseInt(span.getAttribute('data-end') || '0', 10)

    // Verificar si este span está dentro de alguna ubicación activa
    for (const loc of activeLocations.value) {
      // Las ubicaciones de Strudel son relativas al contenido del string
      // Necesitamos mapear a las posiciones absolutas en el código
      for (const strLoc of stringLocations.value) {
        const absStart = strLoc.contentStart + loc.start
        const absEnd = strLoc.contentStart + loc.end

        // Verificar si hay overlap
        if (spanStart < absEnd && spanEnd > absStart) {
          span.classList.add('hl-active')
          break
        }
      }
    }
  }
}

// Sincronizar scroll entre textarea y highlight
function syncScroll() {
  if (textareaRef.value && highlightRef.value) {
    highlightRef.value.scrollTop = textareaRef.value.scrollTop
    highlightRef.value.scrollLeft = textareaRef.value.scrollLeft
  }
}

// Extraer código del slot default
onMounted(async () => {
  if (props.code) {
    codeContent.value = props.code.trim()
  } else if (slots.default) {
    const slotContent = slots.default()
    if (slotContent[0]?.children) {
      codeContent.value = String(slotContent[0].children).trim()
    }
  }

  // Suscribirse al estado de carga de samples y eventos de highlight
  try {
    const { onLoadingStateChange, onHighlightEvent } = await import('./audio/engine')

    unsubscribeLoading = onLoadingStateChange((state) => {
      samplesLoading.value = state.isLoading
      samplesLoaded.value = state.loaded
      samplesTotal.value = state.total
      currentSampleFile.value = state.currentFile
    })

    unsubscribeHighlight = onHighlightEvent((event) => {
      // Solo actualizar si esta caja está activa
      if (isActive.value) {
        activeLocations.value = event.locations
      }
    })
  } catch (e) {
    // SSR - ignorar
  }
})

onUnmounted(() => {
  if (unsubscribeLoading) {
    unsubscribeLoading()
  }
  if (unsubscribeHighlight) {
    unsubscribeHighlight()
  }
})

async function play() {
  errorMessage.value = ''
  isLoading.value = true

  try {
    // Import dinámico para evitar SSR
    const { evaluate, stop: engineStop } = await import('./audio/engine')

    // Detener cualquier patrón activo globalmente
    engineStop()

    // Marcar todas las otras cajas como inactivas
    document.querySelectorAll('.strudel-box').forEach(box => {
      box.classList.remove('is-active')
    })

    const code = textareaRef.value?.value || codeContent.value

    // Añadir .analyze(1) para las visualizaciones si no está ya
    const codeWithAnalyzer = code.includes('.analyze(')
      ? code
      : code.trim() + '.analyze(1)'

    await evaluate(codeWithAnalyzer)
    isActive.value = true
  } catch (error) {
    console.error('[StrudelBox] Play error:', error)
    errorMessage.value = error instanceof Error ? error.message : String(error)
    isActive.value = false
  } finally {
    isLoading.value = false
  }
}

async function stop() {
  try {
    const { stop: engineStop } = await import('./audio/engine')
    engineStop()
  } catch (error) {
    console.error('[StrudelBox] Stop error:', error)
  }
  isActive.value = false
  errorMessage.value = ''
  activeLocations.value = []
}
</script>

<template>
  <div class="strudel-box" :class="{ 'is-active': isActive, 'has-error': errorMessage }">
    <!-- Barra de progreso de carga de samples -->
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
      <span v-if="isActive" class="active-indicator">♪ Sonando</span>
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
        spellcheck="false"
        class="code-textarea"
      />
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

.error-message {
  color: #ef4444;
  font-size: 0.875rem;
  padding: 0.5rem;
  background: #fef2f2;
  border-top: 1px solid #fecaca;
  font-family: monospace;
  white-space: pre-wrap;
}

/* Syntax highlighting colors */
:deep(.hl-function) {
  color: #c084fc;
  font-weight: 500;
}

:deep(.hl-method) {
  color: #a78bfa;
}

:deep(.hl-string) {
  color: #fbbf24;
}

:deep(.hl-number) {
  color: #f472b6;
}

:deep(.hl-comment) {
  color: #6b7280;
  font-style: italic;
}

:deep(.hl-keyword) {
  color: #f472b6;
}

/* Mininotation dentro de strings */
:deep(.hl-bracket) {
  color: #60a5fa;
  font-weight: bold;
}

:deep(.hl-operator) {
  color: #f87171;
  font-weight: bold;
}

:deep(.hl-rest) {
  color: #6b7280;
}

:deep(.hl-alt) {
  color: #34d399;
  font-weight: bold;
}

:deep(.hl-comma) {
  color: #9ca3af;
}

:deep(.hl-note) {
  color: #4ade80;
  font-weight: 500;
}

:deep(.hl-sample) {
  color: #fcd34d;
}

:deep(.hl-paren) {
  color: #9ca3af;
}

:deep(.hl-op) {
  color: #f472b6;
}

/* Highlight activo - elemento que está sonando */
:deep(.hl-active) {
  background: rgba(99, 102, 241, 0.4);
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.6);
  animation: pulse-glow 0.3s ease-out;
}

@keyframes pulse-glow {
  0% {
    background: rgba(99, 102, 241, 0.8);
    box-shadow: 0 0 16px rgba(99, 102, 241, 0.9);
  }
  100% {
    background: rgba(99, 102, 241, 0.4);
    box-shadow: 0 0 8px rgba(99, 102, 241, 0.6);
  }
}
</style>
