// Syntax highlighter para Strudel/Mininotation

// Funciones comunes de Strudel
const FUNCTIONS = [
  'note', 'sound', 's', 'n', 'stack', 'sequence', 'cat', 'fastcat', 'slowcat',
  'polymeter', 'polyrhythm', 'rev', 'fast', 'slow', 'early', 'late',
  'every', 'when', 'sometimes', 'often', 'rarely', 'almostNever', 'almostAlways',
  'jux', 'juxBy', 'pan', 'gain', 'velocity', 'lpf', 'hpf', 'bpf', 'vowel',
  'delay', 'delaytime', 'delayfeedback', 'room', 'size', 'orbit',
  'speed', 'begin', 'end', 'cut', 'loop', 'loopAt',
  'crush', 'coarse', 'shape', 'distort',
  'attack', 'decay', 'sustain', 'release',
  'freq', 'midinote', 'octave', 'degree', 'scale',
  'struct', 'mask', 'euclid', 'euclidLegato',
  'ply', 'striate', 'chop', 'slice',
  'setcps', 'cps', 'samples', 'analyze',
]

// Métodos encadenados (después de .)
const METHODS = FUNCTIONS.map(f => '.' + f)

// Escape HTML para evitar XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Crear span con posición para tracking
function spanWithPos(cls: string, text: string, start: number, end: number): string {
  return `<span class="${cls}" data-start="${start}" data-end="${end}">${escapeHtml(text)}</span>`
}

