// AudioEngine: Singleton para gestionar Strudel y el contexto de audio

export const ANALYZER_ID = 1

// Tipo para haps de Strudel
export type StrudelHap = {
  whole: { begin: { valueOf(): number }; end: { valueOf(): number } }
  part: { begin: { valueOf(): number }; end: { valueOf(): number } }
  value: {
    note?: string | number
    n?: number
    freq?: number
    s?: string
    color?: string
    [key: string]: unknown
  }
  hasOnset(): boolean
  endClipped: number
}

export type NotationEvent = {
  time: number
  dur: number
  midi?: number
  note?: string
  drum?: 'bd' | 'sd' | 'hh' | 'other'
  instrument: string
}

// Event emitter simple (mantenido para compatibilidad)
type EventCallback = (event: NotationEvent) => void
const noteListeners: EventCallback[] = []

export function onNoteEvent(callback: EventCallback) {
  noteListeners.push(callback)
  return () => {
    const idx = noteListeners.indexOf(callback)
    if (idx >= 0) noteListeners.splice(idx, 1)
  }
}

// Conversiones de notas
const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const NOTE_TO_SEMITONE: Record<string, number> = {
  c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11
}

function midiToNoteName(midi: number): string {
  const normalized = Math.round(midi)
  const note = NOTE_NAMES[((normalized % 12) + 12) % 12]
  const octave = Math.floor(normalized / 12) - 1
  return `${note}${octave}`
}

