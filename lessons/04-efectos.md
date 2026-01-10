# Lección 4: Efectos

En esta lección aprenderás a aplicar efectos de audio para dar más carácter a tus sonidos.

## Filtro paso bajo (LPF)

El filtro paso bajo elimina las frecuencias altas. Se controla con `.lpf()` o `.cutoff()`:

<StrudelBox>
note("c3 c3 c3 c3")
  .s("saw")
  .cutoff(400)
</StrudelBox>

Prueba valores entre 200 y 8000:
- Valores bajos = sonido oscuro, apagado
- Valores altos = sonido brillante

::: tip Observa el espectro
Mira el panel **Spectrum**. Con filtro bajo, solo verás las frecuencias graves (izquierda). Sin filtro, verás muchas frecuencias.
:::

## Filtro dinámico

Puedes hacer que el filtro cambie en el tiempo:

<StrudelBox>
note("c3 c3 c3 c3")
  .s("saw")
  .cutoff("200 800 2000 800")
</StrudelBox>

O usar una rampa suave:

<StrudelBox>
note("c3 c3 c3 c3")
  .s("saw")
  .cutoff(sine.range(200, 2000))
</StrudelBox>

## Reverberación

La reverb simula el espacio acústico. Se controla con `.room()`:

<StrudelBox>
note("c4 e4 g4 c5")
  .s("triangle")
  .room(0.8)
</StrudelBox>

- `room(0)` = sin reverb (seco)
- `room(0.5)` = reverb media
- `room(1)` = mucha reverb (húmedo)

## Ganancia (volumen)

Controla el volumen con `.gain()`:

<StrudelBox>
note("c4 e4 g4 c5")
  .s("triangle")
  .gain(0.5)
</StrudelBox>

## Combinando efectos

Los efectos se pueden encadenar:

<StrudelBox>
note("c3 e3 g3 c4")
  .s("saw")
  .cutoff(1200)
  .room(0.5)
  .gain(0.7)
</StrudelBox>

## Delay (eco)

El delay crea repeticiones del sonido:

<StrudelBox>
note("c4 ~ e4 ~")
  .s("triangle")
  .delay(0.5)
  .delaytime(0.25)
</StrudelBox>

- `.delay(n)` = cantidad de eco (0-1)
- `.delaytime(n)` = tiempo entre repeticiones

## Ejemplo completo

Un patrón con batería, melodía y efectos:

<StrudelBox>
setcps(0.8)

stack(
  n("0 2 4 7 4 2")
    .scale("C:minor")
    .s("saw")
    .cutoff(sine.range(400, 1600))
    .room(0.3)
    .gain(0.6),
  sound("bd ~ sd ~")
    .room(0.2),
  sound("~ hh ~ hh")
    .gain(0.4)
)
</StrudelBox>

## Ejercicio

Experimenta con esta base, modificando:
1. El valor del filtro
2. La cantidad de reverb
3. Añade delay a la melodía

<StrudelBox>
setcps(0.7)

stack(
  n("0 ~ 4 ~ 7 ~ 4 2")
    .scale("C:minor")
    .s("supersaw")
    .cutoff(1000)
    .room(0.4)
    .gain(0.5),
  sound("bd [~ bd] sd [~ sd:1]")
    .room(0.2)
)
</StrudelBox>

## Resumen

- `.cutoff(n)` = filtro paso bajo (200-8000)
- `.room(n)` = reverberación (0-1)
- `.gain(n)` = volumen (0-1)
- `.delay(n)` + `.delaytime(n)` = eco
- Los efectos se encadenan: `.cutoff().room().gain()`

---

## ¿Qué sigue?

Has completado las lecciones básicas. Ahora puedes:

1. Experimentar combinando todo lo aprendido
2. Visitar [strudel.cc](https://strudel.cc) para aprender más funciones
3. Crear tus propias composiciones

::: info Recursos adicionales
- [Documentación oficial de Strudel](https://strudel.cc/learn/getting-started/)
- [Referencia de funciones](https://strudel.cc/functions/core/)
- [Comunidad de TidalCycles](https://club.tidalcycles.org/)
:::
