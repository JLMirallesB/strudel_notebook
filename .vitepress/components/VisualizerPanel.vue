<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const isExpanded = ref(true)
const activeGroup = ref<'audio' | 'notes' | 'keyboard' | 'score' | 'drums'>('audio')

// Canvas refs - Grupo Audio
const waveformCanvas = ref<HTMLCanvasElement | null>(null)
const spectrumCanvas = ref<HTMLCanvasElement | null>(null)
const spectrogramCanvas = ref<HTMLCanvasElement | null>(null)

// Canvas refs - Grupo Notas
const spiralCanvas = ref<HTMLCanvasElement | null>(null)
const pitchwheelCanvas = ref<HTMLCanvasElement | null>(null)
const pianorollCanvas = ref<HTMLCanvasElement | null>(null)

// Canvas refs - Grupo Teclado
const keyboardCanvas = ref<HTMLCanvasElement | null>(null)

// Canvas refs - Grupo Partitura
const scoreCanvas = ref<HTMLCanvasElement | null>(null)

// Canvas refs - Grupo Batería
const drumsCanvas = ref<HTMLCanvasElement | null>(null)

let rafId: number | null = null
let cleanupPlayListener: (() => void) | null = null

// Parámetros configurables
const minDb = ref(-90)
const maxDb = ref(-10)
const numBars = ref(64)
const fftSize = ref(1024)
const waveZoom = ref(100)
const frozen = ref(false)
const peakHold = ref(false)
const spectrogramLog = ref(false)
const spectrumLine = ref(false)
const pianoLookbehind = ref(2)
const punchcard = ref(false)
const solfeo = ref(false)
const showSpiral = ref(true)
const kbLabels = ref(true)
const kbMidi = ref(false)
const scoreCycles = ref(4)
const drumCycles = ref(1)
const drumShowPads = ref(true)
const keyboardStart = ref(36)
const keyboardEnd = ref(84)
const showSettings = ref(false)

// Mouse hover state
const hoverCanvas = ref<string | null>(null)
const hoverX = ref(0)
const hoverY = ref(0)

function handleCanvasMove(canvas: string, e: MouseEvent) {
  const target = e.target as HTMLCanvasElement
  const rect = target.getBoundingClientRect()
  const scale = window.devicePixelRatio || 1
  hoverCanvas.value = canvas
  hoverX.value = (e.clientX - rect.left) * scale
  hoverY.value = (e.clientY - rect.top) * scale
}

function handleCanvasLeave() {
  hoverCanvas.value = null
}

const paramHelp: Record<string, { title: string; desc: string }> = {
  zoom: {
    title: 'Zoom de forma de onda',
    desc: 'Porcentaje del buffer de audio visible. Al 100% ves toda la ventana. Valores bajos hacen zoom para ver ciclos individuales de la onda.'
  },
  db: {
    title: 'Sensibilidad (dB)',
    desc: 'Umbral minimo de decibelios. Valores mas negativos (-120) muestran sonidos mas debiles. Util para ver armonicos suaves.'
  },
  fft: {
    title: 'Tamano FFT',
    desc: 'Muestras para la Transformada de Fourier. Valores altos (4096+) dan mejor resolucion en frecuencia. Valores bajos (256) responden mas rapido pero distinguen peor frecuencias cercanas.'
  },
  barras: {
    title: 'Barras del espectro',
    desc: 'Numero de barras en el analizador de espectro. Mas barras = mas detalle visual.'
  },
  peak: {
    title: 'Retencion de picos',
    desc: 'Marca el nivel maximo alcanzado en cada barra con una linea amarilla que decae lentamente. Util para ver la envolvente espectral.'
  },
  linea: {
    title: 'Modo linea',
    desc: 'Dibuja el espectro como una curva continua en vez de barras. Util para ver la forma general del espectro con mas claridad.'
  },
  log: {
    title: 'Escala logaritmica',
    desc: 'Aplica escala log al eje de frecuencias del espectrograma. Imita la percepcion del oido: mas resolucion en graves, menos en agudos.'
  },
  ventana: {
    title: 'Ventana temporal',
    desc: 'Ciclos del patron visibles hacia atras en el piano roll. Valores altos muestran mas contexto musical.'
  },
  spiral: {
    title: 'Mostrar espiral',
    desc: 'La espiral muestra la secuencia temporal de notas enrollada. Util para patrones con poliritmia. Ocultarla da mas espacio al piano roll.'
  },
  punchcard: {
    title: 'Modo Punchcard',
    desc: 'Muestra solo las notas que aparecen en el patron, sin huecos entre ellas. Mas compacto y legible para patrones con pocas notas distintas.'
  },
  solfeo: {
    title: 'Notacion Solfeo',
    desc: 'Cambia entre notacion americana (C, D, E...) y solfeo latino (Do, Re, Mi...).'
  },
  kbLabels: {
    title: 'Mostrar etiquetas',
    desc: 'Muestra el nombre de la nota en todas las teclas, no solo en las activas y en Do.'
  },
  kbMidi: {
    title: 'Numeros MIDI',
    desc: 'Muestra el numero MIDI (0-127) en vez del nombre de la nota. Util para entender la numeracion MIDI.'
  },
  drumCycles: {
    title: 'Ciclos',
    desc: 'Numero de ciclos a mostrar en la rejilla de bateria. Con 1 ciclo se ven los steps individuales con mas detalle.'
  },
  drumPads: {
    title: 'Mostrar pads',
    desc: 'Muestra pads de bateria junto a la rejilla. Los pads se iluminan cuando suena cada instrumento.'
  },
  scoreCycles: {
    title: 'Compases',
    desc: 'Numero de ciclos/compases a mostrar en la partitura. Cada ciclo de Strudel se representa como un compas de 4/4.'
  },
  kbOctava: {
    title: 'Octava inicial',
    desc: 'Primera octava visible en el teclado. Cada octava tiene 12 semitonos (7 teclas blancas + 5 negras).'
  },
  kbOctavas: {
    title: 'Numero de octavas',
    desc: 'Cuantas octavas muestra el teclado. Mas octavas = teclas mas pequeñas.'
  }
}

function closeOpenHelp(e: Event) {
  document.querySelectorAll('.param-help[open]').forEach(el => {
    if (!el.contains(e.target as Node)) {
      el.removeAttribute('open')
    }
  })
}

// Spectrogram clean state (before crosshair)
let spectrogramClean: ImageData | null = null

// Peak hold data
let peakValues: Float32Array | null = null
const PEAK_DECAY = 0.3

const AXIS_WIDTH = 45
const AXIS_HEIGHT = 24

// Detección de pitch
const detectedPitch = ref<{ freq: number; note: string; cents: number } | null>(null)

function detectPitch(data: Float32Array, sampleRate: number): { freq: number; note: string; cents: number } | null {
  const n = data.length
  let rms = 0
  for (let i = 0; i < n; i++) rms += data[i] * data[i]
  rms = Math.sqrt(rms / n)
  if (rms < 0.01) return null

  // Autocorrelación
  const corr = new Float32Array(n)
  for (let lag = 0; lag < n; lag++) {
    let sum = 0
    for (let i = 0; i < n - lag; i++) sum += data[i] * data[i + lag]
    corr[lag] = sum
  }

  // Buscar primer valle después del pico en lag=0
  let d = 0
  while (d < n - 1 && corr[d] > corr[d + 1]) d++

  // Buscar pico máximo después del valle
  let maxVal = -1
  let maxLag = d
  for (let i = d; i < n - 1; i++) {
    if (corr[i] > maxVal) {
      maxVal = corr[i]
      maxLag = i
    }
    if (corr[i] > corr[i + 1] && maxVal > 0.3 * corr[0]) break
  }

  if (maxLag === 0 || maxVal < 0.2 * corr[0]) return null

  // Interpolación parabólica para mayor precisión
  const y0 = maxLag > 0 ? corr[maxLag - 1] : corr[maxLag]
  const y1 = corr[maxLag]
  const y2 = maxLag < n - 1 ? corr[maxLag + 1] : corr[maxLag]
  const shift = (y0 - y2) / (2 * (y0 - 2 * y1 + y2))
  const refinedLag = maxLag + (isFinite(shift) ? shift : 0)

  const freq = sampleRate / refinedLag
  if (freq < 20 || freq > 5000) return null

  const midi = 69 + 12 * Math.log2(freq / 440)
  const roundedMidi = Math.round(midi)
  const cents = Math.round((midi - roundedMidi) * 100)
  const names = solfeo.value ? NOTE_NAMES_SOL : NOTE_NAMES_EN
  const noteName = names[((roundedMidi % 12) + 12) % 12]
  const octave = Math.floor(roundedMidi / 12) - 1

  return { freq, note: `${noteName}${octave}`, cents }
}

// Eventos de notas para piano roll
type NoteEvent = { time: number; dur: number; midi?: number }
let events: NoteEvent[] = []