function noteNameToMidi(note: string): number | undefined {
  const match = note.trim().match(/^([a-gA-G])([#b]?)(-?\d+)$/)
  if (!match) return undefined
  const letter = match[1].toLowerCase()
  const accidental = match[2]
  const octave = Number.parseInt(match[3], 10)
  const base = NOTE_TO_SEMITONE[letter]
  if (base === undefined || Number.isNaN(octave)) return undefined
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
  return (octave + 1) * 12 + base + offset
}

function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

// Estado del REPL
let initialized = false
let initPromise: Promise<void> | null = null

// Estado de carga de samples (para UI)
export type LoadingState = {
  isLoading: boolean
  loaded: number
  total: number
  currentFile: string
}

let loadingState: LoadingState = {
  isLoading: false,
  loaded: 0,
  total: 0,
  currentFile: '',
}

type LoadingCallback = (state: LoadingState) => void
const loadingListeners: LoadingCallback[] = []

function updateLoadingState(partial: Partial<LoadingState>) {
  loadingState = { ...loadingState, ...partial }
  loadingListeners.forEach(fn => fn(loadingState))
}

export function onLoadingStateChange(callback: LoadingCallback): () => void {
  loadingListeners.push(callback)
  // Llamar inmediatamente con el estado actual
  callback(loadingState)
  return () => {
    const idx = loadingListeners.indexOf(callback)
    if (idx >= 0) loadingListeners.splice(idx, 1)
  }
}

export function getLoadingState(): LoadingState {
  return loadingState
}

// Widgets
export type SliderWidget = {
  from: number
  to: number
  value: string
  min: number
  max: number
  step?: number
  type: 'slider'
}

export type Widget = SliderWidget

// Referencia dinámica a las funciones de Strudel
let strudelEvaluate: ((code: string, autoplay?: boolean) => Promise<unknown>) | null = null
let strudelHush: (() => void) | null = null
let strudelGetAnalyzerData: ((type: string, id: number) => Float32Array | null) | null = null
let strudelGetAudioContext: (() => AudioContext) | null = null
let strudelSamples: ((url: string) => Promise<void>) | null = null
let strudelEvalScope: ((...args: any[]) => Promise<void>) | null = null
let strudelGetAnalyserById: ((id: number, fftSize?: number, smoothing?: number) => AnalyserNode) | null = null
let strudelRepl: any = null

// URLs de los sample maps de dough-samples (mismos que usa strudel.cc)
const SAMPLE_MAP_BASE = 'https://raw.githubusercontent.com/felixroos/dough-samples/main/'
const SAMPLE_MAPS = [
  'tidal-drum-machines.json',
  'piano.json',
  'vcsl.json',
  'Dirt-Samples.json',
  'EmuSP12.json',
  'mridangam.json',
]

// Cache del AudioContext para evitar llamadas repetidas
let cachedAudioContext: AudioContext | null = null

export function beginInitialization(): void {
  ensureInitialized()
}

export function resumeAudio(): void {
  if (cachedAudioContext && cachedAudioContext.state === 'suspended') {
    cachedAudioContext.resume()
  }
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    // Import dinámico de @strudel/web
    const strudel = await import('@strudel/web')

    // Inicializar Strudel
    strudelRepl = await strudel.initStrudel()

    // Guardar referencias a las funciones
    strudelEvaluate = strudel.evaluate
    strudelHush = strudel.hush
    strudelGetAnalyzerData = strudel.getAnalyzerData
    strudelGetAudioContext = strudel.getAudioContext
    strudelSamples = strudel.samples
    strudelEvalScope = strudel.evalScope
    strudelGetAnalyserById = strudel.getAnalyserById

    // Registrar sliderWithID en el eval scope (no viene incluido sin @strudel/codemirror)
    await strudelEvalScope({
      sliderWithID: (_id: string, value: number) => value,
    })

    // Inicializar audio: resume AudioContext + cargar AudioWorklets
    await strudel.initAudio()

    // Cachear AudioContext
    if (strudelGetAudioContext) {
      cachedAudioContext = strudelGetAudioContext()
    }

    // Cargar sample maps (secuencialmente para mostrar progreso)
    if (strudelSamples) {
      console.log('[StrudelEngine] Loading sample maps...')
      updateLoadingState({
        isLoading: true,
        loaded: 0,
        total: SAMPLE_MAPS.length,
        currentFile: '',
      })

      for (let i = 0; i < SAMPLE_MAPS.length; i++) {
        const mapFile = SAMPLE_MAPS[i]
        updateLoadingState({ currentFile: mapFile })
        try {
          await strudelSamples!(SAMPLE_MAP_BASE + mapFile)
          console.log(`[StrudelEngine] Loaded ${mapFile}`)
        } catch (error) {
          console.warn(`[StrudelEngine] Failed to load ${mapFile}:`, error)
        }
        updateLoadingState({ loaded: i + 1 })
      }

      updateLoadingState({ isLoading: false, currentFile: '' })
      console.log('[StrudelEngine] Sample maps loaded')
    }

    initialized = true
    console.log('[StrudelEngine] Initialized successfully')
  })()

  return initPromise
}

// Emitir evento de nota a los listeners
function emitNoteEvent(hap: any, cps: number, begin: number) {
  if (!hap?.value) return

  const event: NotationEvent = {
    time: hap.whole?.begin.valueOf() ?? begin,
    dur: (hap.whole?.end.valueOf() ?? 0) - (hap.whole?.begin.valueOf() ?? 0),
    instrument: hap.value.s || 'unknown',
  }

  // Convertir nota/freq a MIDI
  if (hap.value.note !== undefined) {
    const midi = noteNameToMidi(String(hap.value.note))
    if (midi !== undefined) event.midi = midi
  } else if (hap.value.freq !== undefined) {
    event.midi = freqToMidi(Number(hap.value.freq))
  } else if (hap.value.n !== undefined) {
    // Si es un número de nota en el contexto de un instrumento tonal, intentar calcularlo
    const noteNumber = Number(hap.value.n)
    if (!isNaN(noteNumber) && hap.value.s && !['bd', 'sd', 'hh', 'cp', 'oh', 'ch'].includes(hap.value.s)) {
      // Para instrumentos tonales, n es típicamente MIDI
      event.midi = noteNumber
    }
  }

  // Solo emitir si tiene información de nota MIDI o es un drum
  if (event.midi !== undefined || event.drum !== undefined) {
    noteListeners.forEach(fn => {
      try {
        fn(event)
      } catch (error) {
        console.error('[StrudelEngine] Error in note listener:', error)
      }
    })
  }
}

export async function evaluate(code: string): Promise<void> {
  try {
    await ensureInitialized()
    const ctx = strudelGetAudioContext ? strudelGetAudioContext() : cachedAudioContext
    if (ctx?.state === 'suspended') {
      await ctx.resume()
    }
    console.log('[StrudelEngine] Evaluating:', code)
    if (strudelEvaluate) {
      await strudelEvaluate(code, true)
      console.log('[StrudelEngine] Evaluation complete')
    }
    window.dispatchEvent(new CustomEvent('strudel-play'))
  } catch (error) {
    console.error('[StrudelEngine] Evaluation error:', error)
    throw error
  }
}

export async function reEvaluate(code: string): Promise<void> {
  try {
    await ensureInitialized()
    const ctx = strudelGetAudioContext ? strudelGetAudioContext() : cachedAudioContext
    if (ctx?.state === 'suspended') {
      await ctx.resume()
    }
    if (strudelEvaluate) {
      await strudelEvaluate(code, true)
    }
  } catch (error) {
    console.error('[StrudelEngine] Re-evaluation error:', error)
    throw error
  }
}

export function getWidgets(): Widget[] {
  return (strudelRepl?.state?.widgets || []).filter((w: any) => w.type === 'slider')
}

// MIDI recording
let recordingHaps: any[] = []
let recordingStart = 0
let recordingRafId: number | null = null
let lastRecordedTime = 0

export function startRecording(): void {
  recordingHaps = []
  recordingStart = getSchedulerTime()
  lastRecordedTime = recordingStart
  pollRecording()
}

function pollRecording() {
  const now = getSchedulerTime()
  if (now > lastRecordedTime) {
    const pattern = getActivePattern()
    if (pattern) {
      try {
        const haps = pattern.queryArc(lastRecordedTime, now)
        for (const hap of haps) {
          if (hap.hasOnset()) {
            recordingHaps.push({
              ...hap,
              whole: {
                begin: { valueOf: () => hap.whole.begin.valueOf() - recordingStart },
                end: { valueOf: () => hap.whole.end.valueOf() - recordingStart },
              },
              value: { ...hap.value },
            })
          }
        }
      } catch {}
    }
    lastRecordedTime = now
  }
  recordingRafId = requestAnimationFrame(pollRecording)
}

export function stopRecording(): { haps: any[]; duration: number; cps: number } {
  if (recordingRafId !== null) {
    cancelAnimationFrame(recordingRafId)
    recordingRafId = null
  }
  const duration = getSchedulerTime() - recordingStart
  const cps = getCps()
  const haps = recordingHaps
  recordingHaps = []
  return { haps, duration, cps }
}

export function isRecordingActive(): boolean {
  return recordingRafId !== null
}

// Audio recording
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let mediaStreamDest: MediaStreamAudioDestinationNode | null = null
let recGainNode: GainNode | null = null

export function isAudioRecordingActive(): boolean {
  return mediaRecorder !== null && mediaRecorder.state === 'recording'
}

export async function startAudioRecording(): Promise<void> {
  await ensureInitialized()
  const ctx = strudelGetAudioContext ? strudelGetAudioContext() : cachedAudioContext
  if (!ctx) throw new Error('AudioContext not available')

  mediaStreamDest = ctx.createMediaStreamDestination()

  // Tap into the audio output by inserting a gain node between
  // the last node and destination, then splitting to both destination and recorder
  recGainNode = ctx.createGain()
  recGainNode.connect(ctx.destination)
  recGainNode.connect(mediaStreamDest)

  // Re-route: disconnect destination, connect through our gain node
  // We can't disconnect others from destination, so we connect our recorder
  // to the destination node directly using createMediaStreamDestination
  // Alternative: use the analyser node we already have
  const analyser = strudelGetAnalyserById ? strudelGetAnalyserById(ANALYZER_ID) : null
  if (analyser) {
    analyser.connect(mediaStreamDest)
  }

  audioChunks = []
  mediaRecorder = new MediaRecorder(mediaStreamDest.stream)
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data)
  }
  mediaRecorder.start(100)
}

