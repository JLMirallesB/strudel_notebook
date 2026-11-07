# Strudel Notebook

Manual interactivo de composición algorítmica con Strudel para conservatorio.

## Características

- **Lecciones interactivas**: Código Strudel editable con explicaciones paso a paso
- **Visualizaciones en tiempo real**: Waveform, espectro, espectrograma y piano roll
- **Múltiples páginas**: Estructura de manual que crece con cada lección

## Requisitos

- Node.js 18+ (recomendado 20)
- Navegador moderno con Web Audio API

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:5173 en tu navegador.

## Build y preview

```bash
npm run build
npm run preview
```

## Deploy en GitHub Pages

Este repo incluye un workflow en `.github/workflows/deploy.yml`.

1. Haz push a `main`
2. En GitHub: **Settings → Pages → Source → GitHub Actions**
3. Espera a que termine el workflow

## Estructura

```
.vitepress/
  config.ts           # Configuración de VitePress
  theme/
    index.ts          # Tema custom
    Layout.vue        # Layout con visualizaciones
    style.css         # Estilos globales
  components/
    StrudelBox.vue    # Editor de código Strudel
    VisualizerPanel.vue
    audio/
      engine.ts       # Motor de audio singleton
lessons/
  index.md
  01-primeros-sonidos.md
  02-ritmos.md
  03-melodias.md
  04-efectos.md
index.md              # Página principal
```

## Stack

- **VitePress**: Framework de documentación
- **@strudel/web**: Motor de audio Strudel
- **Vue 3**: Componentes interactivos
- **Canvas API**: Visualizaciones

## Licencia

© 2026 José Luis Miralles Bono ([jlmirall.es](https://jlmirall.es)) · joseluismirallesbono@gmail.com

- **Código:** [GNU AGPL v3](LICENSE). Obligatoria, además, porque usa [Strudel](https://strudel.cc), que es AGPL.
- **Contenidos** (lecciones, textos y ejemplos musicales): [CC BY-SA 4.0](LICENSE-CONTENIDOS).

Más información: [Vibe-live-coding: jamming con la inteligencia artificial y Strudel](https://elpulpoenelvaso.jlmirall.es/?p=762) ·
☕ [Invítame a una horchata](https://ko-fi.com/miralles)
