# Lección 3: Melodías

En esta lección aprenderás a crear melodías y trabajar con escalas.

## Escalas musicales

Una escala es un conjunto de notas ordenadas. La más común es la escala mayor:

<StrudelBox>
note("c4 d4 e4 f4 g4 a4 b4 c5").s("sine")
</StrudelBox>

## Usando números de escala

En lugar de escribir cada nota, puedes usar números que representan grados de la escala:

<StrudelBox>
n("0 1 2 3 4 5 6 7")
  .scale("C:major")
  .s("triangle")
</StrudelBox>

- `0` = primera nota (Do)
- `1` = segunda nota (Re)
- `2` = tercera nota (Mi)
- etc.

## Otras escalas

Prueba diferentes escalas:

### Escala menor

<StrudelBox>
n("0 1 2 3 4 5 6 7")
  .scale("C:minor")
  .s("triangle")
</StrudelBox>

### Escala pentatónica

<StrudelBox>
n("0 1 2 3 4 5 6 7")
  .scale("C:pentatonic")
  .s("triangle")
</StrudelBox>

### Modo dórico

<StrudelBox>
n("0 1 2 3 4 5 6 7")
  .scale("D:dorian")
  .s("triangle")
</StrudelBox>

## Patrones melódicos

Crea patrones interesantes combinando grados de escala:

<StrudelBox>
n("0 2 4 7 4 2 0 -1")
  .scale("C:major")
  .s("saw")
</StrudelBox>

Los números negativos bajan una octava.

## Arpegios

Un arpegio toca las notas de un acorde en secuencia:

<StrudelBox>
n("0 2 4 7")
  .scale("C:major")
  .s("triangle")
</StrudelBox>

Con subdivisiones para más velocidad:

<StrudelBox>
n("[0 2 4 7]*2")
  .scale("C:major")
  .s("triangle")
</StrudelBox>

## Combinando melodía y ritmo

<StrudelBox>
setcps(0.8)

stack(
  n("0 ~ 2 ~ 4 ~ 7 ~")
    .scale("C:minor")
    .s("saw"),
  sound("bd ~ sd ~")
)
</StrudelBox>

## Cambiando la octava

Usa `.oct()` para subir o bajar octavas:

<StrudelBox>
n("0 2 4 7")
  .scale("C:major")
  .s("triangle")
  .oct(5)
</StrudelBox>

## Ejercicio

Crea una melodía que:
1. Use una escala de tu elección
2. Tenga silencios para crear ritmo
3. Se combine con un patrón de batería

<StrudelBox>
setcps(0.7)

stack(
  n("0 ~ 4 2 ~ 5 4 ~")
    .scale("C:minor")
    .s("saw")
    .oct(4),
  sound("bd hh sd hh")
)
</StrudelBox>

::: tip Observa el piano roll
Cuando tocas melodías, el panel inferior muestra las notas en un **piano roll**. Las notas más agudas aparecen más arriba.
:::

## Resumen

- `n("0 1 2...")` usa números de escala
- `.scale("C:major")` define la escala
- Escalas comunes: major, minor, pentatonic, dorian
- `.oct(n)` cambia la octava
- Los números negativos bajan de octava

[Siguiente: Efectos →](/lessons/04-efectos)
