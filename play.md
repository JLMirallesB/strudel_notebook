---
layout: page
title: Play
sidebar: false
---

<script setup>
import { ref, onMounted } from 'vue'
import StrudelBox from './.vitepress/components/StrudelBox.vue'

const code = ref('')
const sharedNotes = ref('')
const importedHistory = ref(null)
const loaded = ref(false)
const started = ref(false)
const error = ref('')

onMounted(() => {
  const hash = window.location.hash

  // History import
  if (hash === '#history') {
    const historyJson = sessionStorage.getItem('imported-history')
    if (historyJson) {
      sessionStorage.removeItem('imported-history')
      try {
        const data = JSON.parse(historyJson)
        if (data.snapshots && data.snapshots.length > 0) {
          importedHistory.value = data.snapshots
          code.value = data.snapshots[data.snapshots.length - 1].code
          sharedNotes.value = data.snapshots[data.snapshots.length - 1].notes || ''
          loaded.value = true
          started.value = true
          return
        }
      } catch {}
    }
    error.value = 'No se pudo cargar el historial.'
    loaded.value = true
    return
  }

  // Shared code
  if (hash && hash.startsWith('#code=')) {
    try {
      const decoded = atob(decodeURIComponent(hash.slice(6)))
      if (decoded.startsWith('{')) {
        const data = JSON.parse(decoded)
        code.value = data.code || ''
        sharedNotes.value = data.notes || ''
      } else {
        code.value = decoded
      }
      loaded.value = true
    } catch (e) {
      error.value = 'No se pudo decodificar el código del enlace.'
      loaded.value = true
    }
  } else {
    error.value = 'No hay código en el enlace. Usa un link compartido o vuelve a la página de inicio.'
    loaded.value = true
  }
})

async function startPlaying() {
  started.value = true
}
</script>

<div v-if="!loaded" class="play-status">Cargando...</div>

<div v-else-if="error" class="play-error">
  <p>{{ error }}</p>
  <a href="/" class="play-home-btn">Ir al inicio</a>
</div>

<div v-else class="play-container">
  <div v-if="!started" class="play-overlay" @click="startPlaying">
    <div class="play-overlay-btn">▶</div>
    <div class="play-overlay-text">Pulsa para escuchar</div>
  </div>
  <StrudelBox v-show="started" :code="code" :snippets="true" :tall="true" :autoplay="started" :initial-notes="sharedNotes" :initial-history="importedHistory" />
</div>

<style>
.play-status {
  text-align: center;
  padding: 60px;
  color: var(--vp-c-text-2);
  font-size: 1.1rem;
}

.play-error {
  text-align: center;
  padding: 60px;
}

.play-error p {
  color: var(--vp-c-text-2);
  font-size: 1.1rem;
  margin-bottom: 20px;
}

.play-home-btn {
  display: inline-block;
  padding: 10px 24px;
  background: var(--vp-c-brand-1);
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
}

.play-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px 24px 280px;
}

.play-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  cursor: pointer;
  user-select: none;
}

.play-overlay-btn {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--vp-c-brand-1), var(--vp-c-brand-2));
  color: white;
  font-size: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 8px;
  box-shadow: 0 4px 24px rgba(15, 118, 110, 0.4);
  transition: transform 0.2s, box-shadow 0.2s;
}

.play-overlay:hover .play-overlay-btn {
  transform: scale(1.1);
  box-shadow: 0 6px 32px rgba(15, 118, 110, 0.6);
}

.play-overlay:active .play-overlay-btn {
  transform: scale(0.95);
}

.play-overlay-text {
  margin-top: 16px;
  color: var(--vp-c-text-2);
  font-size: 1.1rem;
  font-weight: 500;
}

</style>
