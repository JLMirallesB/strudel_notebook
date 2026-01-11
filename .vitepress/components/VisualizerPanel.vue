<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const isExpanded = ref(true)
const waveformCanvas = ref<HTMLCanvasElement | null>(null)
const spectrumCanvas = ref<HTMLCanvasElement | null>(null)
const spectrogramCanvas = ref<HTMLCanvasElement | null>(null)
const pianorollCanvas = ref<HTMLCanvasElement | null>(null)

let rafId: number | null = null
let unsubscribe: (() => void) | null = null

const MIN_DB = -90
const MAX_DB = -10
const AXIS_WIDTH = 45
const AXIS_HEIGHT = 20

// Eventos de notas para piano roll
type NoteEvent = { time: number; dur: number; midi?: number }
let events: NoteEvent[] = []
let currentCps = 1

// Notas para el piano roll
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${note}${octave}`
}

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
  const plotX = AXIS_WIDTH
  const plotWidth = width - AXIS_WIDTH
  const plotHeight = height - AXIS_HEIGHT

  ctx.clearRect(0, 0, width, height)

  // Fondo del área de plot
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
  ctx.fillRect(plotX, 0, plotWidth, plotHeight)

  // Eje Y (amplitud)
  ctx.fillStyle = '#94a3b8'
  ctx.font = `${10 * (window.devicePixelRatio || 1)}px sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  const yLabels = [1, 0.5, 0, -0.5, -1]
  for (const val of yLabels) {
    const y = ((1 - val) / 2) * plotHeight
    ctx.fillText(val.toFixed(1), plotX - 5, y)

    // Línea de grid
    ctx.strokeStyle = val === 0 ? 'rgba(148, 163, 184, 0.5)' : 'rgba(148, 163, 184, 0.15)'
    ctx.lineWidth = val === 0 ? 2 : 1
    ctx.beginPath()
    ctx.moveTo(plotX, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  // Etiqueta del eje
  ctx.save()
  ctx.translate(12, plotHeight / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#64748b'
  ctx.fillText('Amplitud', 0, 0)
  ctx.restore()

  // Dibujar waveform
  ctx.beginPath()
  ctx.strokeStyle = '#22d3ee'
  ctx.lineWidth = 2
  const slice = plotWidth / data.length
  let x = plotX
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] + 1) / 2
    const y = (1 - v) * plotHeight
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
    x += slice
  }
  ctx.stroke()

  // Etiqueta inferior
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'center'
  ctx.fillText('Tiempo', plotX + plotWidth / 2, height - 5)
}