// Tokenizar y colorear mininotation dentro de strings
// stringStart es la posición donde empieza el contenido del string (después de la comilla)
function highlightMininotation(content: string, stringStart: number): string {
  let result = ''
  let i = 0

  while (i < content.length) {
    const char = content[i]
    const pos = stringStart + i

    // Operadores estructurales
    if ('[]{}<>'.includes(char)) {
      result += spanWithPos('hl-bracket', char, pos, pos + 1)
      i++
    }
    // Operadores de repetición/división
    else if ('*/@!?'.includes(char)) {
      result += spanWithPos('hl-operator', char, pos, pos + 1)
      i++
    }
    // Silencio
    else if (char === '~') {
      result += spanWithPos('hl-rest', char, pos, pos + 1)
      i++
    }
    // Alternativa
    else if (char === '|') {
      result += spanWithPos('hl-alt', char, pos, pos + 1)
      i++
    }
    // Coma (separador)
    else if (char === ',') {
      result += spanWithPos('hl-comma', char, pos, pos + 1)
      i++
    }
    // Números dentro de mininotation
    else if (/[0-9]/.test(char)) {
      let num = ''
      const start = i
      while (i < content.length && /[0-9.]/.test(content[i])) {
        num += content[i]
        i++
      }
      result += spanWithPos('hl-number', num, stringStart + start, stringStart + i)
    }
    // Notas musicales (c4, d#5, eb3, etc.) o nombres de samples
    else if (/[a-zA-Z]/.test(char)) {
      let word = ''
      const start = i
      while (i < content.length && /[a-zA-Z0-9#_:-]/.test(content[i])) {
        word += content[i]
        i++
      }
      // Detectar si es una nota musical
      if (/^[a-gA-G][#b]?-?[0-9]$/.test(word)) {
        result += spanWithPos('hl-note', word, stringStart + start, stringStart + i)
      } else {
        // Sample name o palabra
        result += spanWithPos('hl-sample', word, stringStart + start, stringStart + i)
      }
    }
    // Espacios y otros caracteres
    else {
      result += escapeHtml(char)
      i++
    }
  }

  return result
}

// Tipo para tracking de strings
export type StringLocation = {
  start: number  // Posición de la comilla de apertura
  end: number    // Posición después de la comilla de cierre
  contentStart: number  // Posición del primer carácter del contenido
  contentEnd: number    // Posición después del último carácter del contenido
}

// Resultado del highlighting con metadata
export type HighlightResult = {
  html: string
  strings: StringLocation[]
}

// Tokenizar y colorear código Strudel completo
export function highlightStrudel(code: string): string {
  return highlightStrudelWithMeta(code).html
}

// Versión que retorna metadata de strings para mapping de posiciones
export function highlightStrudelWithMeta(code: string): HighlightResult {
  let result = ''
  let i = 0
  const strings: StringLocation[] = []

  while (i < code.length) {
    // Comentarios de línea
    if (code[i] === '/' && code[i + 1] === '/') {
      let comment = ''
      const start = i
      while (i < code.length && code[i] !== '\n') {
        comment += code[i]
        i++
      }
      result += spanWithPos('hl-comment', comment, start, i)
    }
    // Comentarios de bloque
    else if (code[i] === '/' && code[i + 1] === '*') {
      let comment = ''
      const start = i
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
        comment += code[i]
        i++
      }
      if (i < code.length) {
        comment += '*/'
        i += 2
      }
      result += spanWithPos('hl-comment', comment, start, i)
    }
    // Strings con comillas dobles (mininotation)
    else if (code[i] === '"') {
      const stringStart = i
      result += '<span class="hl-string">'
      result += escapeHtml('"')
      i++
      const contentStart = i
      let content = ''
      while (i < code.length && code[i] !== '"') {
        if (code[i] === '\\' && i + 1 < code.length) {
          content += code[i] + code[i + 1]
          i += 2
        } else {
          content += code[i]
          i++
        }
      }
      const contentEnd = i
      result += highlightMininotation(content, contentStart)
      if (i < code.length) {
        result += escapeHtml('"')
        i++ // closing quote
      }
      result += '</span>'
      strings.push({ start: stringStart, end: i, contentStart, contentEnd })
    }
    // Strings con comillas simples
    else if (code[i] === "'") {
      const stringStart = i
      result += '<span class="hl-string">'
      result += escapeHtml("'")
      i++
      const contentStart = i
      let content = ''
      while (i < code.length && code[i] !== "'") {
        if (code[i] === '\\' && i + 1 < code.length) {
          content += code[i] + code[i + 1]
          i += 2
        } else {
          content += code[i]
          i++
        }
      }
      const contentEnd = i
      result += highlightMininotation(content, contentStart)
      if (i < code.length) {
        result += escapeHtml("'")
        i++ // closing quote
      }
      result += '</span>'
      strings.push({ start: stringStart, end: i, contentStart, contentEnd })
    }
    // Template strings
    else if (code[i] === '`') {
      const start = i
      let str = '`'
      i++
      while (i < code.length && code[i] !== '`') {
        str += code[i]
        i++
      }
      if (i < code.length) {
        str += '`'
        i++
      }
      result += spanWithPos('hl-string', str, start, i)
    }
    // Números
    else if (/[0-9]/.test(code[i]) && (i === 0 || !/[a-zA-Z_]/.test(code[i - 1]))) {
      let num = ''
      const start = i
      while (i < code.length && /[0-9.]/.test(code[i])) {
        num += code[i]
        i++
      }
      result += spanWithPos('hl-number', num, start, i)
    }
    // Método encadenado (.algo)
    else if (code[i] === '.' && i + 1 < code.length && /[a-zA-Z]/.test(code[i + 1])) {
      let method = '.'
      const start = i
      i++
      while (i < code.length && /[a-zA-Z0-9_]/.test(code[i])) {
        method += code[i]
        i++
      }
      if (METHODS.includes(method)) {
        result += spanWithPos('hl-method', method, start, i)
      } else {
        result += escapeHtml(method)
      }
    }
    // Identificadores y funciones
    else if (/[a-zA-Z_$]/.test(code[i])) {
      let word = ''
      const start = i
      while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) {
        word += code[i]
        i++
      }
      if (FUNCTIONS.includes(word)) {
        result += spanWithPos('hl-function', word, start, i)
      } else if (word === 'true' || word === 'false' || word === 'null' || word === 'undefined') {
        result += spanWithPos('hl-keyword', word, start, i)
      } else {
        result += escapeHtml(word)
      }
    }
    // Paréntesis
    else if ('()'.includes(code[i])) {
      result += spanWithPos('hl-paren', code[i], i, i + 1)
      i++
    }
    // Operadores JS
    else if ('+-=><&|!'.includes(code[i])) {
      result += spanWithPos('hl-op', code[i], i, i + 1)
      i++
    }
    // Otros caracteres
    else {
      result += escapeHtml(code[i])
      i++
    }
  }

  return { html: result, strings }
}
