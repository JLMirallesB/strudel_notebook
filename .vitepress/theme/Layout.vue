<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { ref, onMounted, onUnmounted } from 'vue'
import VisualizerPanel from '../components/VisualizerPanel.vue'

const { Layout } = DefaultTheme

const isPlaying = ref(false)

onMounted(() => {
  window.addEventListener('strudel-play', () => { isPlaying.value = true })
  window.addEventListener('strudel-stop', () => { isPlaying.value = false })
})
</script>

<template>
  <Layout>
    <template #layout-bottom>
      <VisualizerPanel :visible="isPlaying" />
    </template>
  </Layout>
</template>