// Notas para el piano roll
const NOTE_NAMES_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTE_NAMES_SOL = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si']
function midiToNoteName(midi: number): string {
  const names = solfeo.value ? NOTE_NAMES_SOL : NOTE_NAMES_EN
  const note = names[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${note}${octave}`
}

function drawCrosshair(ctx: CanvasRenderingContext2D, mx: number, my: number, label: string, plotX: number, plotHeight: number, showH: boolean = true, showV: boolean = true) {
  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1
  if (showH && my >= 0 && my <= plotHeight) {
    ctx.beginPath()
    ctx.moveTo(plotX, my)
    ctx.lineTo(ctx.canvas.width, my)
    ctx.stroke()
  }
  if (showV && mx >= plotX) {
    ctx.beginPath()
    ctx.moveTo(mx, 0)
    ctx.lineTo(mx, plotHeight)
    ctx.stroke()
  }
  ctx.setLineDash([])

  if (label) {
    const dpr = window.devicePixelRatio || 1
    ctx.font = `${11 * dpr}px monospace`
    const metrics = ctx.measureText(label)
    const pad = 4 * dpr
    const lw = metrics.width + pad * 2
    const lh = 14 * dpr
    let lx = mx + 10 * dpr
    let ly = my - lh - 6 * dpr
    if (lx + lw > ctx.canvas.width) lx = mx - lw - 10 * dpr
    if (ly < 0) ly = my + 6 * dpr
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)'
    ctx.fillRect(lx, ly, lw, lh)
    ctx.fillStyle = '#e2e8f0'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, lx + pad, ly + lh / 2)
  }
  ctx.restore()
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

function drawWaveform(ctx: CanvasRenderingContext2D, data: Float32Array, zoomPct: number, mx: number | null, my: number | null, pitch: { freq: number; note: string; cents: number } | null) {
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
  const sampleCount = Math.max(1, Math.floor(data.length * zoomPct / 100))
  ctx.beginPath()
  ctx.strokeStyle = '#22d3ee'
  ctx.lineWidth = 2
  const slice = plotWidth / sampleCount
  let x = plotX
  for (let i = 0; i < sampleCount; i++) {
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
  ctx.fillText('Tiempo', plotX + plotWidth / 2, plotHeight + AXIS_HEIGHT / 2)

  if (mx !== null && my !== null && mx >= plotX && my <= plotHeight) {
    const amp = 1 - (my / plotHeight) * 2
    drawCrosshair(ctx, mx, my, `${amp.toFixed(2)}`, plotX, plotHeight, true, false)
  }

  // Pitch detection overlay
  if (pitch) {
    const dpr = window.devicePixelRatio || 1
    const centsStr = pitch.cents >= 0 ? `+${pitch.cents}` : `${pitch.cents}`
    const text = `${pitch.note} ${pitch.freq.toFixed(1)}Hz ${centsStr}¢`
    ctx.font = `bold ${12 * dpr}px monospace`
    const tw = ctx.measureText(text).width
    const px = plotX + 6 * dpr
    const py = 6 * dpr
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'
    ctx.fillRect(px - 4 * dpr, py - 2 * dpr, tw + 8 * dpr, 16 * dpr)
    ctx.fillStyle = '#4ade80'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(text, px, py)
  }
}

function drawSpectrum(ctx: CanvasRenderingContext2D, data: Float32Array, sampleRate: number, MIN_DB: number, MAX_DB: number, barCount: number, peaks: Float32Array | null, lineMode: boolean, mx: number | null, my: number | null) {
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
  ctx.textBaseline = 'middle'
  const freqLabels = [100, 500, 1000, 5000, 10000]
  const nyquist = sampleRate / 2

  for (const freq of freqLabels) {
    const logPos = Math.log10(freq / 20) / Math.log10(nyquist / 20)
    const x = plotX + logPos * plotWidth
    if (x > plotX && x < width) {
      ctx.fillStyle = '#64748b'
      ctx.fillText(freq >= 1000 ? `${freq/1000}k` : `${freq}`, x, plotHeight + AXIS_HEIGHT / 2)

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)'
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, plotHeight)
      ctx.stroke()
    }
  }

  // Etiqueta Hz
  ctx.fillStyle = '#64748b'
  ctx.fillText('Hz', width - 15, plotHeight + AXIS_HEIGHT / 2)

  // Dibujar espectro (escala logarítmica)
  if (lineMode) {
    ctx.beginPath()
    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = 2
    for (let i = 0; i < barCount; i++) {
      const logFreq = 20 * Math.pow(nyquist / 20, i / barCount)
      const binIndex = Math.floor((logFreq / nyquist) * data.length)
      if (binIndex >= data.length) continue
      const magnitude = (data[binIndex] - MIN_DB) / (MAX_DB - MIN_DB)
      const clamped = Math.min(Math.max(magnitude, 0), 1)
      const x = plotX + (i / barCount) * plotWidth
      const y = plotHeight - clamped * plotHeight
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Fill bajo la línea
    ctx.lineTo(plotX + plotWidth, plotHeight)
    ctx.lineTo(plotX, plotHeight)
    ctx.closePath()
    ctx.fillStyle = 'rgba(34, 211, 238, 0.1)'
    ctx.fill()
  } else {
    for (let i = 0; i < barCount; i++) {
      const logFreq = 20 * Math.pow(nyquist / 20, i / barCount)
      const binIndex = Math.floor((logFreq / nyquist) * data.length)
      if (binIndex >= data.length) continue
      const magnitude = (data[binIndex] - MIN_DB) / (MAX_DB - MIN_DB)
      const clamped = Math.min(Math.max(magnitude, 0), 1)
      const x = plotX + (i / barCount) * plotWidth
      const barWidth = plotWidth / barCount - 1
      const barHeight = clamped * plotHeight
      const hue = 180 - clamped * 60
      ctx.fillStyle = `hsla(${hue}, 80%, ${40 + clamped * 30}%, ${0.5 + clamped * 0.5})`
      ctx.fillRect(x, plotHeight - barHeight, Math.max(1, barWidth), barHeight)
    }
  }

  // Peak hold
  if (peaks) {
    for (let i = 0; i < barCount; i++) {
      if (i >= peaks.length) break
      const peakHeight = peaks[i] * plotHeight
      const x = plotX + (i / barCount) * plotWidth
      const barWidth = lineMode ? 2 : plotWidth / barCount - 1
      ctx.fillStyle = '#f59e0b'
      ctx.fillRect(x, plotHeight - peakHeight, Math.max(1, barWidth), 2)
    }
  }

  if (mx !== null && my !== null && mx >= plotX && my <= plotHeight) {
    const freqNorm = (mx - plotX) / plotWidth
    const freq = 20 * Math.pow(nyquist / 20, freqNorm)
    const db = MAX_DB + (my / plotHeight) * (MIN_DB - MAX_DB)
    const freqStr = freq >= 1000 ? `${(freq / 1000).toFixed(1)}kHz` : `${Math.round(freq)}Hz`
    drawCrosshair(ctx, mx, my, `${freqStr}  ${db.toFixed(0)}dB`, plotX, plotHeight)
  }
}

function drawSpectrogram(ctx: CanvasRenderingContext2D, data: Float32Array, sampleRate: number, MIN_DB: number, MAX_DB: number, logScale: boolean, mx: number | null, my: number | null) {
  const { width, height } = ctx.canvas
  const plotX = AXIS_WIDTH
  const plotWidth = width - AXIS_WIDTH
  const plotHeight = height - AXIS_HEIGHT

  // Restaurar estado limpio (sin crosshair del frame anterior) antes de scrollear
  if (spectrogramClean) {
    ctx.putImageData(spectrogramClean, 0, 0)
  }

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
    const y = logScale
      ? (1 - Math.log10(freq / 20) / Math.log10(nyquist / 20)) * plotHeight
      : (1 - freq / nyquist) * plotHeight
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
  const logNyquist = Math.log10(nyquist / 20)
  for (let y = 0; y < plotHeight; y++) {
    let index: number
    if (logScale) {
      const freqNorm = 1 - y / plotHeight
      const freq = 20 * Math.pow(10, freqNorm * logNyquist)
      index = Math.floor((freq / nyquist) * (data.length - 1))
    } else {
      index = Math.floor((1 - y / plotHeight) * (data.length - 1))
    }
    index = Math.min(Math.max(index, 0), data.length - 1)
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
  ctx.fillText('Tiempo →', plotX + plotWidth / 2, plotHeight + AXIS_HEIGHT / 2)

  // Guardar estado limpio antes del crosshair
  spectrogramClean = ctx.getImageData(0, 0, width, height)

  if (mx !== null && my !== null && mx >= plotX && my <= plotHeight) {
    let freq: number
    if (logScale) {
      const freqNorm = 1 - my / plotHeight
      freq = 20 * Math.pow(10, freqNorm * logNyquist)
    } else {
      freq = (1 - my / plotHeight) * nyquist
    }
    const freqStr = freq >= 1000 ? `${(freq / 1000).toFixed(1)}kHz` : `${Math.round(freq)}Hz`
    drawCrosshair(ctx, mx, my, freqStr, plotX, plotHeight, true, false)
  }
}

function drawPianoRoll(ctx: CanvasRenderingContext2D, now: number, lookbehind: number, mx: number | null, my: number | null, fold: boolean) {
  const { width, height } = ctx.canvas
  const plotX = AXIS_WIDTH
  const plotWidth = width - AXIS_WIDTH
  const plotHeight = height - AXIS_HEIGHT

  const lookahead = Math.max(lookbehind * 0.25, 0.5)
  const windowCycles = lookbehind + lookahead
  const timeStart = now - lookbehind

  ctx.clearRect(0, 0, width, height)

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
  ctx.fillRect(plotX, 0, plotWidth, plotHeight)

  const visibleEvents = events.filter(e => e.midi !== undefined)

  // Punchcard: solo valores únicos; Piano roll: rango continuo
  let uniquePitches: number[] = []
  let pitchMin = 48
  let pitchMax = 84
  let pitchRange = pitchMax - pitchMin

  if (fold) {
    const pitchSet = new Set(visibleEvents.map(e => e.midi!))
    uniquePitches = [...pitchSet].sort((a, b) => a - b)
    if (uniquePitches.length === 0) uniquePitches = [60]
  } else {
    if (visibleEvents.length > 0) {
      const midiValues = visibleEvents.map(e => e.midi!)
      const minMidi = Math.min(...midiValues)
      const maxMidi = Math.max(...midiValues)
      pitchMin = Math.max(0, Math.floor((minMidi - 6) / 12) * 12)
      pitchMax = Math.min(127, Math.ceil((maxMidi + 6) / 12) * 12)
      if (pitchMax - pitchMin < 24) {
        const mid = (pitchMin + pitchMax) / 2
        pitchMin = Math.max(0, Math.floor(mid - 12))
        pitchMax = Math.min(127, Math.ceil(mid + 12))
      }
    }
    pitchRange = pitchMax - pitchMin
  }

  ctx.fillStyle = '#94a3b8'
  ctx.font = `${10 * (window.devicePixelRatio || 1)}px sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  const rowCount = fold ? uniquePitches.length : pitchRange
  const noteHeight = fold
    ? Math.max(Math.min(plotHeight / (uniquePitches.length + 1), plotHeight * 0.15), 6)
    : Math.max(plotHeight / pitchRange, 6)

  if (fold) {
    // Punchcard: una fila por nota única
    for (let i = 0; i < uniquePitches.length; i++) {
      const y = plotHeight - ((i + 0.5) / uniquePitches.length) * plotHeight
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(plotX, y)
      ctx.lineTo(width, y)
      ctx.stroke()
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(midiToNoteName(uniquePitches[i]), plotX - 5, y)
    }
  } else {
    for (let midi = pitchMin; midi <= pitchMax; midi++) {
      const pitchNorm = (midi - pitchMin) / pitchRange
      const y = plotHeight - pitchNorm * plotHeight
      if (midi % 12 === 0) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(plotX, y)
        ctx.lineTo(width, y)
        ctx.stroke()
        ctx.fillStyle = '#94a3b8'
        ctx.fillText(midiToNoteName(midi), plotX - 5, y)
      } else if (midi % 12 === 4 || midi % 12 === 7) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)'
        ctx.beginPath()
        ctx.moveTo(plotX, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
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

  // Grid vertical
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)'
  const gridLines = Math.ceil(windowCycles * 2)
  for (let i = 0; i <= gridLines; i++) {
    const x = plotX + (i / gridLines) * plotWidth
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, plotHeight)
    ctx.stroke()
  }

  const playheadX = plotX + (lookbehind / windowCycles) * plotWidth

  // Dibujar notas
  for (const event of events) {
    if (event.midi === undefined) continue
    const x = plotX + ((event.time - timeStart) / windowCycles) * plotWidth
    const w = Math.max((event.dur / windowCycles) * plotWidth, 4)

    let y: number
    if (fold) {
      const idx = uniquePitches.indexOf(event.midi)
      if (idx === -1) continue
      y = plotHeight - ((idx + 0.5) / uniquePitches.length) * plotHeight - noteHeight / 2
    } else {
      const pitchNorm = Math.min(Math.max((event.midi - pitchMin) / pitchRange, 0), 1)
      y = plotHeight - pitchNorm * plotHeight - noteHeight / 2
    }

    const isActive = event.time <= now && event.time + event.dur > now
    const hue = (event.midi % 12) * 30
    ctx.fillStyle = isActive
      ? `hsla(${hue}, 80%, 60%, 0.95)`
      : `hsla(${hue}, 60%, 50%, 0.8)`
    ctx.fillRect(x, y, w, noteHeight)
    ctx.strokeStyle = isActive
      ? `hsla(${hue}, 90%, 75%, 1)`
      : `hsla(${hue}, 70%, 40%, 1)`
    ctx.lineWidth = isActive ? 2 : 1
    ctx.strokeRect(x, y, w, noteHeight)

    if (w > 20 && noteHeight > 10) {
      const noteName = midiToNoteName(event.midi)
      ctx.fillStyle = isActive ? '#000' : 'rgba(0,0,0,0.7)'
      ctx.font = `${Math.min(noteHeight * 0.7, 11) * (window.devicePixelRatio || 1)}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(noteName, x + 3, y + noteHeight / 2)
    }
  }

  // Playhead
  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(playheadX, 0)
  ctx.lineTo(playheadX, plotHeight)
  ctx.stroke()

  // Etiqueta inferior
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'center'
  ctx.fillText('Tiempo →', plotX + plotWidth / 2, plotHeight + AXIS_HEIGHT / 2)

  if (mx !== null && my !== null && mx >= plotX && my <= plotHeight) {
    let label: string
    if (fold && uniquePitches.length > 0) {
      const idx = Math.round((1 - my / plotHeight) * uniquePitches.length - 0.5)
      const clamped = Math.min(Math.max(idx, 0), uniquePitches.length - 1)
      label = midiToNoteName(uniquePitches[clamped])
    } else {
      const pitchNorm = 1 - my / plotHeight
      const midi = Math.round(pitchMin + pitchNorm * pitchRange)
      label = midiToNoteName(Math.min(Math.max(midi, 0), 127))
    }
    drawCrosshair(ctx, mx, my, label, plotX, plotHeight, true, false)
  }
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
  const noteNames = solfeo.value ? NOTE_NAMES_SOL : NOTE_NAMES_EN

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

const CHORD_TYPES: [number[], string][] = [
  // Triadas
  [[0, 4, 7], 'maj'],
  [[0, 3, 7], 'm'],
  [[0, 3, 6], 'dim'],
  [[0, 4, 8], 'aug'],
  [[0, 2, 7], 'sus2'],
  [[0, 5, 7], 'sus4'],
  [[0, 7], '5'],
  // Séptimas
  [[0, 4, 7, 11], 'maj7'],
  [[0, 3, 7, 10], 'm7'],
  [[0, 4, 7, 10], '7'],
  [[0, 3, 6, 9], 'dim7'],
  [[0, 3, 6, 10], 'm7b5'],
  [[0, 3, 7, 11], 'mMaj7'],
  [[0, 4, 8, 10], 'aug7'],
  // Sextas
  [[0, 4, 7, 9], '6'],
  [[0, 3, 7, 9], 'm6'],
  // Novenas (sin 5ta implícita)
  [[0, 4, 7, 10, 14], '9'],
  [[0, 3, 7, 10, 14], 'm9'],
  [[0, 4, 7, 11, 14], 'maj9'],
  // Add
  [[0, 2, 4, 7], 'add9'],
  [[0, 4, 5, 7], 'add4'],
]

function detectChord(midiNotes: number[]): string | null {
  if (midiNotes.length < 2) return null

  const pitchClasses = [...new Set(midiNotes.map(n => Math.round(n) % 12))].sort((a, b) => a - b)
  if (pitchClasses.length < 2) return null

  const names = solfeo.value ? NOTE_NAMES_SOL : NOTE_NAMES_EN
  let bestMatch: string | null = null
  let bestScore = 0

  for (const root of pitchClasses) {
    const intervals = pitchClasses.map(p => (p - root + 12) % 12).sort((a, b) => a - b)

    for (const [pattern, suffix] of CHORD_TYPES) {
      if (pattern.length > intervals.length) continue
      const matches = pattern.every(i => intervals.includes(i))
      if (matches && pattern.length > bestScore) {
        bestScore = pattern.length
        const rootName = names[root]
        bestMatch = `${rootName}${suffix}`
        if (intervals[0] !== 0) {
          const bassNote = names[pitchClasses[0]]
          bestMatch += `/${bassNote}`
        }
      }
    }
  }

  return bestMatch
}

function drawKeyboard(ctx: CanvasRenderingContext2D, now: number, startMidi: number, endMidi: number, kbEvents: NoteEvent[], labels: boolean, midiNumbers: boolean) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
  ctx.fillRect(0, 0, width, height)

  const dpr = window.devicePixelRatio || 1
  const labelHeight = 18 * dpr

  // Contar teclas blancas en el rango
  const isBlack = [false, true, false, true, false, false, true, false, true, false, true, false]
  let whiteCount = 0
  for (let m = startMidi; m < endMidi; m++) {
    if (!isBlack[m % 12]) whiteCount++
  }
  if (whiteCount === 0) return

  const whiteWidth = width / whiteCount
  const whiteHeight = height - labelHeight
  const blackWidth = whiteWidth * 0.6
  const blackHeight = whiteHeight * 0.63

  // Notas activas (enteras y fraccionarias con intensidad)
  const activeNotes = new Set<number>()
  const microtonalNotes = new Map<number, number>()
  for (const e of kbEvents) {
    if (e.midi !== undefined && e.time <= now && e.time + e.dur > now) {
      if (e.midi % 1 === 0) {
        activeNotes.add(e.midi)
      } else {
        const frac = e.midi - Math.floor(e.midi)
        const lo = Math.floor(e.midi)
        const hi = Math.ceil(e.midi)
        const loIntensity = 1 - frac
        const hiIntensity = frac
        microtonalNotes.set(lo, Math.max(microtonalNotes.get(lo) || 0, loIntensity))
        microtonalNotes.set(hi, Math.max(microtonalNotes.get(hi) || 0, hiIntensity))
      }
    }
  }

  const names = solfeo.value ? NOTE_NAMES_SOL : NOTE_NAMES_EN
  const fontSize = Math.min(11 * dpr, whiteWidth * 0.4)
  const smallFontSize = Math.min(9 * dpr, blackWidth * 0.5)

  // Dibujar teclas blancas
  let wx = 0
  for (let m = startMidi; m < endMidi; m++) {
    if (isBlack[m % 12]) continue
    const active = activeNotes.has(m)
    const microInt = microtonalNotes.get(m)
    const micro = microInt !== undefined
    if (active) {
      ctx.fillStyle = '#3b82f6'
    } else if (micro) {
      const alpha = 0.3 + microInt * 0.7
      ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`
    } else {
      ctx.fillStyle = '#f1f5f9'
    }
    ctx.fillRect(wx, 0, whiteWidth - 1, whiteHeight)
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1
    ctx.strokeRect(wx, 0, whiteWidth - 1, whiteHeight)

    if (labels || m % 12 === 0 || active || micro) {
      const label = midiNumbers ? String(m) : `${names[m % 12]}${Math.floor(m / 12) - 1}`
      ctx.font = `bold ${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillStyle = (active || (micro && microInt > 0.4)) ? '#fff' : '#475569'
      ctx.fillText(label, wx + (whiteWidth - 1) / 2, whiteHeight - 4 * dpr)
    }
    wx += whiteWidth
  }

  // Dibujar teclas negras
  wx = 0
  for (let m = startMidi; m < endMidi; m++) {
    if (isBlack[m % 12]) {
      const active = activeNotes.has(m)
      const microInt = microtonalNotes.get(m)
      const micro = microInt !== undefined
      const bx = wx - blackWidth / 2
      if (active) {
        ctx.fillStyle = '#60a5fa'
      } else if (micro) {
        const r = Math.round(30 + microInt * 187)
        const g = Math.round(41 + microInt * 78)
        const b = Math.round(59 - microInt * 53)
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      } else {
        ctx.fillStyle = '#1e293b'
      }
      ctx.fillRect(bx, 0, blackWidth, blackHeight)
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 1
      ctx.strokeRect(bx, 0, blackWidth, blackHeight)

      if (labels || active || micro) {
        const label = midiNumbers ? String(m) : names[m % 12]
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${smallFontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(label, bx + blackWidth / 2, blackHeight - 3 * dpr)
      }
    } else {
      wx += whiteWidth
    }
  }

  // Detección de acorde
  const activeMidis = [...activeNotes]
  for (const e of kbEvents) {
    if (e.midi !== undefined && e.midi % 1 !== 0 && e.time <= now && e.time + e.dur > now) {
      activeMidis.push(e.midi)
    }
  }
  const chord = detectChord(activeMidis)
  if (chord) {
    ctx.font = `bold ${16 * dpr}px sans-serif`
    const tw = ctx.measureText(chord).width
    const px = width / 2
    const py = 14 * dpr
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
    ctx.fillRect(px - tw / 2 - 8 * dpr, py - 12 * dpr, tw + 16 * dpr, 20 * dpr)
    ctx.fillStyle = '#22d3ee'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(chord, px, py)
  }
}

// Percussion staff positions (line index from top, 0 = above staff, 4 = bottom line)
const PERC_POSITION: Record<string, number> = {
  cr: -0.5, cy: -0.5, oh: 0, hh: 0, ch: 0,
  rim: 1, cb: 1.5, tom: 2, cp: 2.5, sd: 3, bd: 4.5
}
const PERC_X_HEAD = new Set(['hh', 'ch', 'oh', 'cr', 'cy', 'rim'])

function drawScore(ctx: CanvasRenderingContext2D, scoreEvents: NoteEvent[], now: number, numCycles: number, mx: number | null, my: number | null, drumEvts: DrumEvent[]) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)

  const dpr = window.devicePixelRatio || 1
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, width, height)

  const marginLeft = 50 * dpr
  const marginRight = 20 * dpr
  const marginTop = 20 * dpr
  const scoreWidth = width - marginLeft - marginRight

  const hasMelody = scoreEvents.some(e => e.midi !== undefined)
  const hasDrums = drumEvts.length > 0
  const totalStaves = (hasMelody ? 1 : 0) + (hasDrums ? 1 : 0) || 1

  const lineSpacing = Math.min((height - marginTop * 2) / (totalStaves * 7 + 2), 8 * dpr)
  const noteRadius = lineSpacing * 0.45

  const midiValues = scoreEvents.filter(e => e.midi !== undefined).map(e => Math.round(e.midi!))
  const minMidi = midiValues.length > 0 ? Math.min(...midiValues) : 60
  const maxMidi = midiValues.length > 0 ? Math.max(...midiValues) : 72
  const useBassClef = hasMelody && minMidi < 55
  const useTrebleClef = hasMelody && maxMidi >= 55

  let trebleY = 0, bassY = 0, percY = 0
  if (hasMelody && hasDrums) {
    trebleY = marginTop
    percY = marginTop + lineSpacing * 7
  } else if (hasDrums) {
    percY = marginTop + (height - marginTop * 2) / 2 - lineSpacing * 2
  } else if (useBassClef && useTrebleClef) {
    trebleY = marginTop + lineSpacing * 2
    bassY = marginTop + lineSpacing * 9
  } else if (useBassClef) {
    bassY = marginTop + (height - marginTop * 2) / 2 - lineSpacing * 2
  } else {
    trebleY = marginTop + (height - marginTop * 2) / 2 - lineSpacing * 2
  }

  const staffMidY = useTrebleClef ? trebleY + lineSpacing * 2 : (hasDrums && !hasMelody) ? percY + lineSpacing * 2 : bassY + lineSpacing * 2

  // Staff lines
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 1
  function drawStaff(y: number) {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.moveTo(marginLeft, y + i * lineSpacing)
      ctx.lineTo(width - marginRight, y + i * lineSpacing)
      ctx.stroke()
    }
  }
  if (useTrebleClef) drawStaff(trebleY)
  if (useBassClef) drawStaff(bassY)

  // Clefs
  ctx.fillStyle = '#1e293b'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  if (useTrebleClef) { ctx.font = `bold ${lineSpacing * 4}px serif`; ctx.fillText('𝄞', marginLeft - 20 * dpr, trebleY + lineSpacing * 2) }
  if (useBassClef) { ctx.font = `bold ${lineSpacing * 3}px serif`; ctx.fillText('𝄢', marginLeft - 20 * dpr, bassY + lineSpacing * 2) }

  // Percussion staff
  if (hasDrums) {
    drawStaff(percY)
    // Percussion clef: two vertical bars
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 3 * dpr
    const clefX = marginLeft - 22 * dpr
    ctx.beginPath(); ctx.moveTo(clefX, percY + lineSpacing); ctx.lineTo(clefX, percY + lineSpacing * 3); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(clefX + 6 * dpr, percY + lineSpacing); ctx.lineTo(clefX + 6 * dpr, percY + lineSpacing * 3); ctx.stroke()
    ctx.lineWidth = 1
  }

  // Bar lines
  const measureWidth = scoreWidth / numCycles
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 1
  const barTop = useTrebleClef ? trebleY : (hasDrums ? percY : bassY)
  const barBottom = hasDrums ? percY + lineSpacing * 4 : (useBassClef ? bassY + lineSpacing * 4 : trebleY + lineSpacing * 4)
  for (let m = 0; m <= numCycles; m++) {
    const x = marginLeft + m * measureWidth
    ctx.beginPath(); ctx.moveTo(x, barTop); ctx.lineTo(x, barBottom); ctx.stroke()
  }

  // Beat grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)'
  ctx.setLineDash([2, 4])
  for (let m = 0; m < numCycles; m++) {
    for (let b = 1; b < 4; b++) {
      const x = marginLeft + m * measureWidth + (b / 4) * measureWidth
      ctx.beginPath(); ctx.moveTo(x, barTop); ctx.lineTo(x, barBottom); ctx.stroke()
    }
  }
  ctx.setLineDash([])

  // Helpers
  const NOTE_Y_MAP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
  const IS_SHARP = [false, true, false, true, false, false, true, false, true, false, true, false]

  function midiToStaffY(midi: number): { y: number; ledgerLines: number[]; sharp: boolean } {
    const octave = Math.floor(midi / 12) - 1
    const diatonicPos = (octave - 4) * 7 + NOTE_Y_MAP[midi % 12]
    const sharp = IS_SHARP[midi % 12]
    let y: number, staffTop: number
    const ledgerLines: number[] = []

    if (midi >= 55 && useTrebleClef) {
      y = trebleY + lineSpacing * 2 - (diatonicPos - 6) * (lineSpacing / 2)
      staffTop = trebleY
    } else {
      y = bassY + lineSpacing * 2 - (diatonicPos + 5) * (lineSpacing / 2)
      staffTop = bassY
    }
    if (y > staffTop + lineSpacing * 4 + lineSpacing * 0.25) {
      for (let ly = staffTop + lineSpacing * 5; ly <= y + lineSpacing * 0.25; ly += lineSpacing) ledgerLines.push(ly)
    }
    if (y < staffTop - lineSpacing * 0.25) {
      for (let ly = staffTop - lineSpacing; ly >= y - lineSpacing * 0.25; ly -= lineSpacing) ledgerLines.push(ly)
    }
    return { y, ledgerLines, sharp }
  }

  function durToType(dur: number): 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' {
    if (dur >= 0.9) return 'whole'
    if (dur >= 0.45) return 'half'
    if (dur >= 0.2) return 'quarter'
    if (dur >= 0.1) return 'eighth'
    return 'sixteenth'
  }

  // Group simultaneous notes into chords
  type ScoreNote = { midi: number; time: number; dur: number; x: number; y: number; ledgerLines: number[]; sharp: boolean; type: ReturnType<typeof durToType>; active: boolean }
  const notes: ScoreNote[] = []

  for (const e of scoreEvents) {
    if (e.midi === undefined || e.time < 0 || e.time >= numCycles) continue
    const midi = Math.round(e.midi)
    const x = marginLeft + (e.time / numCycles) * scoreWidth
    const { y, ledgerLines, sharp } = midiToStaffY(midi)
    notes.push({ midi, time: e.time, dur: e.dur, x, y, ledgerLines, sharp, type: durToType(e.dur), active: e.time <= now && e.time + e.dur > now })
  }

  // Group into chords (same time) and beaming groups (consecutive eighths/sixteenths)
  type Chord = ScoreNote[]
  const chords: Chord[] = []
  const epsilon = 0.001

  const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi)
  let i = 0
  while (i < sorted.length) {
    const chord: Chord = [sorted[i]]
    while (i + 1 < sorted.length && Math.abs(sorted[i + 1].time - sorted[i].time) < epsilon) {
      i++
      chord.push(sorted[i])
    }
    chords.push(chord)
    i++
  }

  // Draw function for a single note head + accidental
  function drawNoteHead(n: ScoreNote, xOff: number, color: string) {
    const nx = n.x + xOff
    // Ledger lines
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1
    for (const ly of n.ledgerLines) {
      ctx.beginPath(); ctx.moveTo(nx - noteRadius * 1.5, ly); ctx.lineTo(nx + noteRadius * 1.5, ly); ctx.stroke()
    }
    // Sharp
    if (n.sharp) {
      ctx.fillStyle = color; ctx.font = `${lineSpacing * 1.2}px serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('♯', nx - noteRadius * 2.2, n.y)
    }
    // Head
    ctx.beginPath()
    ctx.ellipse(nx, n.y, noteRadius, noteRadius * 0.7, -0.3, 0, Math.PI * 2)
    if (n.type === 'whole' || n.type === 'half') {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke()
    } else {
      ctx.fillStyle = color; ctx.fill()
    }
  }

  // Draw chords
  for (const chord of chords) {
    const color = chord[0].active ? '#3b82f6' : '#1e293b'
    const type = chord[0].type
    const baseX = chord[0].x

    // For chords: check if adjacent notes need offset (second interval = 1 diatonic step)
    const ys = chord.map(n => n.y).sort((a, b) => a - b)
    const needsOffset: boolean[] = chord.map(() => false)
    if (chord.length > 1) {
      const sortedByY = [...chord].sort((a, b) => a.y - b.y)
      for (let j = 1; j < sortedByY.length; j++) {
        if (Math.abs(sortedByY[j].y - sortedByY[j - 1].y) < lineSpacing * 0.75) {
          const idx = chord.indexOf(sortedByY[j])
          needsOffset[idx] = true
        }
      }
    }

    // Draw note heads
    for (let j = 0; j < chord.length; j++) {
      drawNoteHead(chord[j], needsOffset[j] ? noteRadius * 2.2 : 0, color)
    }

    // Stem direction: majority vote
    const stemUp = chord.filter(n => n.y > staffMidY).length >= chord.length / 2
    const topY = Math.min(...ys)
    const bottomY = Math.max(...ys)

    if (type !== 'whole') {
      const stemLength = lineSpacing * 3.5
      const sx = stemUp ? baseX + noteRadius * 0.9 : baseX - noteRadius * 0.9
      const stemStart = stemUp ? bottomY : topY
      const stemEnd = stemUp ? topY - stemLength : bottomY + stemLength

      ctx.strokeStyle = color; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(sx, stemStart); ctx.lineTo(sx, stemEnd); ctx.stroke()

      // Store for beaming
      ;(chord as any)._stemX = sx
      ;(chord as any)._stemEnd = stemEnd
      ;(chord as any)._stemUp = stemUp
    }
  }

  // Beaming: connect consecutive eighth/sixteenth chords
  for (let ci = 0; ci < chords.length; ci++) {
    const c = chords[ci]
    if (c[0].type !== 'eighth' && c[0].type !== 'sixteenth') continue

    // Find beam group: consecutive chords with same type in same beat
    const beat = Math.floor(c[0].time * 4) // which beat (0-based within pattern)
    let beamEnd = ci
    while (beamEnd + 1 < chords.length) {
      const nc = chords[beamEnd + 1]
      if ((nc[0].type !== 'eighth' && nc[0].type !== 'sixteenth') || Math.floor(nc[0].time * 4) !== beat) break
      beamEnd++
    }

    if (beamEnd > ci) {
      // Draw beam
      const beamChords = chords.slice(ci, beamEnd + 1)
      const stemUp = (beamChords[0] as any)._stemUp
      const color = beamChords[0][0].active ? '#3b82f6' : '#1e293b'
      ctx.fillStyle = color

      for (let b = 0; b < (beamChords[0][0].type === 'sixteenth' ? 2 : 1); b++) {
        const beamOffset = b * lineSpacing * 0.8 * (stemUp ? 1 : -1)
        for (let bi = 0; bi < beamChords.length - 1; bi++) {
          const x1 = (beamChords[bi] as any)._stemX
          const y1 = (beamChords[bi] as any)._stemEnd + beamOffset
          const x2 = (beamChords[bi + 1] as any)._stemX
          const y2 = (beamChords[bi + 1] as any)._stemEnd + beamOffset
          ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2) - lineSpacing * 0.15, Math.abs(x2 - x1), lineSpacing * 0.3)
        }
      }
      ci = beamEnd // skip beamed notes
    } else {
      // Single note: draw flag
      const sx = (c as any)._stemX
      const sy = (c as any)._stemEnd
      const stemUp = (c as any)._stemUp
      const flagDir = stemUp ? 1 : -1
      ctx.strokeStyle = c[0].active ? '#3b82f6' : '#1e293b'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.quadraticCurveTo(sx + 8 * dpr * flagDir, sy + lineSpacing * 1.5 * flagDir, sx, sy + lineSpacing * 2.5 * flagDir)
      ctx.stroke()
      if (c[0].type === 'sixteenth') {
        ctx.beginPath()
        ctx.moveTo(sx, sy + lineSpacing * 0.8 * flagDir)
        ctx.quadraticCurveTo(sx + 8 * dpr * flagDir, sy + lineSpacing * 2.3 * flagDir, sx, sy + lineSpacing * 3.3 * flagDir)
        ctx.stroke()
      }
    }
  }

  // Percussion notes
  if (hasDrums) {
    const PERC_LABELS: Record<string, string> = {
      bd: 'B', sd: 'S', hh: 'H', oh: 'O', ch: 'H',
      cp: 'Cl', tom: 'T', rim: 'R', cb: 'Cb', cy: 'Cy', cr: 'Cr'
    }

    for (const de of drumEvts) {
      if (de.time < 0 || de.time >= numCycles) continue

      const pos = PERC_POSITION[de.sound] ?? 2
      const y = percY + pos * lineSpacing
      const x = marginLeft + (de.time / numCycles) * scoreWidth
      const isActive = de.time <= now && de.time + de.dur > now
      const color = isActive ? '#3b82f6' : '#1e293b'
      const useX = PERC_X_HEAD.has(de.sound)

      // Ledger line if needed
      if (pos < 0 || pos > 4) {
        ctx.strokeStyle = '#94a3b8'
        ctx.lineWidth = 1
        const ly = pos < 0 ? percY - lineSpacing : percY + lineSpacing * 5
        ctx.beginPath(); ctx.moveTo(x - noteRadius * 1.5, ly); ctx.lineTo(x + noteRadius * 1.5, ly); ctx.stroke()
      }

      if (useX) {
        // X notehead
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        const s = noteRadius * 0.7
        ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke()
      } else {
        // Regular filled notehead
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.ellipse(x, y, noteRadius, noteRadius * 0.7, -0.3, 0, Math.PI * 2)
        ctx.fill()
      }

      // Stem
      const stemUp = pos <= 2
      const stemLen = lineSpacing * 3
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      if (stemUp) {
        ctx.moveTo(x + noteRadius * 0.8, y)
        ctx.lineTo(x + noteRadius * 0.8, y - stemLen)
      } else {
        ctx.moveTo(x - noteRadius * 0.8, y)
        ctx.lineTo(x - noteRadius * 0.8, y + stemLen)
      }
      ctx.stroke()

      // Small label next to note
      if (isActive) {
        ctx.fillStyle = '#3b82f6'
        ctx.font = `${8 * dpr}px sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(PERC_LABELS[de.sound] || de.sound, x + noteRadius * 1.5, y)
      }
    }
  }

  // Rests: find gaps in each beat subdivision
  const restSymbols: Record<string, string> = { whole: '𝄻', half: '𝄼', quarter: '𝄽', eighth: '𝄾', sixteenth: '𝄿' }
  const restStaffY = useTrebleClef ? trebleY + lineSpacing * 1.5 : bassY + lineSpacing * 1.5

  for (let m = 0; m < numCycles; m++) {
    // Check each quarter beat for notes
    for (let b = 0; b < 4; b++) {
      const beatStart = m + b / 4
      const beatEnd = m + (b + 1) / 4
      const hasNote = scoreEvents.some(e => e.midi !== undefined && e.time < beatEnd && e.time + e.dur > beatStart)
      if (!hasNote) {
        const rx = marginLeft + (beatStart / numCycles) * scoreWidth + measureWidth / 8
        ctx.fillStyle = '#94a3b8'
        ctx.font = `${lineSpacing * 2}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(restSymbols.quarter, rx, restStaffY)
      }
    }
  }

  // Playhead
  if (now >= 0 && now < numCycles) {
    const px = marginLeft + (now / numCycles) * scoreWidth
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(px, barTop - lineSpacing); ctx.lineTo(px, barBottom + lineSpacing); ctx.stroke()
  }

  // Measure numbers
  ctx.fillStyle = '#94a3b8'
  ctx.font = `${9 * dpr}px sans-serif`
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
  for (let m = 0; m < numCycles; m++) {
    ctx.fillText(`${m + 1}`, marginLeft + m * measureWidth + 3 * dpr, barTop - 3 * dpr)
  }

  // Hover: show note name
  if (mx !== null && my !== null && mx >= marginLeft && mx <= width - marginRight) {
    const timePos = ((mx - marginLeft) / scoreWidth) * numCycles
    const closest = notes.reduce<ScoreNote | null>((best, n) => {
      const dist = Math.abs(n.x - mx) + Math.abs(n.y - my)
      if (dist < noteRadius * 4 && (!best || dist < Math.abs(best.x - mx) + Math.abs(best.y - my))) return n
      return best
    }, null)
    if (closest) {
      const names = solfeo.value ? NOTE_NAMES_SOL : NOTE_NAMES_EN
      const label = `${names[closest.midi % 12]}${Math.floor(closest.midi / 12) - 1}`
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)'
      ctx.font = `bold ${11 * dpr}px monospace`
      const tw = ctx.measureText(label).width
      const lx = mx + 10 * dpr
      const ly = my - 16 * dpr
      ctx.fillRect(lx - 4 * dpr, ly - 2 * dpr, tw + 8 * dpr, 14 * dpr)
      ctx.fillStyle = '#e2e8f0'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(label, lx, ly + 5 * dpr)
    }
  }
}

