# Lección 7: Síntesis

En esta lección explorarás técnicas de síntesis de sonido.

## Envolvente ADSR

Cada nota tiene 4 fases: **A**ttack, **D**ecay, **S**ustain, **R**elease.

### Attack (ataque)

Tiempo que tarda en llegar al volumen máximo:

<StrudelBox mode="guided">
note("c4 e4 g4").s("sine").attack([[dropdown:0|0.1|0.3|0.5|1]])
</StrudelBox>

### Decay y Sustain

Decay = tiempo de caída. Sustain = nivel que se mantiene:

<StrudelBox>
note("c4 e4 g4").s("sine").decay(0.2).sustain(0.3)
</StrudelBox>

### Release

Tiempo que tarda en silenciarse tras soltar la nota:

<StrudelBox>
note("c4 e4 g4").s("sine").release(1).slow(2)
</StrudelBox>

### Sonido tipo Pluck

<StrudelBox>
note("c4 e4 g4 c5 g4 e4").s("sine").decay(0.1).sustain(0)
</StrudelBox>

### Sonido tipo Pad

<StrudelBox>
note("[c3,e3,g3]").s("saw").attack(1).sustain(0.8).release(2).lpf(800).slow(4)
</StrudelBox>

## Síntesis FM

La síntesis FM usa un oscilador para modular la frecuencia de otro, creando timbres complejos:

<StrudelBox mode="guided">
note("c5 e5 g5 c6")
  .s("sine")
  .fm([[dropdown:0|2|4|8|16]])
  .fmh([[dropdown:1|2|3|4|5]])
</StrudelBox>

- `fm(n)` = índice de modulación (más = más armónicos)
- `fmh(n)` = ratio de armonía (cambia el timbre)

### Campana FM

<StrudelBox>
note("c5 e5 g5 c6").s("sine").fm(4).fmh(3.01).decay(0.5).sustain(0)
</StrudelBox>

### Bass FM

<StrudelBox>
note("c2 c2 eb2 c2").s("sine").fm(8).fmh(1).fmdecay(0.1).fmsustain(0).decay(0.3).sustain(0)
</StrudelBox>

## Filtros como síntesis

El filtro no solo quita frecuencias — con resonancia alta, crea nuevos timbres:

<StrudelBox>
note("c3 e3 g3 c4")
  .s("saw")
  .lpf(sine.range(200, 3000).slow(4))
  .lpq(8)
</StrudelBox>

## Detuning y Unísono

Desfasar ligeramente la afinación crea un sonido más ancho:

<StrudelBox>
note("c3 e3 g3").s("saw").gain(0.2).lpf(1500).detune(15)
</StrudelBox>

::: tip Observa la forma de onda
En la pestaña **Audio**, el waveform muestra cómo el detuning crea interferencia entre las ondas.
:::

## Noise (ruido)

Strudel incluye diferentes tipos de ruido:

<StrudelBox>
s("pink").gain(0.3).lpf(1000)
</StrudelBox>

Tipos: `white`, `pink`, `brown`, `crackle`

## Ejercicio

Diseña un sonido con envolvente FM y filtro:

<StrudelBox :snippets="true">
note("c4 e4 g4 c5")
  .s("sine")
  .fm(4)
  .fmh(2)
  .decay(0.3)
  .sustain(0.1)
  .lpf(2000)
  .room(0.3)
</StrudelBox>

## Resumen

- **ADSR**: `attack`, `decay`, `sustain`, `release`
- **FM**: `fm(index)`, `fmh(ratio)`, `fmattack`, `fmdecay`
- **Filtros**: `lpf`, `hpf`, `bpf` con `lpq` para resonancia
- **Ruido**: `white`, `pink`, `brown`, `crackle`
- **Detune**: `detune(cents)` para desafinación
