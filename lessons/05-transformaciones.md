# Lección 5: Transformaciones

En esta lección aprenderás a transformar patrones para crear variaciones.

## Fast y Slow

Cambia la velocidad de un patrón:

<StrudelBox>
note("c4 e4 g4 c5").s("sine").fast(2)
</StrudelBox>

<StrudelBox>
note("c4 e4 g4 c5").s("sine").slow(2)
</StrudelBox>

- `fast(2)` = el doble de rápido
- `slow(2)` = el doble de lento

## Rev (invertir)

Toca el patrón al revés:

<StrudelBox>
note("c4 d4 e4 f4 g4").s("sine").rev()
</StrudelBox>

## Every (cada N ciclos)

Aplica una transformación cada cierto número de ciclos:

<StrudelBox>
note("c4 d4 e4 g4").s("triangle").every(3, fast(2))
</StrudelBox>

Cada 3 ciclos, el patrón suena al doble de velocidad. Prueba con `rev`:

<StrudelBox>
note("c4 d4 e4 g4").s("triangle").every(4, rev)
</StrudelBox>

## Jux (juxtaposición estéreo)

Aplica una transformación solo a un canal (izquierda/derecha):

<StrudelBox>
note("c4 e4 g4 c5").s("triangle").jux(rev)
</StrudelBox>

::: tip Escucha con auriculares
Jux reparte el sonido original a un lado y la versión transformada al otro. Con auriculares se escucha mejor.
:::

## Off (eco con transformación)

Superpone una copia desplazada en el tiempo:

<StrudelBox>
note("c4 e4 g4").s("sine").off(0.125, transpose(7))
</StrudelBox>

## Superimpose (capas)

Superpone el patrón con una versión transformada:

<StrudelBox>
note("c4 e4 g4").s("sine").superimpose(transpose(12))
</StrudelBox>

## Palindrome

Toca el patrón primero hacia adelante y luego hacia atrás:

<StrudelBox>
note("c4 d4 e4 f4 g4").s("sine").palindrome()
</StrudelBox>

## Iter

Rota el patrón en cada ciclo:

<StrudelBox>
note("c4 d4 e4 f4").s("triangle").iter(4)
</StrudelBox>

## Struct (estructura rítmica)

Aplica una estructura rítmica externa a tu patrón:

<StrudelBox>
note("c4 e4 g4 c5").struct("x ~ x x ~ x ~ x").s("sine")
</StrudelBox>

## Combinando transformaciones

Las transformaciones se pueden encadenar:

<StrudelBox>
note("c4 d4 e4 g4")
  .s("triangle")
  .every(3, fast(2))
  .every(4, rev)
  .jux(transpose(7))
</StrudelBox>

::: tip Observa la partitura
Abre la pestaña **Partitura** en el panel inferior para ver cómo las transformaciones cambian las notas en cada ciclo.
:::

## Quiz

¿Qué transformación invierte el orden de las notas?

<StrudelBox mode="quiz">
note("c4 d4 e4 g4").s("triangle").[[quiz:fast(2)|slow(2)|rev()|jux(rev)|answer:rev()]]
</StrudelBox>

## Ejercicio

Crea un patrón que use al menos 3 transformaciones diferentes:

<StrudelBox :snippets="true">
note("c4 d4 e4 g4").s("triangle")
</StrudelBox>

## Resumen

- `fast(n)` / `slow(n)` = cambiar velocidad
- `rev()` = invertir
- `every(n, func)` = aplicar cada N ciclos
- `jux(func)` = juxtaposición estéreo
- `off(t, func)` = eco transformado
- `superimpose(func)` = superponer con transformación
- `palindrome()` = ida y vuelta
- `iter(n)` = rotar por ciclos
- `struct("x ~ x x")` = estructura rítmica

[Siguiente: Mini-notation →](/lessons/06-mininotation)
