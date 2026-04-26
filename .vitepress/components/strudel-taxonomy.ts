export type Category = {
  name: string
  values: string[]
}

export const taxonomy: Record<string, Category> = {
  // Sound sources
  oscillators: {
    name: 'Osciladores',
    values: ['sine', 'triangle', 'square', 'saw', 'sawtooth']
  },
  // Filters
  filters: {
    name: 'Filtros',
    values: ['lpf', 'hpf', 'bpf']
  },
  filterParams: {
    name: 'Parámetros de filtro',
    values: ['lpq', 'hpq', 'bpq', 'lpenv', 'hpenv', 'bpenv', 'lpattack', 'lpdecay']
  },
  // Effects
  spatialEffects: {
    name: 'Efectos espaciales',
    values: ['delay', 'room']
  },
  distortionEffects: {
    name: 'Distorsión',
    values: ['distort', 'shape', 'crush', 'coarse', 'drive']
  },
  modulationEffects: {
    name: 'Modulación',
    values: ['chorus', 'phaser', 'tremolo', 'vibrato', 'leslie']
  },
  // Envelope
  envelope: {
    name: 'Envolvente',
    values: ['attack', 'decay', 'sustain', 'release']
  },
  // Tempo / time
  tempo: {
    name: 'Tempo',
    values: ['fast', 'slow', 'density', 'sparsity']
  },
  // Pattern transforms
  transforms: {
    name: 'Transformaciones',
    values: ['rev', 'palindrome', 'shuffle', 'iter', 'brak']
  },
  conditional: {
    name: 'Condicionales',
    values: ['every', 'when', 'sometimes', 'often', 'rarely', 'almostNever', 'almostAlways']
  },
  juxtaposition: {
    name: 'Yuxtaposición',
    values: ['jux', 'juxBy', 'superimpose', 'layer', 'off']
  },
  structure: {
    name: 'Estructura',
    values: ['chop', 'striate', 'slice', 'ply', 'struct', 'mask', 'euclid', 'euclidLegato']
  },
  // Amplitude
  amplitude: {
    name: 'Amplitud',
    values: ['gain', 'velocity', 'amp', 'postgain']
  },
  // Spatial
  spatial: {
    name: 'Espacial',
    values: ['pan', 'orbit']
  },
  // Delay params
  delayParams: {
    name: 'Parámetros de delay',
    values: ['delaytime', 'delayfeedback', 'delayt', 'delayfb']
  },
  // Room params
  roomParams: {
    name: 'Parámetros de reverb',
    values: ['room', 'roomsize', 'roomlp', 'roomdim', 'roomfade', 'size']
  },
  // FM synthesis
  fmParams: {
    name: 'Síntesis FM',
    values: ['fm', 'fmi', 'fmh', 'fmattack', 'fmdecay', 'fmsustain', 'fmrelease', 'fmenv', 'fmwave']
  },
  // Sample controls
  sampleControls: {
    name: 'Control de sample',
    values: ['begin', 'end', 'loop', 'loopBegin', 'loopEnd', 'cut', 'speed']
  },
  // Notes
  noteNames: {
    name: 'Notas',
    values: ['c', 'd', 'e', 'f', 'g', 'a', 'b']
  },
  // Scales
  scales: {
    name: 'Escalas',
    values: ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian', 'pentatonic', 'blues', 'chromatic', 'whole tone', 'harmonic minor', 'melodic minor']
  },
  // Drum sounds
  drums: {
    name: 'Percusión',
    values: ['bd', 'sd', 'hh', 'oh', 'ch', 'cp', 'tom', 'rim', 'cb', 'cy', 'cr']
  },
}

// Reverse lookup: value -> category
const lookupCache = new Map<string, Category>()

export function findCategory(value: string): Category | null {
  const lower = value.toLowerCase()
  if (lookupCache.has(lower)) return lookupCache.get(lower)!

  for (const cat of Object.values(taxonomy)) {
    if (cat.values.includes(lower)) {
      lookupCache.set(lower, cat)
      return cat
    }
  }
  return null
}

export function getAlternatives(value: string): string[] | null {
  const cat = findCategory(value.toLowerCase())
  if (!cat) return null
  return cat.values.filter(v => v.toLowerCase() !== value.toLowerCase())
}
