// AudioEngine: Singleton para gestionar Strudel y el contexto de audio

export const ANALYZER_ID = 1

export type NotationEvent = {
  time: number
  dur: number
  midi?: number
  note?: string
  drum?: 'bd' | 'sd' | 'hh' | 'other'
  instrument: string
}

// Event emitter simple
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

async function ensureInitialized(): Promise<void> {
  if (initialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    // Import dinámico de @strudel/web
    const strudel = await import('@strudel/web')

    // Inicializar Strudel
    await strudel.initStrudel()

    // Guardar referencias a las funciones
    strudelEvaluate = strudel.evaluate
    strudelHush = strudel.hush
    strudelGetAnalyzerData = strudel.getAnalyzerData
    strudelGetAudioContext = strudel.getAudioContext

    initialized = true
    console.log('[StrudelEngine] Initialized successfully')
  })()

  return initPromise
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
    if (strudelGetAudioContext) {
      return strudelGetAudioContext().currentTime
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
