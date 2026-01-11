<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  code?: string
}>()

const slots = defineSlots()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isActive = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const codeContent = ref('')

// Estado de carga de samples
const samplesLoading = ref(false)
const samplesLoaded = ref(0)
const samplesTotal = ref(0)
const currentSampleFile = ref('')

let unsubscribeLoading: (() => void) | null = null

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

  // Suscribirse al estado de carga de samples
  try {
    const { onLoadingStateChange } = await import('./audio/engine')
    unsubscribeLoading = onLoadingStateChange((state) => {
      samplesLoading.value = state.isLoading
      samplesLoaded.value = state.loaded
      samplesTotal.value = state.total
      currentSampleFile.value = state.currentFile
    })
  } catch (e) {
    // SSR - ignorar
  }
})

onUnmounted(() => {
  if (unsubscribeLoading) {
    unsubscribeLoading()
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
    <textarea
      ref="textareaRef"
      :value="codeContent"
      @input="(e) => { codeContent = (e.target as HTMLTextAreaElement).value; errorMessage = '' }"
      spellcheck="false"
    />
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

.has-error textarea {
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
</style>
