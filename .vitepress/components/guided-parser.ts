export type StaticSegment = {
  type: 'static'
  text: string
}

export type DropdownSegment = {
  type: 'dropdown'
  options: string[]
  selected: string
  id: number
}

export type PlaceholderSegment = {
  type: 'placeholder'
  hint: string
  value: string
  id: number
}

export type QuizDropdownSegment = {
  type: 'quiz'
  options: string[]
  selected: string
  answer: string
  id: number
  result?: 'correct' | 'incorrect' | null
}

export type QuizTextSegment = {
  type: 'quiz-text'
  hint: string
  value: string
  answer: string
  id: number
  result?: 'correct' | 'incorrect' | null
}

export type Segment = StaticSegment | DropdownSegment | PlaceholderSegment | QuizDropdownSegment | QuizTextSegment

export type ParseResult = {
  segments: Segment[]
  initialCode: string
  hasQuiz: boolean
}

export function parseGuidedTemplate(template: string): ParseResult {
  const segments: Segment[] = []
  let pos = 0
  let idCounter = 0
  let hasQuiz = false

  while (pos < template.length) {
    const start = template.indexOf('[[', pos)
    if (start === -1) {
      segments.push({ type: 'static', text: template.slice(pos) })
      break
    }

    if (start > pos) {
      segments.push({ type: 'static', text: template.slice(pos, start) })
    }

    const end = template.indexOf(']]', start)
    if (end === -1) {
      segments.push({ type: 'static', text: template.slice(pos) })
      break
    }

    const content = template.slice(start + 2, end)
    const colonIdx = content.indexOf(':')

    if (colonIdx === -1) {
      segments.push({ type: 'static', text: template.slice(start, end + 2) })
    } else {
      const keyword = content.slice(0, colonIdx).trim().toLowerCase()
      const payload = content.slice(colonIdx + 1)

      if (keyword === 'dropdown') {
        const options = payload.split('|').map(o => o.trim())
        segments.push({
          type: 'dropdown',
          options,
          selected: options[0] || '',
          id: idCounter++,
        })
      } else if (keyword === 'placeholder') {
        const parts = payload.split(':')
        const hint = parts[0] || ''
        const defaultValue = parts[1] || ''
        segments.push({
          type: 'placeholder',
          hint,
          value: defaultValue,
          id: idCounter++,
        })
      } else if (keyword === 'quiz') {
        const parts = payload.split('|').map(o => o.trim())
        const answerIdx = parts.findIndex(p => p.startsWith('answer:'))
        let answer = ''
        const options: string[] = []
        for (const p of parts) {
          if (p.startsWith('answer:')) {
            answer = p.slice(7).trim()
          } else {
            options.push(p)
          }
        }
        hasQuiz = true
        segments.push({
          type: 'quiz',
          options,
          selected: '',
          answer,
          id: idCounter++,
          result: null,
        })
      } else if (keyword === 'quiz-text') {
        const parts = payload.split(':')
        const hint = parts[0] || ''
        const answer = parts[1] || ''
        hasQuiz = true
        segments.push({
          type: 'quiz-text',
          hint,
          value: '',
          answer,
          id: idCounter++,
          result: null,
        })
      } else {
        segments.push({ type: 'static', text: template.slice(start, end + 2) })
      }
    }

    pos = end + 2
  }

  return { segments, initialCode: reconstructCode(segments), hasQuiz }
}

export function reconstructCode(segments: Segment[]): string {
  return segments.map(seg => {
    if (seg.type === 'static') return seg.text
    if (seg.type === 'dropdown') return seg.selected
    if (seg.type === 'placeholder') return seg.value
    if (seg.type === 'quiz') return seg.selected
    if (seg.type === 'quiz-text') return seg.value
    return ''
  }).join('')
}

export function checkQuiz(segments: Segment[]): { correct: number; total: number } {
  let correct = 0
  let total = 0
  for (const seg of segments) {
    if (seg.type === 'quiz') {
      total++
      if (seg.selected.trim().toLowerCase() === seg.answer.trim().toLowerCase()) {
        seg.result = 'correct'
        correct++
      } else {
        seg.result = 'incorrect'
      }
    } else if (seg.type === 'quiz-text') {
      total++
      if (seg.value.trim().toLowerCase() === seg.answer.trim().toLowerCase()) {
        seg.result = 'correct'
        correct++
      } else {
        seg.result = 'incorrect'
      }
    }
  }
  return { correct, total }
}