function drawSpectrum(ctx: CanvasRenderingContext2D, data: Float32Array) {
  const { width, height } = ctx.canvas
  const plotX = AXIS_WIDTH
  const plotWidth = width - AXIS_WIDTH
  const plotHeight = height - AXIS_HEIGHT

  ctx.clearRect(0, 0, width, height)

  // Fondo
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
  ctx.fillRect(plotX, 0, plotWidth, plotHeight)

  // Eje Y (dB)
  ctx.fillStyle = '#94a3b8'
  ctx.font = `${10 * (window.devicePixelRatio || 1)}px sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  const dbLabels = [-10, -30, -50, -70, -90]
  for (const db of dbLabels) {
    const y = ((db - MAX_DB) / (MIN_DB - MAX_DB)) * plotHeight
    ctx.fillText(`${db}`, plotX - 5, y)

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(plotX, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  // Etiqueta eje Y
  ctx.save()
  ctx.translate(12, plotHeight / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#64748b'
  ctx.fillText('dB', 0, 0)
  ctx.restore()

  // Eje X (frecuencia logarítmica)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const freqLabels = [100, 500, 1000, 5000, 10000]
  const sampleRate = 44100
  const nyquist = sampleRate / 2

  for (const freq of freqLabels) {
    const logPos = Math.log10(freq / 20) / Math.log10(nyquist / 20)
    const x = plotX + logPos * plotWidth
    if (x > plotX && x < width) {
      ctx.fillStyle = '#64748b'
      ctx.fillText(freq >= 1000 ? `${freq/1000}k` : `${freq}`, x, plotHeight + 3)

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)'
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, plotHeight)
      ctx.stroke()
    }
  }

  // Etiqueta Hz
  ctx.fillStyle = '#64748b'
  ctx.fillText('Hz', width - 15, plotHeight + 3)

  // Dibujar barras del espectro (escala logarítmica)
  const numBars = 64
  for (let i = 0; i < numBars; i++) {
    const logFreq = 20 * Math.pow(nyquist / 20, i / numBars)
    const binIndex = Math.floor((logFreq / nyquist) * data.length)
    if (binIndex >= data.length) continue

    const magnitude = (data[binIndex] - MIN_DB) / (MAX_DB - MIN_DB)
    const clamped = Math.min(Math.max(magnitude, 0), 1)

    const x = plotX + (i / numBars) * plotWidth
    const barWidth = plotWidth / numBars - 1
    const barHeight = clamped * plotHeight

    // Gradiente de color según intensidad
    const hue = 180 - clamped * 60 // cyan a verde
    ctx.fillStyle = `hsla(${hue}, 80%, ${40 + clamped * 30}%, ${0.5 + clamped * 0.5})`
    ctx.fillRect(x, plotHeight - barHeight, Math.max(1, barWidth), barHeight)
  }
}

function drawSpectrogram(ctx: CanvasRenderingContext2D, data: Float32Array) {
  const { width, height } = ctx.canvas
  const plotX = AXIS_WIDTH
  const plotWidth = width - AXIS_WIDTH
  const plotHeight = height - AXIS_HEIGHT

  // Mover imagen anterior
  const imageData = ctx.getImageData(plotX + 1, 0, plotWidth - 1, plotHeight)
  ctx.putImageData(imageData, plotX, 0)

  // Fondo del eje
  ctx.fillStyle = 'rgba(15, 23, 42, 1)'
  ctx.fillRect(0, 0, plotX, height)
  ctx.fillRect(0, plotHeight, width, AXIS_HEIGHT)

  // Eje Y (frecuencia)
  ctx.fillStyle = '#94a3b8'
  ctx.font = `${10 * (window.devicePixelRatio || 1)}px sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  const freqLabels = [20000, 10000, 5000, 1000, 500, 100]
  const nyquist = 22050

  for (const freq of freqLabels) {
    const y = (1 - freq / nyquist) * plotHeight
    if (y > 10 && y < plotHeight - 10) {
      ctx.fillText(freq >= 1000 ? `${freq/1000}k` : `${freq}`, plotX - 5, y)
    }
  }

  // Etiqueta Hz
  ctx.save()
  ctx.translate(12, plotHeight / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#64748b'
  ctx.fillText('Hz', 0, 0)
  ctx.restore()

  // Dibujar columna nueva
  const x = width - 1
  for (let y = 0; y < plotHeight; y++) {
    const index = Math.floor((1 - y / plotHeight) * (data.length - 1))
    const magnitude = (data[index] - MIN_DB) / (MAX_DB - MIN_DB)
    const clamped = Math.min(Math.max(magnitude, 0), 1)

    // Mapa de colores: azul oscuro -> cyan -> amarillo -> blanco
    let r, g, b
    if (clamped < 0.25) {
      const t = clamped / 0.25
      r = 15; g = 23 + t * 80; b = 42 + t * 150
    } else if (clamped < 0.5) {
      const t = (clamped - 0.25) / 0.25
      r = 15 + t * 20; g = 103 + t * 108; b = 192 - t * 50
    } else if (clamped < 0.75) {
      const t = (clamped - 0.5) / 0.25
      r = 35 + t * 200; g = 211 + t * 44; b = 142 - t * 100
    } else {
      const t = (clamped - 0.75) / 0.25
      r = 235 + t * 20; g = 255; b = 42 + t * 200
    }

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    ctx.fillRect(x, y, 1, 1)
  }

  // Leyenda de colores
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'center'
  ctx.fillText('Tiempo →', plotX + plotWidth / 2, height - 5)
}

function drawPianoRoll(ctx: CanvasRenderingContext2D, now: number) {
  const { width, height } = ctx.canvas
  const plotX = AXIS_WIDTH
  const plotWidth = width - AXIS_WIDTH
  const plotHeight = height - AXIS_HEIGHT

  const secondsPerCycle = 1 / Math.max(currentCps, 0.1)
  const windowSeconds = secondsPerCycle * 2
  const timeStart = now - windowSeconds

  ctx.clearRect(0, 0, width, height)

  // Fondo
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
  ctx.fillRect(plotX, 0, plotWidth, plotHeight)

  // Eje Y (notas)
  const pitchMin = 48  // C3
  const pitchMax = 84  // C6
  const pitchRange = pitchMax - pitchMin

  ctx.fillStyle = '#94a3b8'
  ctx.font = `${10 * (window.devicePixelRatio || 1)}px sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  // Dibujar líneas de octava y notas C
  for (let midi = pitchMin; midi <= pitchMax; midi++) {
    const pitchNorm = (midi - pitchMin) / pitchRange
    const y = plotHeight - pitchNorm * plotHeight

    if (midi % 12 === 0) { // Nota C
      // Línea de octava
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(plotX, y)
      ctx.lineTo(width, y)
      ctx.stroke()

      // Etiqueta
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(midiToNoteName(midi), plotX - 5, y)
    } else if (midi % 12 === 4 || midi % 12 === 7) { // E y G
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)'
      ctx.beginPath()
      ctx.moveTo(plotX, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  // Etiqueta del eje
  ctx.save()
  ctx.translate(12, plotHeight / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#64748b'
  ctx.fillText('Nota', 0, 0)
  ctx.restore()

  // Grid vertical (tiempo)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)'
  const steps = 16
  for (let i = 0; i <= steps; i++) {
    const x = plotX + (i / steps) * plotWidth
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, plotHeight)
    ctx.stroke()
  }

  // Filtrar eventos viejos
  events = events.filter(e => e.time + e.dur >= timeStart - 0.1)

  // Dibujar notas
  for (const event of events) {
    if (event.midi === undefined) continue
    const x = plotX + ((event.time - timeStart) / windowSeconds) * plotWidth
    const w = Math.max((event.dur / windowSeconds) * plotWidth, 4)
    const pitchNorm = Math.min(Math.max((event.midi - pitchMin) / pitchRange, 0), 1)
    const noteHeight = plotHeight / pitchRange
    const y = plotHeight - pitchNorm * plotHeight - noteHeight / 2

    // Color según la nota (arcoíris por octava)
    const hue = (event.midi % 12) * 30
    ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.9)`
    ctx.fillRect(x, y, w, Math.max(noteHeight, 6))

    // Borde
    ctx.strokeStyle = `hsla(${hue}, 70%, 40%, 1)`
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, Math.max(noteHeight, 6))
  }

  // Línea "Now"
  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(width - 2, 0)
  ctx.lineTo(width - 2, plotHeight)
  ctx.stroke()

  // Etiqueta inferior
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'center'
  ctx.fillText('Tiempo →', plotX + plotWidth / 2, height - 5)
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

