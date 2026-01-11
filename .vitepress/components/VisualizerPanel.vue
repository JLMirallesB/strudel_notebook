<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const isExpanded = ref(true)
const activeGroup = ref<'audio' | 'notes'>('audio')

// Canvas refs - Grupo Audio
const waveformCanvas = ref<HTMLCanvasElement | null>(null)
const spectrumCanvas = ref<HTMLCanvasElement | null>(null)
const spectrogramCanvas = ref<HTMLCanvasElement | null>(null)

// Canvas refs - Grupo Notas
const spiralCanvas = ref<HTMLCanvasElement | null>(null)
const pitchwheelCanvas = ref<HTMLCanvasElement | null>(null)
const pianorollCanvas = ref<HTMLCanvasElement | null>(null)

let rafId: number | null = null
let cleanupPlayListener: (() => void) | null = null

const MIN_DB = -90
const MAX_DB = -10
const AXIS_WIDTH = 45
const AXIS_HEIGHT = 20

// Eventos de notas para piano roll
type NoteEvent = { time: number; dur: number; midi?: number }
let events: NoteEvent[] = []

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

function drawSpectrum(ctx: CanvasRenderingContext2D, data: Float32Array, sampleRate: number) {
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

function drawSpectrogram(ctx: CanvasRenderingContext2D, data: Float32Array, sampleRate: number) {
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
  const nyquist = sampleRate / 2

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
  // now está en ciclos (de getSchedulerTime)
  const { width, height } = ctx.canvas
  const plotX = AXIS_WIDTH
  const plotWidth = width - AXIS_WIDTH
  const plotHeight = height - AXIS_HEIGHT

  // Ventana de tiempo en ciclos (2 ciclos hacia atrás, 0.5 hacia adelante)
  const lookbehind = 2
  const lookahead = 0.5
  const windowCycles = lookbehind + lookahead
  const timeStart = now - lookbehind

  ctx.clearRect(0, 0, width, height)

  // Fondo
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
  ctx.fillRect(plotX, 0, plotWidth, plotHeight)

  // Autorange: calcular min/max MIDI de los eventos visibles
  const visibleEvents = events.filter(e => e.midi !== undefined)
  let pitchMin = 48  // C3 default
  let pitchMax = 84  // C6 default

  if (visibleEvents.length > 0) {
    const midiValues = visibleEvents.map(e => e.midi!)
    const minMidi = Math.min(...midiValues)
    const maxMidi = Math.max(...midiValues)
    // Añadir margen de una octava
    pitchMin = Math.max(0, Math.floor((minMidi - 6) / 12) * 12)
    pitchMax = Math.min(127, Math.ceil((maxMidi + 6) / 12) * 12)
    // Mínimo rango de 2 octavas
    if (pitchMax - pitchMin < 24) {
      const mid = (pitchMin + pitchMax) / 2
      pitchMin = Math.max(0, Math.floor(mid - 12))
      pitchMax = Math.min(127, Math.ceil(mid + 12))
    }
  }

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

  // Grid vertical (tiempo) - una línea por cada medio ciclo
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)'
  const gridLines = Math.ceil(windowCycles * 2)
  for (let i = 0; i <= gridLines; i++) {
    const x = plotX + (i / gridLines) * plotWidth
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, plotHeight)
    ctx.stroke()
  }

  // Playhead position (now está en posición relativa a lookbehind/lookahead)
  const playheadX = plotX + (lookbehind / windowCycles) * plotWidth

  // Dibujar notas
  for (const event of events) {
    if (event.midi === undefined) continue
    const x = plotX + ((event.time - timeStart) / windowCycles) * plotWidth
    const w = Math.max((event.dur / windowCycles) * plotWidth, 4)
    const pitchNorm = Math.min(Math.max((event.midi - pitchMin) / pitchRange, 0), 1)
    const noteHeight = Math.max(plotHeight / pitchRange, 6)
    const y = plotHeight - pitchNorm * plotHeight - noteHeight / 2

    const isActive = event.time <= now && event.time + event.dur > now

    // Color según la nota (arcoíris por octava)
    const hue = (event.midi % 12) * 30
    ctx.fillStyle = isActive
      ? `hsla(${hue}, 80%, 60%, 0.95)`
      : `hsla(${hue}, 60%, 50%, 0.8)`
    ctx.fillRect(x, y, w, noteHeight)

    // Borde más visible para notas activas
    ctx.strokeStyle = isActive
      ? `hsla(${hue}, 90%, 75%, 1)`
      : `hsla(${hue}, 70%, 40%, 1)`
    ctx.lineWidth = isActive ? 2 : 1
    ctx.strokeRect(x, y, w, noteHeight)

    // Label de la nota (solo si hay espacio suficiente)
    if (w > 20 && noteHeight > 10) {
      const noteName = midiToNoteName(event.midi)
      ctx.fillStyle = isActive ? '#000' : 'rgba(0,0,0,0.7)'
      ctx.font = `${Math.min(noteHeight * 0.7, 11) * (window.devicePixelRatio || 1)}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(noteName, x + 3, y + noteHeight / 2)
    }
  }

  // Línea "Now" (playhead)
  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(playheadX, 0)
  ctx.lineTo(playheadX, plotHeight)
  ctx.stroke()

  // Etiqueta inferior
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'center'
  ctx.fillText('Tiempo →', plotX + plotWidth / 2, height - 5)
}

// Función auxiliar para coordenadas polares
function fromPolar(angle: number, radius: number, cx: number, cy: number): [number, number] {
  const radians = ((angle - 90) * Math.PI) / 180
  return [cx + Math.cos(radians) * radius, cy + Math.sin(radians) * radius]
}

function xyOnSpiral(angle: number, margin: number, cx: number, cy: number, rotate: number = 0): [number, number] {
  return fromPolar((angle + rotate) * 360, margin * angle, cx, cy)
}

function drawSpiral(ctx: CanvasRenderingContext2D, now: number) {
  // now está en ciclos (de getSchedulerTime)
  const { width, height } = ctx.canvas

  ctx.clearRect(0, 0, width, height)

  // Fondo
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
  ctx.fillRect(0, 0, width, height)

  const cx = width / 2
  const cy = height / 2
  const size = Math.min(width, height) * 0.8
  const stretch = 1        // rotaciones por ciclo
  const margin = size / 8  // espacio entre vueltas
  const inset = 2          // offset inicial (vueltas/ciclos antes del playhead)
  const thickness = margin * 0.4

  // Ventana de tiempo en ciclos
  const lookbehind = 4  // 4 ciclos hacia atrás
  const lookahead = 1   // 1 ciclo hacia adelante

  // Filtrar eventos en la ventana temporal (ya en ciclos)
  const visibleEvents = events.filter(e =>
    e.time + e.dur >= now - lookbehind && e.time <= now + lookahead
  )

  // Dibujar eventos como arcos en la espiral
  for (const event of visibleEvents) {
    if (event.midi === undefined) continue

    const isActive = event.time <= now && event.time + event.dur > now
    // El tiempo ya está en ciclos, así que calculamos directamente
    const from = (event.time - now) + inset
    const to = from + event.dur

    // Color basado en la nota
    const hue = (event.midi % 12) * 30
    const color = isActive
      ? `hsla(${hue}, 80%, 60%, 0.95)`
      : `hsla(${hue}, 50%, 45%, 0.6)`

    ctx.strokeStyle = color
    ctx.lineWidth = thickness
    ctx.lineCap = 'round'
    ctx.beginPath()

    let [sx, sy] = xyOnSpiral(from * stretch, margin, cx, cy, 0)
    ctx.moveTo(sx, sy)

    const increment = 1 / 60
    let angle = from
    while (angle <= to) {
      const [x, y] = xyOnSpiral(angle * stretch, margin, cx, cy, 0)
      ctx.lineTo(x, y)
      angle += increment
    }
    ctx.stroke()
  }

  // Dibujar playhead
  const playheadAngle = inset
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = thickness * 0.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  const [px1, py1] = xyOnSpiral((playheadAngle - 0.05) * stretch, margin, cx, cy, 0)
  const [px2, py2] = xyOnSpiral(playheadAngle * stretch, margin, cx, cy, 0)
  ctx.moveTo(px1, py1)
  ctx.lineTo(px2, py2)
  ctx.stroke()

  // Etiqueta
  ctx.fillStyle = '#64748b'
  ctx.font = `${10 * (window.devicePixelRatio || 1)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('Spiral', width / 2, height - 8)
}

function drawPitchwheel(ctx: CanvasRenderingContext2D, now: number) {
  const { width, height } = ctx.canvas

  ctx.clearRect(0, 0, width, height)

  // Fondo
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
  ctx.fillRect(0, 0, width, height)

  const cx = width / 2
  const cy = height / 2
  const size = Math.min(width, height)
  const radius = size * 0.35
  const dotRadius = size * 0.025
  const hapRadius = size * 0.04

  // Nombres de las notas en el círculo
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

  // Dibujar los 12 puntos del círculo (semitonos)
  ctx.fillStyle = '#475569'
  ctx.font = `${9 * (window.devicePixelRatio || 1)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * 2 * Math.PI - Math.PI / 2  // Empezar desde arriba (C)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius

    // Punto base
    ctx.beginPath()
    ctx.arc(x, y, dotRadius, 0, 2 * Math.PI)
    ctx.fill()

    // Etiqueta de nota
    const labelRadius = radius + dotRadius * 3
    const lx = cx + Math.cos(angle) * labelRadius
    const ly = cy + Math.sin(angle) * labelRadius
    ctx.fillStyle = '#64748b'
    ctx.fillText(noteNames[i], lx, ly)
    ctx.fillStyle = '#475569'
  }

  // Encontrar notas activas
  const activeNotes = events.filter(e =>
    e.midi !== undefined && e.time <= now && e.time + e.dur > now
  )

  // Dibujar líneas al centro y highlights para notas activas
  for (const note of activeNotes) {
    if (note.midi === undefined) continue

    const semitone = note.midi % 12
    const angle = (semitone / 12) * 2 * Math.PI - Math.PI / 2
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius

    const hue = semitone * 30

    // Línea desde el centro
    ctx.strokeStyle = `hsla(${hue}, 70%, 55%, 0.7)`
    ctx.lineWidth = hapRadius * 0.6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x, y)
    ctx.stroke()

    // Círculo highlight
    ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.9)`
    ctx.beginPath()
    ctx.arc(x, y, hapRadius, 0, 2 * Math.PI)
    ctx.fill()
  }

  // Punto central
  ctx.fillStyle = '#94a3b8'
  ctx.beginPath()
  ctx.arc(cx, cy, dotRadius * 0.8, 0, 2 * Math.PI)
  ctx.fill()

  // Etiqueta
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'center'
  ctx.fillText('Pitchwheel', width / 2, height - 8)
}

async function startVisualization() {
  if (rafId !== null) return

  const {
    getAnalyzerData,
    ANALYZER_ID,
    getAudioContext,
    hasAnalyser,
    queryPattern,
    getSchedulerTime
  } = await import('./audio/engine')

  // Obtener sample rate real del AudioContext
  const audioContext = getAudioContext()
  const actualSampleRate = audioContext?.sampleRate ?? 44100
  console.log(`[VisualizerPanel] Using sample rate: ${actualSampleRate} Hz`)

  // Limpiar espectrograma cuando inicia nueva reproducción
  const handlePlay = () => {
    clearSpectrogram()
  }
  window.addEventListener('strudel-play', handlePlay)
  cleanupPlayListener = () => {
    window.removeEventListener('strudel-play', handlePlay)
  }

  // Función helper para convertir haps de Strudel al formato de eventos
  function hapsToEvents(haps: any[]): NoteEvent[] {
    const result: NoteEvent[] = []
    for (const hap of haps) {
      if (!hap.value) continue
      const time = hap.whole?.begin?.valueOf() ?? 0
      const end = hap.whole?.end?.valueOf() ?? time
      const dur = end - time

      // Obtener MIDI de diferentes fuentes
      let midi: number | undefined
      const value = hap.value

      if (value.note !== undefined) {
        // Nota como string "c3" o número
        if (typeof value.note === 'number') {
          midi = value.note
        } else if (typeof value.note === 'string') {
          midi = noteNameToMidi(value.note)
        }
      } else if (value.n !== undefined && typeof value.n === 'number') {
        // Si es un instrumento tonal (no drum), usar n como MIDI
        const drums = ['bd', 'sd', 'hh', 'cp', 'oh', 'ch']
        if (!drums.includes(value.s)) {
          midi = value.n
        }
      } else if (value.freq !== undefined) {
        // Frecuencia a MIDI
        midi = Math.round(69 + 12 * Math.log2(Number(value.freq) / 440))
      }

      if (midi !== undefined) {
        result.push({ time, dur, midi })
      }
    }
    return result
  }

  // Helper para convertir nombre de nota a MIDI (simple)
  function noteNameToMidi(note: string): number | undefined {
    const match = note.trim().match(/^([a-gA-G])([#b]?)(-?\d+)$/)
    if (!match) return undefined
    const noteMap: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
    const letter = match[1].toLowerCase()
    const accidental = match[2]
    const octave = parseInt(match[3], 10)
    const base = noteMap[letter]
    if (base === undefined || isNaN(octave)) return undefined
    const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
    return (octave + 1) * 12 + base + offset
  }

  // Variables para query de pattern
  const LOOKBEHIND = 2  // Ciclos hacia atrás
  const LOOKAHEAD = 2   // Ciclos hacia adelante

  function draw() {
    if (activeGroup.value === 'audio') {
      // Grupo Audio: Waveform, Spectrum, Spectrogram
      const wCtx = waveformCanvas.value?.getContext('2d')
      const sCtx = spectrumCanvas.value?.getContext('2d')
      const sgCtx = spectrogramCanvas.value?.getContext('2d')

      if (waveformCanvas.value) resizeCanvas(waveformCanvas.value)
      if (spectrumCanvas.value) resizeCanvas(spectrumCanvas.value)
      if (spectrogramCanvas.value) resizeCanvas(spectrogramCanvas.value)

      // Verificar que existe el analyzer antes de obtener datos
      if (hasAnalyser(ANALYZER_ID)) {
        const timeData = getAnalyzerData('time', ANALYZER_ID)
        const freqData = getAnalyzerData('frequency', ANALYZER_ID)

        if (wCtx && timeData) drawWaveform(wCtx, timeData)
        if (sCtx && freqData) drawSpectrum(sCtx, freqData, actualSampleRate)
        if (sgCtx && freqData) drawSpectrogram(sgCtx, freqData, actualSampleRate)
      } else {
        // Dibujar fondos vacíos con mensaje
        if (wCtx) drawEmptyCanvas(wCtx, 'Esperando audio...')
        if (sCtx) drawEmptyCanvas(sCtx, 'Esperando audio...')
        if (sgCtx) drawEmptyCanvas(sgCtx, 'Esperando audio...')
      }
    } else {
      // Grupo Notas: Spiral, Pitchwheel, Piano Roll
      const spCtx = spiralCanvas.value?.getContext('2d')
      const pwCtx = pitchwheelCanvas.value?.getContext('2d')
      const prCtx = pianorollCanvas.value?.getContext('2d')

      if (spiralCanvas.value) resizeCanvas(spiralCanvas.value)
      if (pitchwheelCanvas.value) resizeCanvas(pitchwheelCanvas.value)
      if (pianorollCanvas.value) resizeCanvas(pianorollCanvas.value)

      // Obtener tiempo actual del scheduler (en ciclos)
      const now = getSchedulerTime()

      // Query al pattern activo para obtener haps
      const haps = queryPattern(now - LOOKBEHIND, now + LOOKAHEAD)
      events = hapsToEvents(haps)

      if (spCtx) drawSpiral(spCtx, now)
      if (pwCtx) drawPitchwheel(pwCtx, now)
      if (prCtx) drawPianoRoll(prCtx, now)
    }

    rafId = requestAnimationFrame(draw)
  }

  rafId = requestAnimationFrame(draw)
}

function drawEmptyCanvas(ctx: CanvasRenderingContext2D, message: string) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#475569'
  ctx.font = `${12 * (window.devicePixelRatio || 1)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(message, width / 2, height / 2)
}

function stopVisualization() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (cleanupPlayListener) {
    cleanupPlayListener()
    cleanupPlayListener = null
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
      <div class="viz-tabs">
        <button
          class="viz-tab"
          :class="{ active: activeGroup === 'audio' }"
          @click="activeGroup = 'audio'"
        >
          Audio
        </button>
        <button
          class="viz-tab"
          :class="{ active: activeGroup === 'notes' }"
          @click="activeGroup = 'notes'"
        >
          Notas
        </button>
      </div>
      <div class="viz-controls">
        <button
          v-if="activeGroup === 'audio'"
          class="viz-btn"
          @click="clearSpectrogram"
          title="Limpiar espectrograma"
        >
          Limpiar
        </button>
        <button class="viz-btn" @click="toggleExpand">
          {{ isExpanded ? 'Colapsar' : 'Expandir' }}
        </button>
      </div>
    </div>
    <div class="viz-content" v-show="isExpanded">
      <!-- Grupo Audio -->
      <template v-if="activeGroup === 'audio'">
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
      </template>
      <!-- Grupo Notas -->
      <template v-else>
        <div class="viz-container">
          <span class="viz-label">Spiral</span>
          <canvas ref="spiralCanvas"></canvas>
        </div>
        <div class="viz-container">
          <span class="viz-label">Pitchwheel</span>
          <canvas ref="pitchwheelCanvas"></canvas>
        </div>
        <div class="viz-container" style="flex: 1.5">
          <span class="viz-label">Piano Roll</span>
          <canvas ref="pianorollCanvas"></canvas>
        </div>
      </template>
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
  padding: 6px 16px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.viz-tabs {
  display: flex;
  gap: 4px;
}

.viz-tab {
  padding: 6px 16px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.viz-tab:hover {
  background: #334155;
  color: #e2e8f0;
}

.viz-tab.active {
  background: #3b82f6;
  color: #ffffff;
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
