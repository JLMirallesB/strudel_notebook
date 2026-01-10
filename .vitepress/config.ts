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
          { text: '4. Efectos', link: '/lessons/04-efectos' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/JLMirallesB/strudel_notebook' }
    ],

    footer: {
      message: 'Hecho con Strudel y VitePress',
      copyright: 'AGPL-3.0 License'
    }
  }
})