export function stopAudioRecording(): void {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') return

  mediaRecorder.onstop = () => {
    const mimeType = mediaRecorder!.mimeType || 'audio/webm'
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'
    const blob = new Blob(audioChunks, { type: mimeType })
    const link = document.createElement('a')
    link.download = `strudel-${Date.now()}.${ext}`
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
    audioChunks = []
    mediaRecorder = null
  }
  mediaRecorder.stop()

  // Cleanup: disconnect recorder from analyser
  try {
    const analyser = strudelGetAnalyserById ? strudelGetAnalyserById(ANALYZER_ID) : null
    if (analyser && mediaStreamDest) analyser.disconnect(mediaStreamDest)
    if (recGainNode) { recGainNode.disconnect(); recGainNode = null }
  } catch {}
  mediaStreamDest = null
}

export function stop(): void {
  console.log('[StrudelEngine] Stopping')
  if (strudelHush) {
    strudelHush()
  }
  window.dispatchEvent(new CustomEvent('strudel-stop'))
}

export function getTime(): number {
  try {
    if (cachedAudioContext) {
      return cachedAudioContext.currentTime
    }
    return 0
  } catch {
    return 0
  }
}

export function getAnalyzerData(type: 'time' | 'frequency', id: number): Float32Array | null {
  if (strudelGetAnalyzerData) {
    return strudelGetAnalyzerData(type, id)
  }
  return null
}

