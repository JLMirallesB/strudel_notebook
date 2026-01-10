<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const waveformCanvas = ref<HTMLCanvasElement | null>(null)
const spectrumCanvas = ref<HTMLCanvasElement | null>(null)
const spectrogramCanvas = ref<HTMLCanvasElement | null>(null)
const pianorollCanvas = ref<HTMLCanvasElement | null>(null)

let rafId: number | null = null
let unsubscribe: (() => void) | null = null

const MIN_DB = -90
const MAX_DB = -10

// Eventos de notas para piano roll
type NoteEvent = { time: number; dur: number; midi?: number }
let events: NoteEvent[] = []
let currentCps = 1

function resizeCanvas(canvas: HTMLCanvasElement) {
  const { width, height } = canvas.getBoundingClientRect()
  const scale = window.devicePixelRatio || 1
  const nextWidth = Math.max(1, Math.floor(width * scale))
  const nextHeight = Math.max(1, Math.floor(height * scale))
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth
    canvas.height = nextHeight
  }
}

function drawWaveform(ctx: CanvasRenderingContext2D, data: Float32Array) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  ctx.beginPath()
  ctx.strokeStyle = '#0f766e'
  ctx.lineWidth = 2
  const slice = width / data.length
  let x = 0
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] + 1) / 2
    const y = (1 - v) * height
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
    x += slice
  }
  ctx.stroke()
}

function drawSpectrum(ctx: CanvasRenderingContext2D, data: Float32Array) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  const barWidth = width / data.length
  for (let i = 0; i < data.length; i++) {
    const magnitude = (data[i] - MIN_DB) / (MAX_DB - MIN_DB)
    const clamped = Math.min(Math.max(magnitude, 0), 1)
    const barHeight = clamped * height
    ctx.fillStyle = `rgba(255, 149, 0, ${0.2 + clamped * 0.8})`
    ctx.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth), barHeight)
  }
}

function drawSpectrogram(ctx: CanvasRenderingContext2D, data: Float32Array) {
  const { width, height } = ctx.canvas
  ctx.drawImage(ctx.canvas, -1, 0)
  const x = width - 1
  for (let y = 0; y < height; y++) {
    const index = Math.floor((1 - y / height) * (data.length - 1))
    const magnitude = (data[index] - MIN_DB) / (MAX_DB - MIN_DB)
    const clamped = Math.min(Math.max(magnitude, 0), 1)
    const hue = 200 - clamped * 160
    const lightness = 15 + clamped * 60
    ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`
    ctx.fillRect(x, y, 1, 1)
  }
}

function drawPianoRoll(ctx: CanvasRenderingContext2D, now: number) {
  const { width, height } = ctx.canvas
  const secondsPerCycle = 1 / Math.max(currentCps, 0.1)
  const windowSeconds = secondsPerCycle * 2
  const timeStart = now - windowSeconds

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(248, 250, 252, 0.6)'
  ctx.fillRect(0, 0, width, height)

  // Grid
  ctx.strokeStyle = 'rgba(15, 118, 110, 0.15)'
  ctx.lineWidth = 1
  const steps = 32
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  // Filtrar eventos viejos
  events = events.filter(e => e.time + e.dur >= timeStart - 0.1)

  // Dibujar notas
  const pitchMin = 48
  const pitchMax = 84
  const pitchRange = pitchMax - pitchMin

  for (const event of events) {
    if (event.midi === undefined) continue
    const x = ((event.time - timeStart) / windowSeconds) * width
    const w = Math.max((event.dur / windowSeconds) * width, 2)
    const pitchNorm = Math.min(Math.max((event.midi - pitchMin) / pitchRange, 0), 1)
    const y = height - pitchNorm * height - 10
    ctx.fillStyle = 'rgba(245, 158, 11, 0.8)'
    ctx.fillRect(x, y, w, 8)
  }

  // Línea "Now"
  ctx.strokeStyle = 'rgba(15, 118, 110, 0.6)'
  ctx.beginPath()
  ctx.moveTo(width - 1, 0)
  ctx.lineTo(width - 1, height)
  ctx.stroke()
}

async function startVisualization() {
  if (rafId !== null) return

  const { getAnalyzerData, getTime, onNoteEvent, ANALYZER_ID } = await import('./audio/engine')

  // Suscribirse a eventos de notas
  unsubscribe = onNoteEvent((event) => {
    if (event.midi !== undefined) {
      events.push({ time: event.time, dur: event.dur, midi: event.midi })
    }
  })

  function draw() {
    const wCtx = waveformCanvas.value?.getContext('2d')
    const sCtx = spectrumCanvas.value?.getContext('2d')
    const sgCtx = spectrogramCanvas.value?.getContext('2d')
    const prCtx = pianorollCanvas.value?.getContext('2d')

    if (waveformCanvas.value) resizeCanvas(waveformCanvas.value)
    if (spectrumCanvas.value) resizeCanvas(spectrumCanvas.value)
    if (spectrogramCanvas.value) resizeCanvas(spectrogramCanvas.value)
    if (pianorollCanvas.value) resizeCanvas(pianorollCanvas.value)

    const timeData = getAnalyzerData('time', ANALYZER_ID)
    const freqData = getAnalyzerData('frequency', ANALYZER_ID)
    const now = getTime()

    if (wCtx && timeData) drawWaveform(wCtx, timeData)
    if (sCtx && freqData) drawSpectrum(sCtx, freqData)
    if (sgCtx && freqData) drawSpectrogram(sgCtx, freqData)
    if (prCtx) drawPianoRoll(prCtx, now)

    rafId = requestAnimationFrame(draw)
  }

  rafId = requestAnimationFrame(draw)
}

function stopVisualization() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  events = []
}

watch(() => props.visible, (visible) => {
  if (visible) {
    startVisualization()
  } else {
    stopVisualization()
  }
})

onUnmounted(() => {
  stopVisualization()
})
</script>

<template>
  <div class="visualizer-panel" :class="{ hidden: !visible }">
    <div class="viz-container">
      <span class="viz-label">Waveform</span>
      <canvas ref="waveformCanvas"></canvas>
    </div>
    <div class="viz-container">
      <span class="viz-label">Spectrum</span>
      <canvas ref="spectrumCanvas"></canvas>
    </div>
    <div class="viz-container">
      <span class="viz-label">Spectrogram</span>
      <canvas ref="spectrogramCanvas"></canvas>
    </div>
    <div class="viz-container" style="flex: 1.5">
      <span class="viz-label">Piano Roll</span>
      <canvas ref="pianorollCanvas"></canvas>
    </div>
  </div>
</template>
