export type Snippet = {
  name: string
  code: string
}

export type SnippetCategory = {
  name: string
  snippets: Snippet[]
}

export const snippetLibrary: SnippetCategory[] = [
  {
    name: 'Osciladores',
    snippets: [
      { name: 'Sine', code: 'note("c4 e4 g4").s("sine")' },
      { name: 'Triangle', code: 'note("c4 e4 g4").s("triangle")' },
      { name: 'Square', code: 'note("c4 e4 g4").s("square")' },
      { name: 'Saw', code: 'note("c4 e4 g4").s("saw")' },
      { name: 'Super Saw', code: 'note("c3").s("supersaw").gain(0.3).lpf(2000)' },
    ]
  },
  {
    name: 'Melodías',
    snippets: [
      { name: 'Escala mayor', code: 'note("c4 d4 e4 f4 g4 a4 b4 c5").s("sine")' },
      { name: 'Escala menor', code: 'note("a3 b3 c4 d4 e4 f4 g4 a4").s("sine")' },
      { name: 'Pentatónica', code: 'note("c4 d4 e4 g4 a4 c5").s("sine")' },
      { name: 'Cromática', code: 'note("c4 c#4 d4 d#4 e4 f4 f#4 g4").s("sine").slow(2)' },
      { name: 'Arpegio mayor', code: 'note("c4 e4 g4 c5 g4 e4").s("triangle")' },
      { name: 'Arpegio menor', code: 'note("a3 c4 e4 a4 e4 c4").s("triangle")' },
      { name: 'Escala con scale()', code: 'n("0 1 2 3 4 5 6 7").scale("C:major").s("sine")' },
      { name: 'Dórica', code: 'n("0 1 2 3 4 5 6 7").scale("D:dorian").s("sine")' },
      { name: 'Blues', code: 'n("0 1 2 3 4 5").scale("C:blues").s("sine")' },
      { name: 'Tetris', code: 'note("e5 b4 c5 d5 c5 b4 a4 a4 c5 e5 d5 c5 b4 c5 d5 e5 c5 a4 a4").s("square").fast(2)' },
    ]
  },
  {
    name: 'Acordes',
    snippets: [
      { name: 'Do mayor', code: 'note("[c4,e4,g4]").s("piano")' },
      { name: 'La menor', code: 'note("[a3,c4,e4]").s("piano")' },
      { name: 'Séptima mayor', code: 'note("[c4,e4,g4,b4]").s("piano")' },
      { name: 'Séptima dominante', code: 'note("[g3,b3,d4,f4]").s("piano")' },
      { name: 'I-IV-V-I', code: 'note("<[c3,e3,g3] [f3,a3,c4] [g3,b3,d4] [c3,e3,g3]>").s("piano")' },
      { name: 'I-V-vi-IV (pop)', code: 'note("<[c3,e3,g3] [g3,b3,d4] [a3,c4,e4] [f3,a3,c4]>").s("piano")' },
      { name: 'ii-V-I (jazz)', code: 'note("<[d3,f3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3]>").s("piano").slow(1.5)' },
      { name: 'Voicings', code: '"<C Am F G>".voicing().s("piano")' },
    ]
  },
  {
    name: 'Ritmos',
    snippets: [
      { name: 'Rock', code: 's("bd hh sd hh")' },
      { name: 'Backbeat', code: 's("bd hh sd hh bd bd sd hh")' },
      { name: 'House', code: 's("bd*4, ~ cp ~ cp, hh*8")' },
      { name: 'Bossa nova', code: 's("bd ~ [~ bd] ~, ~ hh ~ hh, [~ sd] ~ [~ sd] ~")' },
      { name: 'Reggaeton', code: 's("bd ~ ~ bd, ~ ~ sd ~, hh*8")' },
      { name: 'Breakbeat', code: 's("bd bd ~ ~, ~ ~ sd ~, hh*8").fast(2)' },
      { name: 'Euclidean (3,8)', code: 's("bd(3,8), sd(2,8), hh(5,8)")' },
      { name: 'Euclidean (5,8)', code: 's("bd(5,8), hh(7,8)")' },
      { name: 'Swing', code: 's("bd hh sd hh").swing(4)' },
    ]
  },
  {
    name: 'Síntesis',
    snippets: [
      { name: 'Pad suave', code: 'note("c3 e3 g3 b3").s("sine").slow(4).gain(0.5).lpf(800).attack(0.5).release(1)' },
      { name: 'Bass saw', code: 'note("c2 c2 e2 c2").s("saw").lpf("<400 800 1200 600>")' },
      { name: 'Lead square', code: 'note("c4 e4 g4 c5").s("square").lpf(2000).gain(0.3)' },
      { name: 'FM Bell', code: 'note("c5 e5 g5 c6").s("sine").fm(4).fmh(3).decay(0.5).sustain(0)' },
      { name: 'FM Bass', code: 'note("c2").s("sine").fm(8).fmh(1).fmdecay(0.1).fmsustain(0).decay(0.3).sustain(0)' },
      { name: 'Pluck', code: 'note("c4 e4 g4 c5").s("sine").decay(0.15).sustain(0).lpf(3000).lpdecay(0.1)' },
      { name: 'Sub bass', code: 'note("c1 c1 eb1 c1").s("sine").gain(0.8)' },
      { name: 'Detune unison', code: 'note("c3 e3 g3").s("saw").gain(0.2).lpf(1500).detune(15)' },
    ]
  },
  {
    name: 'Filtros',
    snippets: [
      { name: 'LP fijo', code: 'note("c3").s("saw").lpf(800)' },
      { name: 'LP sweep', code: 'note("c3").s("saw").lpf(sine.range(200, 4000).slow(4))' },
      { name: 'HP sweep', code: 'note("c3").s("saw").hpf(sine.range(100, 2000).slow(4))' },
      { name: 'BP resonante', code: 'note("c3").s("saw").bpf(sine.range(200, 3000).slow(2)).bpq(8)' },
      { name: 'Envelope LP', code: 'note("c3 e3 g3 c4").s("saw").lpf(200).lpenv(48).lpdecay(0.3)' },
      { name: 'Vowel', code: 'note("c3 e3 g3").s("saw").vowel("<a e i o u>")' },
    ]
  },
  {
    name: 'Efectos',
    snippets: [
      { name: 'Delay eco', code: 'note("c4 ~ e4 ~").s("triangle").delay(0.5).delaytime(0.3).delayfeedback(0.4)' },
      { name: 'Reverb hall', code: 'note("c4 e4 g4 c5").s("sine").room(0.8).roomsize(4)' },
      { name: 'Distorsión', code: 'note("c3 c3 e3 g3").s("square").shape(0.7).gain(0.3)' },
      { name: 'Bitcrush', code: 'note("c3 e3 g3").s("saw").crush(4).coarse(8)' },
      { name: 'Chorus', code: 'note("c4 e4 g4").s("sine").chorus(1).slow(2)' },
      { name: 'Phaser', code: 'note("c3 e3 g3").s("saw").phaser(2).gain(0.3)' },
      { name: 'Tremolo', code: 'note("c4 e4 g4").s("sine").tremolo(4).slow(2)' },
      { name: 'Leslie', code: 'note("[c4,e4,g4]").s("sine").leslie(1).lrate(2)' },
    ]
  },
  {
    name: 'Transformaciones',
    snippets: [
      { name: 'Rev', code: 'note("c4 d4 e4 f4 g4").s("sine").rev()' },
      { name: 'Palindrome', code: 'note("c4 d4 e4 f4 g4").s("sine").palindrome()' },
      { name: 'Every 3 fast', code: 'note("c4 d4 e4 g4").s("triangle").every(3, fast(2))' },
      { name: 'Every 4 rev', code: 'note("c4 d4 e4 g4").s("triangle").every(4, rev)' },
      { name: 'Jux rev', code: 'note("c4 d4 e4 g4").s("triangle").jux(rev)' },
      { name: 'Off transpose', code: 'note("c4 e4 g4").s("sine").off(0.125, transpose(7))' },
      { name: 'Superimpose', code: 'note("c4 e4 g4").s("sine").superimpose(transpose(12))' },
      { name: 'Iter', code: 'note("c4 d4 e4 f4").s("sine").iter(4)' },
      { name: 'Struct', code: 'note("c4 e4 g4 c5").struct("x ~ x x ~ x ~ x").s("sine")' },
    ]
  },
  {
    name: 'Capas y stacks',
    snippets: [
      { name: 'Melody + bass', code: 'stack(\n  note("c4 e4 g4 c5").s("triangle"),\n  note("c2 c2 g2 c2").s("sine").gain(0.6)\n)' },
      { name: 'Beat + melody', code: 'stack(\n  s("bd sd bd sd"),\n  s("hh*8").gain(0.4),\n  note("c4 e4 g4 c5").s("sine").gain(0.5)\n)' },
      { name: 'Full track', code: 'stack(\n  s("bd*4"),\n  s("~ cp ~ cp"),\n  s("hh*8").gain(0.3),\n  note("<c3 f3 g3 c3>").s("sine").slow(2),\n  note("c4 e4 g4 c5").s("triangle").gain(0.4)\n)' },
      { name: 'Poliritmia 3:4', code: 'stack(\n  note("c4 e4 g4").s("sine"),\n  note("a3 d4 f4 a4").s("triangle")\n)' },
    ]
  },
  {
    name: 'Envolventes',
    snippets: [
      { name: 'Pluck corto', code: 'note("c4 e4 g4 c5").s("sine").decay(0.1).sustain(0)' },
      { name: 'Pad largo', code: 'note("c4 e4 g4").s("sine").attack(1).sustain(0.8).release(2).slow(4)' },
      { name: 'Swell', code: 'note("c4").s("sine").attack(0.5).decay(0.3).sustain(0.6).release(1)' },
      { name: 'Staccato', code: 'note("c4 e4 g4 c5").s("triangle").decay(0.05).sustain(0).fast(2)' },
    ]
  },
  {
    name: 'Mini-notation',
    snippets: [
      { name: 'Grupo []', code: 'note("[c4 e4] g4 [a4 c5] g4").s("sine")' },
      { name: 'Alternancia <>', code: 'note("c4 e4 g4").s("<sine triangle square>")' },
      { name: 'Repetición !', code: 's("bd!3 sd")' },
      { name: 'Euclidean ()', code: 's("bd(3,8)")' },
      { name: 'Random ?', code: 's("bd sd? hh sd?0.3")' },
      { name: 'Polimétrico {}', code: 'note("{c4 e4 g4, c5 d5 e5 f5}").s("sine")' },
      { name: 'Rango ..', code: 'n("0 .. 7").scale("C:major").s("sine")' },
    ]
  },
  {
    name: 'Samples',
    snippets: [
      { name: 'Piano', code: 'note("c4 e4 g4 c5").s("piano")' },
      { name: 'Drums variados', code: 's("bd:0 bd:1 bd:2 bd:3")' },
      { name: 'Con bank', code: 'note("c4 e4 g4").s("piano").bank("acoustic")' },
      { name: 'Loop con speed', code: 's("loop").speed("<1 1.5 2 0.5>").cut(1)' },
      { name: 'Chop sample', code: 's("loop").chop(8).fast(2)' },
    ]
  },
]