const DRUM_NAMES = ['bd', 'sd', 'hh', 'oh', 'ch', 'cp', 'tom', 'rim', 'cb', 'cy', 'cr']
const DRUM_LABELS: Record<string, string> = {
  bd: 'Kick', sd: 'Snare', hh: 'HiHat', oh: 'Open HH',
  ch: 'Closed HH', cp: 'Clap', tom: 'Tom', rim: 'Rim',
  cb: 'Cowbell', cy: 'Cymbal', cr: 'Crash'
}
const DRUM_COLORS: Record<string, string> = {
  bd: '#ef4444', sd: '#f59e0b', hh: '#22d3ee', oh: '#06b6d4',
  ch: '#67e8f9', cp: '#a78bfa', tom: '#fb923c', rim: '#fbbf24',
  cb: '#4ade80', cy: '#818cf8', cr: '#c084fc'
}

type DrumEvent = { time: number; dur: number; sound: string }

function hapsToDrumEvents(haps: any[]): DrumEvent[] {
  const result: DrumEvent[] = []
  for (const hap of haps) {
    if (!hap.value) continue
    const s = hap.value.s
    if (!s || hap.value.note !== undefined) continue
    const time = hap.whole?.begin?.valueOf() ?? 0
    const end = hap.whole?.end?.valueOf() ?? time
    result.push({ time, dur: end - time, sound: s })
  }
  return result
}

