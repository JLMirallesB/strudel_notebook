---
layout: home
hero:
  name: "Strudel Notebook"
  text: "Manual interactivo de composición algorítmica"
  tagline: Aprende a crear música con código usando Strudel
  actions:
    - theme: brand
      text: Empezar
      link: /lessons/
    - theme: alt
      text: Ver en GitHub
      link: https://github.com/JLMirallesB/strudel_notebook

features:
  - icon: 🎵
    title: Aprende haciendo
    details: Escribe código y escucha el resultado inmediatamente. Cada lección incluye ejemplos interactivos.
  - icon: 📊
    title: Visualización en tiempo real
    details: Observa la forma de onda, el espectro y el piano roll mientras suena tu música.
  - icon: 🎹
    title: De lo simple a lo complejo
    details: Desde tu primer sonido hasta patrones rítmicos complejos y melodías generativas.
---

<script setup>
import StrudelBox from './.vitepress/components/StrudelBox.vue'
</script>

## Prueba ahora

Haz clic en **Play** para escuchar tu primer patrón de Strudel:

<StrudelBox>
note("c4 e4 g4 c5").s("triangle")
</StrudelBox>

::: tip ¿Qué está pasando?
- `note("c4 e4 g4 c5")` define las notas: Do, Mi, Sol, Do (una octava arriba)
- `.s("triangle")` usa un oscilador de onda triangular
- El panel inferior muestra las visualizaciones en tiempo real
:::

[Comenzar con la primera lección →](/lessons/01-primeros-sonidos)
