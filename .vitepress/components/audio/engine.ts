// AudioEngine: Singleton para gestionar Strudel y el contexto de audio
import { initAudio, samples, webaudioRepl, getAnalyzerData, getAudioContext } from '@strudel/web'

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

function emitNoteEvent(event: NotationEvent) {
  noteListeners.forEach(cb => cb(event))
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

// REPL singleton
let repl: ReturnType<typeof webaudioRepl> | null = null
let initialized = false

async function ensureInitialized() {
  if (initialized) return

  await samples('https://strudel.cc/strudel.json').catch(() => {})

  repl = webaudioRepl({
    editPattern: (pattern) =>
      pattern.onTrigger((hap, _now, cps, time) => {
        const value = hap?.value ?? {}
        const dur = hap?.duration && cps ? hap.duration / cps : 0
        const sound = value.s ?? value.sound ?? 'unknown'

        let midi: number | undefined
        let note: string | undefined
        if (typeof value.note === 'string') {
          note = value.note
          midi = noteNameToMidi(note)
        } else if (typeof value.note === 'number') {
          midi = value.note
          note = midiToNoteName(midi)
        } else if (typeof value.n === 'number') {
          midi = value.n
          note = midiToNoteName(midi)
        } else if (typeof value.freq === 'number') {
          midi = freqToMidi(value.freq)
          note = midiToNoteName(midi)
        }

        const drum =
          sound === 'bd' || sound === 'sd' || sound === 'hh'
            ? (sound as 'bd' | 'sd' | 'hh')
            : undefined

        emitNoteEvent({
          time,
          dur: Math.max(dur, 0.01),
          midi,
          note,
          drum: drum ?? (sound === 'unknown' ? undefined : 'other'),
          instrument: sound
        })
      }, false)
  })

  initialized = true
}

export async function evaluate(code: string): Promise<void> {
  await ensureInitialized()
  await initAudio()
  if (repl) {
    await repl.evaluate(code, true, true)
  }
  window.dispatchEvent(new CustomEvent('strudel-play'))
}

export function stop(): void {
  if (repl) {
    repl.stop()
    repl.evaluate('hush()', false, false).catch(() => {})
  }
  window.dispatchEvent(new CustomEvent('strudel-stop'))
}

export function getTime(): number {
  try {
    return getAudioContext().currentTime
  } catch {
    return 0
  }
}

export { getAnalyzerData }
