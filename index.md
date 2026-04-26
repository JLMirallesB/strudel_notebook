---
layout: home
hero:
  name: "Strudel Notebook"
  text: "Composición algorítmica interactiva"
  tagline: Aprende a crear música con código
  actions:
    - theme: alt
      text: GitHub
      link: https://github.com/JLMirallesB/strudel_notebook
    - theme: alt
      text: ☕ Invitar a una horchata
      link: https://ko-fi.com/miralles
---

<script setup>
import StrudelBox from './.vitepress/components/StrudelBox.vue'
import { ref } from 'vue'
import { withBase, useRouter } from 'vitepress'

const showUrlInput = ref(false)
const lessonUrl = ref('')
const router = useRouter()

function importFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.txt'
  input.onchange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      sessionStorage.setItem('imported-lesson', String(reader.result))
      router.go(withBase('/lessons/import'))
    }
    reader.readAsText(file)
  }
  input.click()
}

function loadFromUrl() {
  if (!lessonUrl.value) return
  sessionStorage.setItem('lesson-url', lessonUrl.value)
  router.go(withBase('/lessons/import'))
}

function importHistory() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      sessionStorage.setItem('imported-history', String(reader.result))
      router.go(withBase('/play') + '#history')
    }
    reader.readAsText(file)
  }
  input.click()
}
</script>

<div class="hero-demo">

<StrudelBox code='stack(
  note("<c2 c2 bb1 bb1>/4").s("sawtooth").gain(0.4).lpf(400),
  note("<c3 eb3 c3 bb2>/4").s("sawtooth").gain(0.2).lpf(800),
  note("[c4 eb4 g4 bb4]*2").s("sine").gain(0.15).delay(0.4).delaytime(0.3).delayfeedback(0.5).room(0.6),
  note("~ ~ ~ ~ c5 ~ ~ ~").s("triangle").gain(0.1).delay(0.6).delaytime(0.5).room(0.8)
)'>
</StrudelBox>

</div>

<div class="home-actions">
  <a href="/lessons/" class="action-btn primary">Empezar a aprender</a>
  <button class="action-btn" @click="importFile">Importar lección (.md)</button>
  <button class="action-btn" @click="showUrlInput = !showUrlInput">Lección desde URL</button>
  <button class="action-btn" @click="importHistory">Importar historial (.json)</button>
</div>

<div v-if="showUrlInput" class="url-input-bar">
  <input v-model="lessonUrl" type="text" placeholder="https://ejemplo.com/leccion.md" @keydown.enter="loadFromUrl" />
  <button @click="loadFromUrl">Cargar</button>
</div>

## ¿Qué es Strudel Notebook?

**[Strudel](https://strudel.cc)** es un entorno de live coding musical creado por Felix Roos. Escribes patrones en código y se convierten en música en tiempo real — ritmos, melodías, síntesis, efectos, todo desde el navegador.

**Strudel Notebook** es un manual interactivo construido sobre Strudel que añade herramientas educativas y de producción:

- **Visualizaciones en tiempo real** — forma de onda, espectro, espectrograma, piano roll, teclado de piano, partitura musical y rejilla de batería
- **Detección de pitch y acordes** — identifica la nota fundamental y el acorde que suena
- **Exportación** — graba audio, exporta MIDI, captura screenshots de las visualizaciones
- **Modo guiado y quiz** — lecciones interactivas con desplegables, placeholders y validación de respuestas
- **Librería de snippets** — patrones organizados por categoría listos para usar
- **Syntax highlighting y pattern tracking** — colorea el código y muestra qué parte suena en cada momento
- **Controles de visualización** — freeze, peak hold, escala log, zoom, y más

<style>
.hero-demo {
  max-width: 800px;
  margin: -20px auto 40px;
  padding: 0 24px;
}

.home-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin: 0 auto 40px;
  flex-wrap: wrap;
  padding: 0 24px;
}

.action-btn {
  display: inline-block;
  padding: 12px 28px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  font-family: 'Space Grotesk', sans-serif;
  cursor: pointer;
  text-decoration: none;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s, background 0.2s;
}

.action-btn:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-mute);
}

.action-btn.primary {
  background: var(--vp-c-brand-1);
  color: white;
  border-color: var(--vp-c-brand-1);
  font-size: 17px;
  padding: 14px 36px;
}

.action-btn.primary:hover {
  background: var(--vp-c-brand-2);
  border-color: var(--vp-c-brand-2);
}

.url-input-bar {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: -24px auto 40px;
  padding: 0 24px;
  max-width: 600px;
}

.url-input-bar input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-size: 14px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.url-input-bar input:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
}

.url-input-bar button {
  padding: 10px 20px;
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.url-input-bar button:hover {
  background: var(--vp-c-brand-2);
}
</style>
