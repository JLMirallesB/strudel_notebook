---
layout: page
title: Importar lección
sidebar: false
---

<script setup>
import { ref, onMounted } from 'vue'
import StrudelBox from '../.vitepress/components/StrudelBox.vue'

const loading = ref(true)
const error = ref('')
const pages = ref([])
const currentPage = ref(0)

function parseSections(md) {
  const parts = []
  const lines = md.split('\n')
  let current = { type: 'text', content: '' }

  for (const line of lines) {
    const strudelMatch = line.match(/^<StrudelBox([^>]*)>/)
    if (strudelMatch) {
      if (current.content.trim()) parts.push({ ...current })
      const props = strudelMatch[1] || ''
      const mode = props.match(/mode="(\w+)"/)?.[1] || null
      const snippets = props.includes('snippets')
      const interchange = props.includes('interchange')
      const codeAttr = props.match(/code='([^']*)'/)?.[1] || null
      current = { type: 'strudel', content: '', mode, snippets, interchange, codeAttr }
      continue
    }
    if (line.trim() === '</StrudelBox>') {
      if (current.type === 'strudel') {
        parts.push({ ...current })
        current = { type: 'text', content: '' }
      }
      continue
    }
    current.content += line + '\n'
  }
  if (current.content.trim()) parts.push({ ...current })
  return parts
}

function splitIntoPages(md) {
  const result = []
  const h1Regex = /^# (.+)$/gm
  let match
  const positions = []

  while ((match = h1Regex.exec(md)) !== null) {
    positions.push({ index: match.index, title: match[1] })
  }

  if (positions.length <= 1) {
    const title = positions.length === 1 ? positions[0].title : 'Lección importada'
    return [{ title, sections: parseSections(md) }]
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index
    const end = i + 1 < positions.length ? positions[i + 1].index : md.length
    const content = md.slice(start, end)
    result.push({ title: positions[i].title, sections: parseSections(content) })
  }

  return result
}

function formatText(text) {
  return text
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^:::.*tip\s*(.*)/gm, '<div class="tip-box"><strong>$1</strong>')
    .replace(/^:::.*info\s*(.*)/gm, '<div class="info-box"><strong>$1</strong>')
    .replace(/^:::$/gm, '</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^\|(.+)$/gm, '')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n/g, '<br><br>')
}

onMounted(async () => {
  try {
    let md = ''
    const imported = sessionStorage.getItem('imported-lesson')
    if (imported) {
      sessionStorage.removeItem('imported-lesson')
      md = imported
    } else {
      const url = sessionStorage.getItem('lesson-url')
      if (url) {
        sessionStorage.removeItem('lesson-url')
        const resp = await fetch(url)
        if (!resp.ok) throw new Error('Error ' + resp.status + ': ' + resp.statusText)
        md = await resp.text()
      }
    }

    if (!md) {
      error.value = 'No se ha proporcionado ninguna lección. Vuelve a la página de inicio para importar.'
      loading.value = false
      return
    }

    pages.value = splitIntoPages(md)
    loading.value = false
  } catch (e) {
    error.value = e.message || 'Error al cargar la lección'
    loading.value = false
  }
})
</script>

<div v-if="loading" class="import-status">Cargando lección...</div>

<div v-else-if="error" class="import-error">{{ error }}</div>

<div v-else class="imported-lesson">
  <!-- Navigation -->
  <div v-if="pages.length > 1" class="lesson-nav">
    <button
      v-for="(page, i) in pages"
      :key="i"
      class="lesson-nav-btn"
      :class="{ active: currentPage === i }"
      @click="currentPage = i"
    >{{ i + 1 }}. {{ page.title }}</button>
  </div>

  <!-- Current page content -->
  <div class="lesson-page">
    <template v-for="(section, i) in pages[currentPage]?.sections" :key="i">
      <div v-if="section.type === 'text'" v-html="formatText(section.content)" class="lesson-text"></div>
      <StrudelBox
        v-else-if="section.type === 'strudel'"
        :code="section.codeAttr || section.content.trim()"
        :mode="section.mode"
        :snippets="section.snippets"
        :interchange="section.interchange"
      />
    </template>
  </div>

  <!-- Prev/Next -->
  <div v-if="pages.length > 1" class="lesson-pager">
    <button v-if="currentPage > 0" class="pager-btn" @click="currentPage--">← {{ pages[currentPage - 1].title }}</button>
    <span v-else></span>
    <span class="pager-count">{{ currentPage + 1 }} / {{ pages.length }}</span>
    <button v-if="currentPage < pages.length - 1" class="pager-btn" @click="currentPage++">{{ pages[currentPage + 1].title }} →</button>
    <span v-else></span>
  </div>
</div>

<style>
.import-status {
  text-align: center;
  padding: 40px;
  color: var(--vp-c-text-2);
  font-size: 1.1rem;
}

.import-error {
  text-align: center;
  padding: 40px;
  color: #ef4444;
  font-size: 1.1rem;
}

.imported-lesson {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 24px 280px;
}

.lesson-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 24px;
  padding: 12px;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}

.lesson-nav-btn {
  padding: 6px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.lesson-nav-btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}

.lesson-nav-btn.active {
  background: var(--vp-c-brand-1);
  color: white;
  border-color: var(--vp-c-brand-1);
}

.lesson-pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--vp-c-divider);
}

.pager-btn {
  padding: 8px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
  font-size: 14px;
  cursor: pointer;
}

.pager-btn:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
}

.pager-count {
  color: var(--vp-c-text-3);
  font-size: 13px;
}

.lesson-text {
  margin: 16px 0;
  line-height: 1.7;
}

.lesson-text h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 32px 0 16px;
  font-family: 'Space Grotesk', sans-serif;
}

.lesson-text h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 24px 0 12px;
  font-family: 'Space Grotesk', sans-serif;
}

.lesson-text h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 20px 0 8px;
}

.lesson-text code {
  background: var(--vp-c-bg-mute);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.9em;
}

.lesson-text li {
  margin-left: 20px;
  list-style: disc;
}

.tip-box {
  padding: 12px 16px;
  background: var(--vp-c-brand-soft);
  border-left: 4px solid var(--vp-c-brand-1);
  border-radius: 4px;
  margin: 16px 0;
}

.info-box {
  padding: 12px 16px;
  background: var(--vp-c-default-soft);
  border-left: 4px solid var(--vp-c-text-3);
  border-radius: 4px;
  margin: 16px 0;
}
</style>
