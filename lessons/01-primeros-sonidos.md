# Lección 1: Primeros sonidos

En esta lección aprenderás a generar tus primeros sonidos con Strudel.

## El oscilador básico

Un **oscilador** es un generador de ondas periódicas. Es la fuente más básica de sonido en síntesis.

Prueba este código:

<StrudelBox>
note("c4").s("sine")
</StrudelBox>

Escucharás una nota **Do4** (Do central) con forma de onda sinusoidal.

## Tipos de osciladores

Strudel incluye varios tipos de osciladores. Cada uno tiene un timbre diferente:

### Onda sinusoidal (sine)
El sonido más puro, sin armónicos:

<StrudelBox>
note("c4").s("sine")
</StrudelBox>

### Onda triangular (triangle)
Sonido suave con algunos armónicos impares:

<StrudelBox>
note("c4").s("triangle")
</StrudelBox>

### Onda cuadrada (square)
Sonido hueco, rico en armónicos impares:

<StrudelBox>
note("c4").s("square")
</StrudelBox>

### Onda de sierra (saw)
Sonido brillante, contiene todos los armónicos:

<StrudelBox>
note("c4").s("saw")
</StrudelBox>

::: tip Observa el espectro
Cuando cambies de oscilador, observa cómo cambia el **Spectrum** en el panel inferior. La onda sinusoidal tiene un solo pico, mientras que la sierra tiene muchos picos (armónicos).
:::

## Secuencias de notas

Puedes tocar varias notas en secuencia separándolas con espacios:

<StrudelBox>
note("c4 d4 e4 f4").s("triangle")
</StrudelBox>

Prueba a modificar las notas. Las notas se nombran así:
- **c, d, e, f, g, a, b** = Do, Re, Mi, Fa, Sol, La, Si
- El número indica la octava (4 es la octava central)
- Añade **#** para sostenido: `c#4`, `f#4`

## Acordes

Puedes tocar notas simultáneamente usando corchetes:

<StrudelBox>
note("[c4,e4,g4]").s("sine")
</StrudelBox>

Esto es un acorde de Do mayor.

## Ejercicio

Crea una secuencia que alterne entre un acorde y notas individuales:

<StrudelBox>
note("[c4,e4,g4] e4 [d4,f4,a4] f4").s("triangle")
</StrudelBox>

## Resumen

- `note("...")` define las notas a tocar
- `.s("...")` selecciona el tipo de sonido (sine, triangle, square, saw)
- Las notas se separan por espacios
- Los corchetes `[...]` crean acordes

[Siguiente: Ritmos básicos →](/lessons/02-ritmos)
