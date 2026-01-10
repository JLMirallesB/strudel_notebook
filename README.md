# Strudel Guided Lab

Demo minima para conservatorio: Strudel en la misma pagina, panel guiado y visualizaciones de audio en tiempo real.

## Requisitos

- Node.js 18+ (recomendado 20)
- Navegador moderno con Web Audio API

## Instalacion y desarrollo local

```bash
npm install
npm run dev
```

Abre el enlace que imprime Vite (por defecto http://localhost:5173).

## Build y preview

```bash
npm run build
npm run preview
```

## Deploy en GitHub Pages

Este repo incluye un workflow en `.github/workflows/deploy.yml` que publica `dist/`.

1. Haz push a `main`.
2. En GitHub: **Settings -> Pages -> Source -> GitHub Actions**.
3. Espera a que termine el workflow. La URL quedara en la pestaña Pages.

El workflow configura `BASE_PATH` con el nombre del repo para que Vite genere rutas correctas.

## Estructura

```
/src
  main.ts
  strudel.ts
  audioViz.ts
  notation.ts
  ui.ts
  styles.css
index.html
vite.config.ts
package.json
LICENSE
README.md
.github/workflows/deploy.yml
```

## Integracion Strudel

- Se usa `@strudel/web` con `webaudioRepl` (sin iframe).
- `buildStrudelCode(params)` genera el codigo Strudel desde el panel guiado.
- `evaluateAndPlay(code)` evalua y arranca el scheduler tras interaccion del usuario.
- El kit de bateria carga muestras desde `https://strudel.cc/strudel.json` (descarga en primer uso).

## Analisis de audio

- Cada patron incluye `.analyze(1)`.
- Las visualizaciones consumen `getAnalyzerData("time"|"frequency", 1)` que internamente usa `AnalyserNode.getFloatTimeDomainData` y `AnalyserNode.getFloatFrequencyData`.
- Se dibujan waveform, spectrum y un espectrograma por columnas.

## Notacion

- Se implementa un piano-roll propio en canvas (fallback estable).
- Eventos se capturan via `Pattern.onTrigger(...)` en el wrapper de Strudel.
- TODO: integrar VexFlow para notacion tradicional por compas.

## MIDI (opcional)

- Toggle “Midi input” en el panel.
- CC 74 controla cutoff, CC 91 controla reverb.
- Requiere HTTPS y permiso del navegador (GitHub Pages cumple esto).

## Licencia

Este proyecto se distribuye bajo **AGPL-3.0**. Ver `LICENSE`.
