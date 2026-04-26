type MidiNote = {
  time: number
  dur: number
  midi: number
  channel: number
  velocity: number
}

function writeVarLen(value: number): number[] {
  const bytes: number[] = []
  let v = value & 0x7f
  bytes.unshift(v)
  value >>= 7
  while (value > 0) {
    v = (value & 0x7f) | 0x80
    bytes.unshift(v)
    value >>= 7
  }
  return bytes
}

function writeInt16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff]
}

function writeInt32(value: number): number[] {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function buildTrack(notes: MidiNote[], ppq: number, cps: number): number[] {
  const bpm = cps * 60
  const events: { tick: number; data: number[] }[] = []

  // Tempo meta event (microseconds per beat)
  const uspb = Math.round(60000000 / bpm)
  events.push({ tick: 0, data: [0xff, 0x51, 0x03, (uspb >> 16) & 0xff, (uspb >> 8) & 0xff, uspb & 0xff] })

  for (const note of notes) {
    const startTick = Math.max(0, Math.round(note.time * ppq))
    const durTicks = Math.max(1, Math.round(note.dur * ppq))
    const midiNote = Math.min(127, Math.max(0, Math.round(note.midi)))
    const vel = Math.min(127, Math.max(1, Math.round(note.velocity)))

    events.push({ tick: startTick, data: [0x90 | note.channel, midiNote, vel] })
    events.push({ tick: startTick + durTicks, data: [0x80 | note.channel, midiNote, 0] })
  }

  // End of track
  events.push({ tick: events.length > 0 ? Math.max(...events.map(e => e.tick)) : 0, data: [0xff, 0x2f, 0x00] })

  events.sort((a, b) => a.tick - b.tick)

  // Convert to delta times
  const trackData: number[] = []
  let lastTick = 0
  for (const event of events) {
    const delta = event.tick - lastTick
    trackData.push(...writeVarLen(delta), ...event.data)
    lastTick = event.tick
  }

  return trackData
}

export function exportMidi(haps: any[], cycles: number, cps: number): Uint8Array {
  const ppq = 480

  // Group by instrument for multi-track
  const instruments = new Map<string, MidiNote[]>()

  for (const hap of haps) {
    if (!hap.value) continue
    const time = hap.whole?.begin?.valueOf() ?? 0
    const end = hap.whole?.end?.valueOf() ?? time
    const dur = end - time

    let midi: number | undefined
    const value = hap.value

    if (value.note !== undefined) {
      if (typeof value.note === 'number') {
        midi = value.note
      } else if (typeof value.note === 'string') {
        const match = value.note.trim().match(/^([a-gA-G])([#b]?)(-?\d+)$/)
        if (match) {
          const noteMap: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
          const base = noteMap[match[1].toLowerCase()]
          const acc = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0
          const oct = parseInt(match[3], 10)
          if (base !== undefined) midi = (oct + 1) * 12 + base + acc
        }
      }
    } else if (value.freq !== undefined) {
      midi = 69 + 12 * Math.log2(Number(value.freq) / 440)
    } else if (value.n !== undefined && typeof value.n === 'number') {
      const drums = ['bd', 'sd', 'hh', 'cp', 'oh', 'ch']
      if (!drums.includes(value.s)) midi = value.n
    }

    if (midi === undefined) continue

    const instrument = value.s || 'default'
    if (!instruments.has(instrument)) instruments.set(instrument, [])

    instruments.get(instrument)!.push({
      time,
      dur,
      midi,
      channel: 0,
      velocity: Math.round((value.gain ?? value.velocity ?? 0.8) * 127),
    })
  }

  // Assign channels (0-15, skip 9 for drums)
  const trackList = [...instruments.entries()]
  trackList.forEach(([, notes], i) => {
    const ch = i >= 9 ? i + 1 : i
    notes.forEach(n => { n.channel = Math.min(ch, 15) })
  })

  // Build tracks
  const tracks = trackList.map(([, notes]) => buildTrack(notes, ppq, cps))

  // MIDI file
  const data: number[] = []

  // Header: MThd
  data.push(0x4d, 0x54, 0x68, 0x64) // "MThd"
  data.push(...writeInt32(6))
  data.push(...writeInt16(tracks.length > 1 ? 1 : 0)) // format
  data.push(...writeInt16(tracks.length))
  data.push(...writeInt16(ppq))

  // Tracks: MTrk
  for (const track of tracks) {
    data.push(0x4d, 0x54, 0x72, 0x6b) // "MTrk"
    data.push(...writeInt32(track.length))
    data.push(...track)
  }

  return new Uint8Array(data)
}

export function downloadMidi(haps: any[], cycles: number, cps: number): void {
  const midi = exportMidi(haps, cycles, cps)
  const blob = new Blob([midi], { type: 'audio/midi' })
  const link = document.createElement('a')
  link.download = `strudel-${cycles}cycles-${Date.now()}.mid`
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
}
