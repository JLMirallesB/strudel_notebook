# Strudel Notebook

Manual interactivo de composición algorítmica con Strudel.

## Stack Técnico

- **Framework**: VitePress (Markdown + Vue 3)
- **Motor de Audio**: @strudel/web con `initStrudel()` API
- **Visualizaciones**: Canvas 2D (waveform, spectrum, spectrogram, piano roll)

## Estructura del Proyecto

```
strudel_notebook/
├── .vitepress/
│   ├── config.ts                 # Navegación y configuración
│   ├── theme/
│   │   ├── index.ts              # Registro global de componentes
│   │   ├── Layout.vue            # Layout con panel de visualizaciones
│   │   └── style.css             # Estilos globales
│   └── components/
│       ├── StrudelBox.vue        # Editor de código con play/stop
│       ├── VisualizerPanel.vue   # Panel con 4 visualizaciones
│       └── audio/
│           └── engine.ts         # Singleton de audio
├── lessons/
│   ├── index.md                  # Página principal de lecciones
│   ├── 01-primeros-sonidos.md
│   ├── 02-ritmos.md
│   ├── 03-melodias.md
│   ├── 04-efectos.md
│   └── _plantilla.md             # Template para nuevas lecciones
├── index.md                      # Página de inicio
└── package.json
```

## Componentes Clave

### StrudelBox
Editor de código Strudel embebido en Markdown. Registrado globalmente, no requiere import.

```markdown
<StrudelBox>
note("c4 e4 g4").s("sine")
</StrudelBox>
```

### VisualizerPanel
Panel fijo inferior con 4 visualizaciones:
- **Waveform**: Forma de onda con eje de amplitud (-1 a +1)
- **Spectrum**: Espectro de frecuencias (escala logarítmica, 20Hz-20kHz)
- **Spectrogram**: Espectrograma con escala de color
- **Piano Roll**: Notas MIDI con etiquetas (C3, C4, C5)

### AudioEngine (Singleton)
Ubicado en `.vitepress/components/audio/engine.ts`. Usa `initStrudel()` para inicializar correctamente el motor de audio.

## Crear Nuevas Lecciones

1. Copiar `lessons/_plantilla.md` con nuevo nombre (ej: `05-sampling.md`)
2. Añadir a la sidebar en `.vitepress/config.ts`
3. Usar `<StrudelBox>` para código ejecutable

## Comandos

```bash
npm run dev      # Servidor de desarrollo (localhost:5173)
npm run build    # Build de producción
npm run preview  # Preview del build
```

## Git Workflow

- **main**: Rama de producción, desplegada a GitHub Pages
- **develop**: Rama de desarrollo
- Versiones semánticas: v1.0, v1.1, v1.2...

## Deploy

GitHub Actions despliega automáticamente cuando se hace push a main.