function drawDrums(ctx: CanvasRenderingContext2D, drumEvents: DrumEvent[], now: number, numCycles: number, showPads: boolean) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)

  const dpr = window.devicePixelRatio || 1
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
  ctx.fillRect(0, 0, width, height)

  // Show all drums, highlight the ones in use
  const usedSet = new Set(drumEvents.map(e => e.sound))
  const usedDrums = [...DRUM_NAMES]

  const padWidth = showPads ? Math.min(height * 0.9, width * 0.2) : 0
  const gridLeft = 50 * dpr
  const gridRight = width - padWidth - 10 * dpr
  const gridWidth = gridRight - gridLeft
  const rowHeight = Math.min(height / (usedDrums.length + 0.5), 30 * dpr)
  const gridTop = (height - rowHeight * usedDrums.length) / 2

  // Active drums (sounding now)
  const activeDrums = new Set<string>()
  for (const e of drumEvents) {
    if (e.time <= now && e.time + e.dur > now) {
      activeDrums.add(e.sound)
    }
  }

  // Draw grid rows
  ctx.font = `${10 * dpr}px sans-serif`
  ctx.textBaseline = 'middle'

  for (let r = 0; r < usedDrums.length; r++) {
    const drum = usedDrums[r]
    const y = gridTop + r * rowHeight
    const color = DRUM_COLORS[drum] || '#94a3b8'
    const active = activeDrums.has(drum)
    const inUse = usedSet.has(drum)

    // Row background
    ctx.fillStyle = active ? `${color}15` : r % 2 === 0 ? 'rgba(30, 41, 59, 0.5)' : 'rgba(30, 41, 59, 0.3)'
    ctx.fillRect(gridLeft, y, gridWidth, rowHeight - 1)

    // Label
    ctx.fillStyle = active ? color : inUse ? '#94a3b8' : '#475569'
    ctx.textAlign = 'right'
    ctx.font = `${active ? 'bold ' : ''}${10 * dpr}px sans-serif`
    ctx.fillText(DRUM_LABELS[drum] || drum, gridLeft - 6 * dpr, y + rowHeight / 2)

    // Draw hits for this drum
    for (const e of drumEvents) {
      if (e.sound !== drum) continue
      if (e.time < 0 || e.time >= numCycles) continue

      const x = gridLeft + (e.time / numCycles) * gridWidth
      const w = Math.max((e.dur / numCycles) * gridWidth, 4 * dpr)
      const isActive = e.time <= now && e.time + e.dur > now

      ctx.fillStyle = isActive ? color : `${color}99`
      ctx.fillRect(x, y + 2, w, rowHeight - 5)

      if (isActive) {
        ctx.shadowColor = color
        ctx.shadowBlur = 8 * dpr
        ctx.fillRect(x, y + 2, w, rowHeight - 5)
        ctx.shadowBlur = 0
      }
    }
  }

  // Grid lines (beats)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)'
  ctx.lineWidth = 1
  const stepsPerCycle = 4
  for (let m = 0; m < numCycles; m++) {
    for (let b = 0; b <= stepsPerCycle; b++) {
      const x = gridLeft + ((m + b / stepsPerCycle) / numCycles) * gridWidth
      ctx.strokeStyle = b === 0 ? 'rgba(148, 163, 184, 0.5)' : 'rgba(148, 163, 184, 0.15)'
      ctx.beginPath()
      ctx.moveTo(x, gridTop)
      ctx.lineTo(x, gridTop + usedDrums.length * rowHeight)
      ctx.stroke()
    }
  }

  // Playhead
  if (now >= 0 && now < numCycles) {
    const px = gridLeft + (now / numCycles) * gridWidth
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(px, gridTop - 4 * dpr)
    ctx.lineTo(px, gridTop + usedDrums.length * rowHeight + 4 * dpr)
    ctx.stroke()
  }

  // Drum pads
  if (showPads && padWidth > 0) {
    const padArea = width - padWidth
    const cols = Math.ceil(Math.sqrt(usedDrums.length))
    const rows = Math.ceil(usedDrums.length / cols)
    const padSize = Math.min((padWidth - 10 * dpr) / cols, (height - 10 * dpr) / rows) - 4 * dpr
    const padStartX = padArea + (padWidth - cols * (padSize + 4 * dpr)) / 2
    const padStartY = (height - rows * (padSize + 4 * dpr)) / 2

    for (let i = 0; i < usedDrums.length; i++) {
      const drum = usedDrums[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const px = padStartX + col * (padSize + 4 * dpr)
      const py = padStartY + row * (padSize + 4 * dpr)
      const color = DRUM_COLORS[drum] || '#94a3b8'
      const active = activeDrums.has(drum)

      // Pad background
      if (active) {
        ctx.shadowColor = color
        ctx.shadowBlur = 12 * dpr
      }
      ctx.fillStyle = active ? color : '#1e293b'
      ctx.fillRect(px, py, padSize, padSize)
      ctx.shadowBlur = 0

      ctx.strokeStyle = active ? color : '#475569'
      ctx.lineWidth = active ? 2 : 1
      ctx.strokeRect(px, py, padSize, padSize)

      // Label
      ctx.fillStyle = active ? '#000' : '#94a3b8'
      ctx.font = `bold ${Math.min(10 * dpr, padSize * 0.25)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(DRUM_LABELS[drum] || drum, px + padSize / 2, py + padSize / 2)
    }
  }
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

  const handlePlay = () => {
    clearAll()
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

  const LOOKAHEAD = 2

  function updatePeaks(data: Float32Array, sampleRate: number, MIN_DB: number, MAX_DB: number, barCount: number) {
    if (!peakValues || peakValues.length !== barCount) {
      peakValues = new Float32Array(barCount)
    }
    const nyquist = sampleRate / 2
    for (let i = 0; i < barCount; i++) {
      const logFreq = 20 * Math.pow(nyquist / 20, i / barCount)
      const binIndex = Math.floor((logFreq / nyquist) * data.length)
      if (binIndex >= data.length) continue
      const magnitude = (data[binIndex] - MIN_DB) / (MAX_DB - MIN_DB)
      const clamped = Math.min(Math.max(magnitude, 0), 1)
      if (clamped > peakValues[i]) {
        peakValues[i] = clamped
      } else {
        peakValues[i] = Math.max(0, peakValues[i] - PEAK_DECAY / 60)
      }
    }
  }

  function draw() {
    if (activeGroup.value === 'audio') {
      const wCtx = waveformCanvas.value?.getContext('2d')
      const sCtx = spectrumCanvas.value?.getContext('2d')
      const sgCtx = spectrogramCanvas.value?.getContext('2d')

      if (waveformCanvas.value) resizeCanvas(waveformCanvas.value)
      if (spectrumCanvas.value) resizeCanvas(spectrumCanvas.value)
      if (spectrogramCanvas.value) resizeCanvas(spectrogramCanvas.value)

      if (hasAnalyser(ANALYZER_ID) && !frozen.value) {
        const timeDataRaw = getAnalyzerData('time', ANALYZER_ID)
        const timeData = timeDataRaw ? new Float32Array(timeDataRaw) : null
        const freqData = getAnalyzerData('frequency', ANALYZER_ID)

        if (peakHold.value && freqData) {
          updatePeaks(freqData, actualSampleRate, minDb.value, maxDb.value, numBars.value)
        }

        const wMx = hoverCanvas.value === 'waveform' ? hoverX.value : null
        const wMy = hoverCanvas.value === 'waveform' ? hoverY.value : null
        const sMx = hoverCanvas.value === 'spectrum' ? hoverX.value : null
        const sMy = hoverCanvas.value === 'spectrum' ? hoverY.value : null
        const sgMx = hoverCanvas.value === 'spectrogram' ? hoverX.value : null
        const sgMy = hoverCanvas.value === 'spectrogram' ? hoverY.value : null

        if (timeData) detectedPitch.value = detectPitch(timeData, actualSampleRate)
        if (wCtx && timeData) drawWaveform(wCtx, timeData, waveZoom.value, wMx, wMy, detectedPitch.value)
        if (sCtx && freqData) drawSpectrum(sCtx, freqData, actualSampleRate, minDb.value, maxDb.value, numBars.value, peakHold.value ? peakValues : null, spectrumLine.value, sMx, sMy)
        if (sgCtx && freqData) drawSpectrogram(sgCtx, freqData, actualSampleRate, minDb.value, maxDb.value, spectrogramLog.value, sgMx, sgMy)
      } else if (!hasAnalyser(ANALYZER_ID)) {
        if (wCtx) drawEmptyCanvas(wCtx, 'Esperando audio...')
        if (sCtx) drawEmptyCanvas(sCtx, 'Esperando audio...')
        if (sgCtx) drawEmptyCanvas(sgCtx, 'Esperando audio...')
      }
    } else if (activeGroup.value === 'notes' && !frozen.value) {
      const spCtx = spiralCanvas.value?.getContext('2d')
      const pwCtx = pitchwheelCanvas.value?.getContext('2d')
      const prCtx = pianorollCanvas.value?.getContext('2d')

      if (spiralCanvas.value) resizeCanvas(spiralCanvas.value)
      if (pitchwheelCanvas.value) resizeCanvas(pitchwheelCanvas.value)
      if (pianorollCanvas.value) resizeCanvas(pianorollCanvas.value)

      const now = getSchedulerTime()

      // Spiral/pitchwheel: ventana fija amplia
      const spPwHaps = queryPattern(now - 4, now + LOOKAHEAD)
      const spPwEvents = hapsToEvents(spPwHaps)

      // Piano roll: ventana configurable
      const prHaps = queryPattern(now - pianoLookbehind.value, now + LOOKAHEAD)
      events = hapsToEvents(prHaps)

      if (spCtx) { const saved = events; events = spPwEvents; drawSpiral(spCtx, now); events = saved }
      if (pwCtx) { const saved = events; events = spPwEvents; drawPitchwheel(pwCtx, now); events = saved }
      const prMx = hoverCanvas.value === 'pianoroll' ? hoverX.value : null
      const prMy = hoverCanvas.value === 'pianoroll' ? hoverY.value : null
      if (prCtx) drawPianoRoll(prCtx, now, pianoLookbehind.value, prMx, prMy, punchcard.value)
    } else if (activeGroup.value === 'keyboard' && !frozen.value) {
      const kbCtx = keyboardCanvas.value?.getContext('2d')
      if (keyboardCanvas.value) resizeCanvas(keyboardCanvas.value)

      const now = getSchedulerTime()
      const kbHaps = queryPattern(now - 1, now + 1)
      const kbEvents = hapsToEvents(kbHaps)

      if (kbCtx) drawKeyboard(kbCtx, now, keyboardStart.value, keyboardEnd.value, kbEvents, kbLabels.value, kbMidi.value)
    } else if (activeGroup.value === 'score' && !frozen.value) {
      const scCtx = scoreCanvas.value?.getContext('2d')
      if (scoreCanvas.value) resizeCanvas(scoreCanvas.value)

      const now = getSchedulerTime()
      const nc = scoreCycles.value
      const scHaps = queryPattern(0, nc)
      const scEvents = hapsToEvents(scHaps)
      const scDrumEvents = hapsToDrumEvents(scHaps)

      const scMx = hoverCanvas.value === 'score' ? hoverX.value : null
      const scMy = hoverCanvas.value === 'score' ? hoverY.value : null
      if (scCtx) drawScore(scCtx, scEvents, now % nc, nc, scMx, scMy, scDrumEvents)
    } else if (activeGroup.value === 'drums' && !frozen.value) {
      const drCtx = drumsCanvas.value?.getContext('2d')
      if (drumsCanvas.value) resizeCanvas(drumsCanvas.value)

      const now = getSchedulerTime()
      const dc = drumCycles.value
      const drHaps = queryPattern(0, dc)
      const drEvents = hapsToDrumEvents(drHaps)

      if (drCtx) drawDrums(drCtx, drEvents, now % dc, dc, drumShowPads.value)
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

function clearAll() {
  spectrogramClean = null
  const canvases = [spectrogramCanvas, waveformCanvas, spectrumCanvas, spiralCanvas, pitchwheelCanvas, pianorollCanvas, keyboardCanvas, scoreCanvas, drumsCanvas]
  for (const c of canvases) {
    const ctx = c.value?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }
  events = []
}

function exportScreenshot() {
  const canvases: HTMLCanvasElement[] = []
  if (activeGroup.value === 'audio') {
    if (waveformCanvas.value) canvases.push(waveformCanvas.value)
    if (spectrumCanvas.value) canvases.push(spectrumCanvas.value)
    if (spectrogramCanvas.value) canvases.push(spectrogramCanvas.value)
  } else if (activeGroup.value === 'notes') {
    if (spiralCanvas.value) canvases.push(spiralCanvas.value)
    if (pitchwheelCanvas.value) canvases.push(pitchwheelCanvas.value)
    if (pianorollCanvas.value) canvases.push(pianorollCanvas.value)
  } else if (activeGroup.value === 'keyboard') {
    if (keyboardCanvas.value) canvases.push(keyboardCanvas.value)
  } else if (activeGroup.value === 'score') {
    if (scoreCanvas.value) canvases.push(scoreCanvas.value)
  } else {
    if (drumsCanvas.value) canvases.push(drumsCanvas.value)
  }
  if (canvases.length === 0) return

  const gap = 4
  const totalWidth = canvases.reduce((s, c) => s + c.width, 0) + gap * (canvases.length - 1)
  const maxHeight = Math.max(...canvases.map(c => c.height))

  const out = document.createElement('canvas')
  out.width = totalWidth
  out.height = maxHeight
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, totalWidth, maxHeight)

  let x = 0
  for (const c of canvases) {
    ctx.drawImage(c, x, 0)
    x += c.width + gap
  }

  const link = document.createElement('a')
  link.download = `strudel-${activeGroup.value}-${Date.now()}.png`
  link.href = out.toDataURL('image/png')
  link.click()
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

watch(peakHold, (on) => {
  if (!on) peakValues = null
})

watch(fftSize, async (size) => {
  try {
    const { setAnalyzerFftSize, ANALYZER_ID } = await import('./audio/engine')
    setAnalyzerFftSize(ANALYZER_ID, size)
  } catch {}
})

onMounted(() => {
  document.addEventListener('click', closeOpenHelp)
})

onUnmounted(() => {
  stopVisualization()
  document.removeEventListener('click', closeOpenHelp)
})
</script>

<template>
  <div class="visualizer-panel" :class="{ hidden: !visible, collapsed: !isExpanded }">
    <div class="viz-header">
      <div class="viz-bar">
        <div class="viz-tabs">
          <button class="viz-tab" :class="{ active: activeGroup === 'audio' }" @click="activeGroup = 'audio'">Audio</button>
          <button class="viz-tab" :class="{ active: activeGroup === 'notes' }" @click="activeGroup = 'notes'">Notas</button>
          <button class="viz-tab" :class="{ active: activeGroup === 'keyboard' }" @click="activeGroup = 'keyboard'">Teclado</button>
          <button class="viz-tab" :class="{ active: activeGroup === 'score' }" @click="activeGroup = 'score'">Partitura</button>
          <button class="viz-tab" :class="{ active: activeGroup === 'drums' }" @click="activeGroup = 'drums'">Batería</button>
        </div>
        <div class="viz-actions">
          <button class="viz-btn" :class="{ 'viz-btn-active': frozen }" @click="frozen = !frozen" title="Congelar visualizaciones">
            {{ frozen ? '&#9654; Reanudar' : '&#10074;&#10074; Congelar' }}
          </button>
          <button class="viz-btn" @click="clearAll" title="Limpiar visualizaciones">Limpiar</button>
          <button class="viz-btn" @click="exportScreenshot" title="Guardar captura PNG">&#128247;</button>
          <button v-if="isExpanded" class="viz-btn" :class="{ 'viz-btn-active': showSettings }" @click="showSettings = !showSettings" title="Ajustes">&#9881;</button>
          <button class="viz-btn" @click="toggleExpand">{{ isExpanded ? '&#9660;' : '&#9650;' }}</button>
        </div>
      </div>
      <div class="viz-settings" v-show="isExpanded && showSettings">
        <template v-if="activeGroup === 'audio'">
          <div class="settings-group">
            <span class="settings-group-title">Onda</span>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Zoom</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.zoom.title }}</span><span class="tt-desc">{{ paramHelp.zoom.desc }}</span></div>
              </details>
              <input type="range" :min="5" :max="100" v-model.number="waveZoom" />
              <span class="param-value">{{ waveZoom }}%</span>
            </div>
          </div>
          <div class="settings-divider"></div>
          <div class="settings-group">
            <span class="settings-group-title">Espectro</span>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">dB</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.db.title }}</span><span class="tt-desc">{{ paramHelp.db.desc }}</span></div>
              </details>
              <input type="range" :min="-120" :max="-20" v-model.number="minDb" />
              <span class="param-value">{{ minDb }}</span>
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Barras</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.barras.title }}</span><span class="tt-desc">{{ paramHelp.barras.desc }}</span></div>
              </details>
              <input type="range" :min="16" :max="512" :step="16" v-model.number="numBars" />
              <span class="param-value">{{ numBars }}</span>
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Peak</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.peak.title }}</span><span class="tt-desc">{{ paramHelp.peak.desc }}</span></div>
              </details>
              <input type="checkbox" v-model="peakHold" />
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Linea</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.linea.title }}</span><span class="tt-desc">{{ paramHelp.linea.desc }}</span></div>
              </details>
              <input type="checkbox" v-model="spectrumLine" />
            </div>
          </div>
          <div class="settings-divider"></div>
          <div class="settings-group">
            <span class="settings-group-title">Espectrograma</span>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">FFT</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.fft.title }}</span><span class="tt-desc">{{ paramHelp.fft.desc }}</span></div>
              </details>
              <select v-model.number="fftSize">
                <option :value="256">256</option>
                <option :value="512">512</option>
                <option :value="1024">1024</option>
                <option :value="2048">2048</option>
                <option :value="4096">4096</option>
                <option :value="8192">8192</option>
              </select>
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Log</summary>
                <div class="param-tooltip param-tooltip-right"><span class="tt-title">{{ paramHelp.log.title }}</span><span class="tt-desc">{{ paramHelp.log.desc }}</span></div>
              </details>
              <input type="checkbox" v-model="spectrogramLog" />
            </div>
          </div>
        </template>
        <template v-else-if="activeGroup === 'notes'">
          <div class="settings-group">
            <span class="settings-group-title">Piano Roll</span>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Ventana</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.ventana.title }}</span><span class="tt-desc">{{ paramHelp.ventana.desc }}</span></div>
              </details>
              <input type="range" :min="1" :max="8" :step="0.5" v-model.number="pianoLookbehind" />
              <span class="param-value">{{ pianoLookbehind }}c</span>
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Punchcard</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.punchcard.title }}</span><span class="tt-desc">{{ paramHelp.punchcard.desc }}</span></div>
              </details>
              <input type="checkbox" v-model="punchcard" />
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Solfeo</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.solfeo.title }}</span><span class="tt-desc">{{ paramHelp.solfeo.desc }}</span></div>
              </details>
              <input type="checkbox" v-model="solfeo" />
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Espiral</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.spiral.title }}</span><span class="tt-desc">{{ paramHelp.spiral.desc }}</span></div>
              </details>
              <input type="checkbox" v-model="showSpiral" />
            </div>
          </div>
        </template>
        <template v-if="activeGroup === 'keyboard'">
          <div class="settings-group">
            <span class="settings-group-title">Teclado</span>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Octava</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.kbOctava.title }}</span><span class="tt-desc">{{ paramHelp.kbOctava.desc }}</span></div>
              </details>
              <select v-model.number="keyboardStart">
                <option :value="24">C1</option>
                <option :value="36">C2</option>
                <option :value="48">C3</option>
                <option :value="60">C4</option>
                <option :value="72">C5</option>
              </select>
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Octavas</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.kbOctavas.title }}</span><span class="tt-desc">{{ paramHelp.kbOctavas.desc }}</span></div>
              </details>
              <select v-model.number="keyboardEnd" @change="() => { if (keyboardEnd <= keyboardStart) keyboardEnd = keyboardStart + 12 }">
                <option v-for="n in 6" :key="n" :value="keyboardStart + n * 12">{{ n }}</option>
              </select>
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Solfeo</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.solfeo.title }}</span><span class="tt-desc">{{ paramHelp.solfeo.desc }}</span></div>
              </details>
              <input type="checkbox" v-model="solfeo" />
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Etiquetas</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.kbLabels.title }}</span><span class="tt-desc">{{ paramHelp.kbLabels.desc }}</span></div>
              </details>
              <input type="checkbox" v-model="kbLabels" />
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">MIDI</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.kbMidi.title }}</span><span class="tt-desc">{{ paramHelp.kbMidi.desc }}</span></div>
              </details>
              <input type="checkbox" v-model="kbMidi" />
            </div>
          </div>
        </template>
        <template v-if="activeGroup === 'score'">
          <div class="settings-group">
            <span class="settings-group-title">Partitura</span>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Compases</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.scoreCycles.title }}</span><span class="tt-desc">{{ paramHelp.scoreCycles.desc }}</span></div>
              </details>
              <select v-model.number="scoreCycles">
                <option v-for="n in [1,2,4,8,16]" :key="n" :value="n">{{ n }}</option>
              </select>
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Solfeo</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.solfeo.title }}</span><span class="tt-desc">{{ paramHelp.solfeo.desc }}</span></div>
              </details>
              <input type="checkbox" v-model="solfeo" />
            </div>
          </div>
        </template>
        <template v-if="activeGroup === 'drums'">
          <div class="settings-group">
            <span class="settings-group-title">Batería</span>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Ciclos</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.drumCycles.title }}</span><span class="tt-desc">{{ paramHelp.drumCycles.desc }}</span></div>
              </details>
              <select v-model.number="drumCycles">
                <option v-for="n in [1,2,4,8]" :key="n" :value="n">{{ n }}</option>
              </select>
            </div>
            <div class="viz-param">
              <details class="param-help">
                <summary class="param-label">Pads</summary>
                <div class="param-tooltip"><span class="tt-title">{{ paramHelp.drumPads.title }}</span><span class="tt-desc">{{ paramHelp.drumPads.desc }}</span></div>
              </details>
              <input type="checkbox" v-model="drumShowPads" />
            </div>
          </div>
        </template>
      </div>
    </div>
    <div class="viz-content" v-show="isExpanded">
      <!-- Grupo Audio -->
      <template v-if="activeGroup === 'audio'">
        <div class="viz-container">
          <span class="viz-label">Waveform</span>
          <canvas ref="waveformCanvas" @mousemove="(e) => handleCanvasMove('waveform', e)" @mouseleave="handleCanvasLeave"></canvas>
        </div>
        <div class="viz-container">
          <span class="viz-label">Spectrum</span>
          <canvas ref="spectrumCanvas" @mousemove="(e) => handleCanvasMove('spectrum', e)" @mouseleave="handleCanvasLeave"></canvas>
        </div>
        <div class="viz-container">
          <span class="viz-label">Spectrogram</span>
          <canvas ref="spectrogramCanvas" @mousemove="(e) => handleCanvasMove('spectrogram', e)" @mouseleave="handleCanvasLeave"></canvas>
        </div>
      </template>
      <!-- Grupo Notas -->
      <template v-else-if="activeGroup === 'notes'">
        <div v-if="showSpiral" class="viz-container">
          <span class="viz-label">Spiral</span>
          <canvas ref="spiralCanvas"></canvas>
        </div>
        <div class="viz-container">
          <span class="viz-label">Pitchwheel</span>
          <canvas ref="pitchwheelCanvas"></canvas>
        </div>
        <div class="viz-container" :style="{ flex: showSpiral ? 1.5 : 3 }">
          <span class="viz-label">Piano Roll</span>
          <canvas ref="pianorollCanvas" @mousemove="(e) => handleCanvasMove('pianoroll', e)" @mouseleave="handleCanvasLeave"></canvas>
        </div>
      </template>
      <!-- Grupo Teclado -->
      <div v-show="activeGroup === 'keyboard'" class="viz-container" style="flex: 1">
        <canvas ref="keyboardCanvas"></canvas>
      </div>
      <div v-show="activeGroup === 'score'" class="viz-container" style="flex: 1">
        <canvas ref="scoreCanvas" @mousemove="(e) => handleCanvasMove('score', e)" @mouseleave="handleCanvasLeave"></canvas>
      </div>
      <div v-show="activeGroup === 'drums'" class="viz-container" style="flex: 1">
        <canvas ref="drumsCanvas"></canvas>
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
}

.visualizer-panel.hidden {
  display: none;
}

.visualizer-panel.collapsed {
  height: auto !important;
}

/* Header: two-row layout */
.viz-header {
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.viz-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
}

.viz-tabs {
  display: flex;
  gap: 4px;
}

.viz-tab {
  padding: 5px 14px;
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

.viz-actions {
  display: flex;
  gap: 6px;
}

.viz-btn {
  padding: 5px 12px;
  background: #334155;
  border: none;
  border-radius: 4px;
  color: #94a3b8;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.viz-btn:hover {
  background: #475569;
  color: #e2e8f0;
}

.viz-btn-active {
  background: #3b82f6 !important;
  color: #ffffff !important;
}

/* Settings drawer */
.viz-settings {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 6px 12px;
  border-top: 1px solid #334155;
  background: #1a2536;
}

.settings-group {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
}

.settings-group-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #64748b;
  white-space: nowrap;
}

.settings-divider {
  width: 1px;
  align-self: stretch;
  background: #334155;
  margin: 0 4px;
  min-height: 20px;
}

/* Parameter controls */
.viz-param {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: #94a3b8;
  white-space: nowrap;
}

.viz-param input[type="range"] {
  width: 70px;
  height: 3px;
  accent-color: #3b82f6;
  cursor: pointer;
}

.viz-param input[type="checkbox"] {
  accent-color: #3b82f6;
  cursor: pointer;
}

.viz-param select {
  background: #334155;
  color: #e2e8f0;
  border: none;
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 11px;
  cursor: pointer;
}

.param-value {
  font-size: 10px;
  color: #64748b;
  min-width: 28px;
  text-align: right;
  font-family: monospace;
}

/* Tooltip system */
.param-help {
  position: relative;
  display: inline;
}

.param-label {
  cursor: help;
  border-bottom: 1px dotted #64748b;
  list-style: none;
  font-size: 13px;
  color: #94a3b8;
  user-select: none;
}

.param-label::-webkit-details-marker {
  display: none;
}

.param-label::marker {
  content: '';
}

.param-tooltip {
  all: initial;
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  width: 260px;
  padding: 10px 12px;
  background: #334155;
  border: 1px solid #475569;
  border-radius: 8px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.5);
  z-index: 200;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.param-tooltip-right {
  left: auto;
  right: 0;
}

.param-tooltip .tt-title {
  all: initial;
  display: block;
  margin: 0 0 4px 0;
  padding: 0;
  color: #22d3ee;
  font-size: 13px;
  font-weight: bold;
  line-height: 1.4;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.param-tooltip .tt-desc {
  all: initial;
  display: block;
  margin: 0;
  padding: 0;
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1.5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Canvas area */
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
  .viz-settings {
    flex-wrap: wrap;
    gap: 8px;
  }

  .settings-divider {
    display: none;
  }

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
