# Lección 6: Mini-notation

La mini-notation es el lenguaje compacto que usas dentro de los strings `"..."` en Strudel.

## Operadores básicos

### Repetición con `*`

Repite un elemento varias veces dentro del mismo ciclo:

<StrudelBox>
s("hh*8")
</StrudelBox>

### Ralentizar con `/`

Hace que un elemento dure varios ciclos:

<StrudelBox>
note("c4/2 e4 g4").s("sine")
</StrudelBox>

### Silencio con `~`

<StrudelBox>
s("bd ~ sd ~ bd bd sd ~")
</StrudelBox>

### Repetir con `!`

Repite sin comprimir en el tiempo:

<StrudelBox>
s("bd!3 sd")
</StrudelBox>

Esto es diferente de `*`: `bd!3` son 3 bds en 3 tiempos, `bd*3` son 3 bds en 1 tiempo.

## Agrupaciones

### Grupo `[ ]`

Subdivide un tiempo en partes iguales:

<StrudelBox>
s("[bd sd] hh [bd bd sd] hh")
</StrudelBox>

### Alternancia `< >`

Elige un elemento diferente en cada ciclo:

<StrudelBox code='note("c4 e4 g4").s("<sine triangle square saw>")'>
</StrudelBox>

::: tip Observa
Mira la pestaña **Teclado** — verás las mismas notas pero el timbre cambia en cada ciclo.
:::

### Polimetría `{ }`

Dos patrones con diferente número de pasos:

<StrudelBox>
note("{c4 e4 g4, d4 f4 a4 c5}").s("sine")
</StrudelBox>

## Ritmos euclidianos

La notación `(pulsos, pasos)` distribuye los pulsos equitativamente:

<StrudelBox>
s("bd(3,8)")
</StrudelBox>

Esto genera el ritmo del **tresillo** (3 golpes en 8 pasos). Combinando:

<StrudelBox>
stack(
  s("bd(3,8)"),
  s("sd(2,8)"),
  s("hh(5,8)")
)
</StrudelBox>

::: tip Visualiza el ritmo
Abre la pestaña **Batería** para ver la rejilla de cada instrumento y cómo se distribuyen los golpes euclidianos.
:::

Puedes rotar el patrón con un tercer número:

<StrudelBox>
s("bd(3,8,1)")
</StrudelBox>

## Aleatoriedad con `?`

Añade azar — cada nota tiene un 50% de probabilidad de sonar:

<StrudelBox>
s("hh*8?")
</StrudelBox>

Con probabilidad personalizada (30%):

<StrudelBox>
s("hh*8?0.3")
</StrudelBox>

## Rangos con `..`

Genera secuencias de números:

<StrudelBox>
n("0 .. 7").scale("C:major").s("sine")
</StrudelBox>

## Comas: stack inline

Las comas dentro de `""` apilan patrones (como `stack`):

<StrudelBox>
s("bd sd bd sd, hh*8, ~ cp ~ cp")
</StrudelBox>

## Quiz

¿Cuántos pulsos necesitas para el ritmo de cinquillo (5 en 8 pasos)?

<StrudelBox mode="quiz">
s("bd([[quiz:3|5|7|answer:5]],8)")
</StrudelBox>

## Ejercicio

Crea un patrón complejo usando solo mini-notation (sin funciones como stack o fast):

<StrudelBox :snippets="true">
s("bd [hh hh] sd [hh hh], ~ cp ~ cp?0.5")
</StrudelBox>

## Resumen

| Operador | Significado | Ejemplo |
|----------|------------|---------|
| `*n` | Repetir rápido | `"hh*4"` |
| `/n` | Ralentizar | `"bd/2"` |
| `~` | Silencio | `"bd ~ sd ~"` |
| `!n` | Repetir | `"bd!3 sd"` |
| `[...]` | Subdividir | `"[bd sd] hh"` |
| `<...>` | Alternar por ciclo | `"<bd sd hh>"` |
| `{...}` | Polimetría | `"{a b c, d e}"` |
| `(p,s)` | Euclidiano | `"(3,8)"` |
| `?` | Random 50% | `"hh?"` |
| `?n` | Random n% | `"hh?0.3"` |
| `,` | Stack inline | `"bd,hh*4"` |
| `..` | Rango | `"0..7"` |

[Siguiente: Síntesis →](/lessons/07-sintesis)
