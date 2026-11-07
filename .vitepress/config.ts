import { defineConfig } from 'vitepress'

const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.BASE_PATH || (repo ? `/${repo}/` : '/')

export default defineConfig({
  title: 'Strudel Notebook',
  description: 'Manual interactivo de composición algorítmica con Strudel',
  base,
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600&display=swap', rel: 'stylesheet' }]
  ],

  themeConfig: {
    nav: [
      { text: 'Inicio', link: '/' },
      { text: 'Lecciones', link: '/lessons/' }
    ],

    sidebar: [
      {
        text: 'Introducción',
        items: [
          { text: 'Bienvenida', link: '/' },
          { text: 'Primeros pasos', link: '/lessons/' }
        ]
      },
      {
        text: 'Lecciones',
        items: [
          { text: '1. Primeros sonidos', link: '/lessons/01-primeros-sonidos' },
          { text: '2. Ritmos básicos', link: '/lessons/02-ritmos' },
          { text: '3. Melodías', link: '/lessons/03-melodias' },
          { text: '4. Efectos', link: '/lessons/04-efectos' },
          { text: '5. Transformaciones', link: '/lessons/05-transformaciones' },
          { text: '6. Mini-notation', link: '/lessons/06-mininotation' },
          { text: '7. Síntesis', link: '/lessons/07-sintesis' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/JLMirallesB/strudel_notebook' }
    ],

    footer: {
      message: 'Hecho con Strudel y VitePress por <a href="https://jlmirall.es" target="_blank">José Luis Miralles Bono</a> con ayuda de Claude · <a href="mailto:joseluismirallesbono@gmail.com">joseluismirallesbono@gmail.com</a> · <a href="https://ko-fi.com/miralles" target="_blank">☕ Invítame a una horchata</a> · <a href="https://elpulpoenelvaso.jlmirall.es/?p=762" target="_blank">Más información sobre este proyecto</a>',
      copyright: 'Código bajo licencia <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank">AGPL v3</a> · contenidos bajo <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank">CC BY-SA 4.0</a> · <a href="https://github.com/JLMirallesB/strudel_notebook" target="_blank">código fuente</a>'
    }
  }
})
