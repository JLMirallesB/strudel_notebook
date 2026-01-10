# Lección 2: Ritmos básicos

En esta lección aprenderás a crear patrones rítmicos con batería.

## Tu primer beat

En Strudel, usamos `sound()` para cargar samples de audio. Los más básicos son:

- **bd** = bombo (bass drum)
- **sd** = caja (snare drum)
- **hh** = hi-hat

<StrudelBox>
sound("bd")
</StrudelBox>

## Patrones de batería

Combina varios sonidos para crear un ritmo:

<StrudelBox>
sound("bd sd bd sd")
</StrudelBox>

Un beat clásico de 4/4:

<StrudelBox>
sound("bd hh sd hh")
</StrudelBox>

## Silencios

Usa `~` para crear silencios:

<StrudelBox>
sound("bd ~ sd ~")
</StrudelBox>

## Subdivisiones

Puedes subdividir el tiempo usando corchetes:

<StrudelBox>
sound("bd [hh hh] sd [hh hh]")
</StrudelBox>

Los corchetes hacen que los sonidos dentro ocupen el mismo tiempo que un solo elemento fuera.

## Stack: Capas simultáneas

Usa `stack()` para tocar varias líneas a la vez:

<StrudelBox>
stack(
  sound("bd ~ bd ~"),
  sound("~ sd ~ sd"),
  sound("hh hh hh hh")
)
</StrudelBox>

::: tip Observa el piano roll
Cuando uses batería, el panel inferior muestra un **drum roll** en lugar de piano roll. Cada pista (BD, SD, HH) aparece en un carril diferente.
:::

## Controlando el tempo

El tempo se controla con `setcps()` (ciclos por segundo):

<StrudelBox>
setcps(0.5)

sound("bd hh sd hh")
</StrudelBox>

- `setcps(1)` = 1 ciclo por segundo = 60 BPM (si hay 1 beat por ciclo)
- `setcps(0.5)` = más lento
- `setcps(2)` = más rápido

## Variaciones con subciclos

Crea ritmos más complejos:

<StrudelBox>
setcps(0.8)

stack(
  sound("bd ~ [~ bd] ~"),
  sound("~ sd ~ [sd sd]"),
  sound("[hh hh] [hh hh] [hh hh] [hh [hh hh]]")
)
</StrudelBox>

## Ejercicio

Crea tu propio beat combinando:
- Un patrón de bombo
- Un patrón de caja
- Un patrón de hi-hat

<StrudelBox>
setcps(1)

stack(
  sound("bd ~ bd [~ bd]"),
  sound("~ sd ~ sd"),
  sound("hh hh hh hh")
)
</StrudelBox>

## Resumen

- `sound("bd sd hh")` carga samples de batería
- `~` crea silencios
- `[...]` subdivide el tiempo
- `stack(...)` superpone varias líneas
- `setcps(n)` controla el tempo

[Siguiente: Melodías →](/lessons/03-melodias)