export function getAudioContext(): AudioContext | null {
  return cachedAudioContext
}

export function setAnalyzerFftSize(id: number, fftSize: number): void {
  if (strudelGetAnalyserById) {
    strudelGetAnalyserById(id, fftSize)
  }
}

export function checkAnalyzerStatus(id: number): boolean {
  const timeData = getAnalyzerData('time', id)
  const freqData = getAnalyzerData('frequency', id)

  if (!timeData || !freqData) {
    console.warn(`[AudioEngine] Analyzer ${id} not returning data. Did you call .analyze(${id})?`)
    return false
  }

  // Verificar que los datos no estén todos en cero
  const hasNonZeroTime = timeData.some(v => v !== 0)
  const hasNonZeroFreq = freqData.some(v => v !== 0 && !isNaN(v))

  if (!hasNonZeroTime && !hasNonZeroFreq) {
    console.warn(`[AudioEngine] Analyzer ${id} returning all zeros. Audio may not be playing.`)
    return false
  }

  return true
}

export function getRepl() {
  return strudelRepl
}

/**
 * Verifica si hay datos de analyzer disponibles.
 * Retorna true si getAnalyzerData retorna datos (no null).
 * Nota: Los datos pueden ser todos ceros si no hay audio sonando.
 */
export function hasAnalyser(id: number): boolean {
  const data = getAnalyzerData('time', id)
  return data !== null
}

/**
 * Obtiene el pattern activo del scheduler.
 * Retorna null si no hay pattern activo.
 */
export function getActivePattern(): any {
  if (strudelRepl?.scheduler?.pattern) {
    return strudelRepl.scheduler.pattern
  }
  // Alternativa: state.pattern
  if (strudelRepl?.state?.pattern) {
    return strudelRepl.state.pattern
  }
  return null
}

/**
 * Hace query al pattern activo para obtener haps en un rango de tiempo.
 * @param from - Tiempo de inicio (en ciclos relativos al tiempo actual)
 * @param to - Tiempo de fin (en ciclos relativos al tiempo actual)
 * @returns Array de haps o array vacío si no hay pattern
 */
export function queryPattern(from: number, to: number): StrudelHap[] {
  const pattern = getActivePattern()
  if (!pattern) return []

  try {
    const haps = pattern.queryArc(from, to)
    return haps.filter((h: StrudelHap) => h.hasOnset())
  } catch (error) {
    console.error('[StrudelEngine] Error querying pattern:', error)
    return []
  }
}

/**
 * Obtiene el tiempo actual del scheduler en ciclos.
 * Útil para hacer queries relativos al tiempo actual.
 */
export function getSchedulerTime(): number {
  if (strudelRepl?.scheduler) {
    return strudelRepl.scheduler.now()
  }
  return 0
}

/**
 * Obtiene el CPS (cycles per second) actual del scheduler.
 */
export function getCps(): number {
  if (strudelRepl?.scheduler?.cps) {
    return strudelRepl.scheduler.cps
  }
  return 1
}

