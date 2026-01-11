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

// Referencia dinámica a las funciones de Strudel
let strudelEvaluate: ((code: string, autoplay?: boolean) => Promise<unknown>) | null = null
let strudelHush: (() => void) | null = null
let strudelGetAnalyzerData: ((type: string, id: number) => Float32Array | null) | null = null
let strudelGetAudioContext: (() => AudioContext) | null = null
let strudelRepl: any = null

// Cache del AudioContext para evitar llamadas repetidas
let cachedAudioContext: AudioContext | null = null

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

    // Cachear AudioContext
    if (strudelGetAudioContext) {
      cachedAudioContext = strudelGetAudioContext()
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
