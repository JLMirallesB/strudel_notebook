<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  code?: string
}>()

const slots = defineSlots()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isActive = ref(false)
const codeContent = ref('')

// Extraer código del slot default
onMounted(() => {
  if (props.code) {
    codeContent.value = props.code.trim()
  } else if (slots.default) {
    const slotContent = slots.default()
    if (slotContent[0]?.children) {
      codeContent.value = String(slotContent[0].children).trim()
    }
  }
})

async function play() {
  // Import dinámico para evitar SSR
  const { evaluate, stop: engineStop } = await import('./audio/engine')

  // Detener cualquier patrón activo globalmente
  engineStop()

  // Marcar todas las otras cajas como inactivas
  document.querySelectorAll('.strudel-box').forEach(box => {
    box.classList.remove('is-active')
  })

  const code = textareaRef.value?.value || codeContent.value
  const codeWithAnalyzer = code.includes('.analyze(')
    ? code
    : code.replace(/\n?$/, '.analyze(1)')

  await evaluate(codeWithAnalyzer)
  isActive.value = true
}

async function stop() {
  const { stop: engineStop } = await import('./audio/engine')
  engineStop()
  isActive.value = false
}
</script>

<template>
  <div class="strudel-box" :class="{ 'is-active': isActive }">
    <div class="strudel-box-header">
      <button class="play-btn" @click="play">▶ Play</button>
      <button class="stop-btn" @click="stop">■ Stop</button>
      <span v-if="isActive" class="active-indicator">♪ Sonando</span>
    </div>
    <textarea
      ref="textareaRef"
      :value="codeContent"
      @input="(e) => codeContent = (e.target as HTMLTextAreaElement).value"
      spellcheck="false"
    />
  </div>
</template>