// ============================================
// Sistema de highlight en tiempo real
// ============================================

export type HighlightLocation = {
  start: number
  end: number
}

export type HighlightEvent = {
  locations: HighlightLocation[]
  time: number
}

type HighlightCallback = (event: HighlightEvent) => void
const highlightListeners: HighlightCallback[] = []
let highlightAnimationFrame: number | null = null
let lastHighlightedLocations: string = ''
let debugLoggedHap = false

/**
 * Suscribirse a eventos de highlight.
 * Se llama con las ubicaciones de los elementos que están sonando.
 */
export function onHighlightEvent(callback: HighlightCallback): () => void {
  highlightListeners.push(callback)
  return () => {
    const idx = highlightListeners.indexOf(callback)
    if (idx >= 0) highlightListeners.splice(idx, 1)
  }
}

function emitHighlightEvent(locations: HighlightLocation[]) {
  // Evitar emitir eventos duplicados
  const locKey = JSON.stringify(locations)
  if (locKey === lastHighlightedLocations) return
  lastHighlightedLocations = locKey

  const event: HighlightEvent = {
    locations,
    time: getSchedulerTime(),
  }
  highlightListeners.forEach(fn => {
    try {
      fn(event)
    } catch (error) {
      console.error('[StrudelEngine] Error in highlight listener:', error)
    }
  })
}

function pollHighlights() {
  if (!strudelRepl?.scheduler?.started) {
    // Si el scheduler no está corriendo, limpiar highlights
    if (lastHighlightedLocations !== '[]') {
      emitHighlightEvent([])
    }
    highlightAnimationFrame = requestAnimationFrame(pollHighlights)
    return
  }

  const currentTime = getSchedulerTime()
  const pattern = getActivePattern()

  if (!pattern) {
    emitHighlightEvent([])
    highlightAnimationFrame = requestAnimationFrame(pollHighlights)
    return
  }

  try {
    // Query haps en una ventana pequeña alrededor del tiempo actual
    const haps = pattern.queryArc(currentTime, currentTime + 0.05)
    const locations: HighlightLocation[] = []

    for (const hap of haps) {
      // Verificar si el hap está activo ahora
      const hapStart = hap.whole?.begin?.valueOf() ?? 0
      const hapEnd = hap.whole?.end?.valueOf() ?? 0

      if (hapStart <= currentTime && hapEnd > currentTime) {
        // Debug: ver estructura del hap
        if (!debugLoggedHap) {
          console.log('[StrudelEngine] Hap structure:', {
            value: hap.value,
            context: hap.context,
            whole: { begin: hapStart, end: hapEnd },
          })
          debugLoggedHap = true
        }

        // Extraer ubicaciones del contexto
        const hapLocations = hap.context?.locations
        if (Array.isArray(hapLocations) && hapLocations.length > 0) {
          for (const loc of hapLocations) {
            if (typeof loc.start === 'number' && typeof loc.end === 'number') {
              // Evitar duplicados
              const exists = locations.some(l => l.start === loc.start && l.end === loc.end)
              if (!exists) {
                locations.push({ start: loc.start, end: loc.end })
              }
            }
          }
        }
      }
    }

    emitHighlightEvent(locations)
  } catch (error) {
    console.error('[StrudelEngine] Error in pollHighlights:', error)
  }

  highlightAnimationFrame = requestAnimationFrame(pollHighlights)
}

// Iniciar/detener el polling de highlights
function startHighlightPolling() {
  if (highlightAnimationFrame === null) {
    highlightAnimationFrame = requestAnimationFrame(pollHighlights)
  }
}

function stopHighlightPolling() {
  if (highlightAnimationFrame !== null) {
    cancelAnimationFrame(highlightAnimationFrame)
    highlightAnimationFrame = null
  }
  emitHighlightEvent([])
  lastHighlightedLocations = ''
}

// Escuchar eventos de play/stop para controlar el polling
if (typeof window !== 'undefined') {
  window.addEventListener('strudel-play', startHighlightPolling)
  window.addEventListener('strudel-stop', () => {
    stopHighlightPolling()
  })
}