function clearSpectrogram() {
  const ctx = spectrogramCanvas.value?.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value
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
  <div class="visualizer-panel" :class="{ hidden: !visible, collapsed: !isExpanded }">
    <div class="viz-header">
      <span class="viz-title">Visualizaciones</span>
      <div class="viz-controls">
        <button class="viz-btn" @click="clearSpectrogram" title="Limpiar espectrograma">
          Limpiar
        </button>
        <button class="viz-btn" @click="toggleExpand">
          {{ isExpanded ? 'Colapsar' : 'Expandir' }}
        </button>
      </div>
    </div>
    <div class="viz-content" v-show="isExpanded">
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
  </div>
</template>

<style scoped>
.visualizer-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #0f172a;
  border-top: 2px solid #1e293b;
  z-index: 100;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  transition: height 0.3s ease;
}

.visualizer-panel.hidden {
  display: none;
}

.visualizer-panel.collapsed {
  height: auto !important;
}

.viz-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.viz-title {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600;
  color: #e2e8f0;
  font-size: 14px;
}

.viz-controls {
  display: flex;
  gap: 8px;
}

.viz-btn {
  padding: 4px 12px;
  background: #334155;
  border: none;
  border-radius: 4px;
  color: #94a3b8;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.viz-btn:hover {
  background: #475569;
  color: #e2e8f0;
}

.viz-content {
  display: flex;
  gap: 8px;
  padding: 8px 16px 12px;
  height: 200px;
}

.viz-container {
  position: relative;
  flex: 1;
  min-width: 0;
}

.viz-label {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  z-index: 1;
}

.viz-container canvas {
  width: 100%;
  height: 100%;
  border-radius: 6px;
}

@media (max-width: 768px) {
  .viz-content {
    flex-wrap: wrap;
    height: auto;
    max-height: 300px;
  }

  .viz-container {
    min-width: calc(50% - 4px);
    height: 120px;
  }
}
</style>
