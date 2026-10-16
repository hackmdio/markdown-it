// Parse backticks

import { getLineOffset } from '../common/utils.mjs'

// When a code span crosses lines whose container prefix (`> `, list indent)
// was dropped, record where each content line starts in the source:
// `meta.contentLineStarts[k]` (content index) maps to
// `token.position + meta.srcLineOffsets[k]`. `line` is the line of
// `contentStart`, with offset `lineOffset`.
function addCodeInlineLines (state, token, contentStart, line, lineOffset) {
  const contentLineStarts = []
  const srcLineOffsets = []
  const contentEnd = contentStart + token.content.length
  let delta = 0
  // deltas may decrease (spaces added for a partly consumed tab), so a line
  // may need mapping even if the last one does not
  let shifted = false
  for (let nl = state.src.indexOf('\n', contentStart); nl !== -1 && nl < contentEnd; nl = state.src.indexOf('\n', nl + 1)) {
    line++
    delta = getLineOffset(state, line) - lineOffset
    if (delta !== 0) shifted = true
    const index = nl + 1 - contentStart
    contentLineStarts.push(index)
    srcLineOffsets.push(index + delta)
  }
  if (!shifted) return
  token.meta = { contentLineStarts, srcLineOffsets }
  token.size = token.content.length + delta
}

export default function backtick (state, silent) {
  let pos = state.pos
  const ch = state.src.charCodeAt(pos)

  if (ch !== 0x60/* ` */) { return false }

  const start = pos
  pos++
  const max = state.posMax

  // scan marker length
  while (pos < max && state.src.charCodeAt(pos) === 0x60/* ` */) { pos++ }

  const marker = state.src.slice(start, pos)
  const openerLength = marker.length

  if (state.backticksScanned && (state.backticks[openerLength] || 0) <= start) {
    if (!silent) state.pending += marker
    state.pos += openerLength
    return true
  }

  let matchEnd = pos
  let matchStart

  // Nothing found in the cache, scan until the end of the line (or until marker is found)
  while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
    matchEnd = matchStart + 1

    // scan marker length
    while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60/* ` */) { matchEnd++ }

    const closerLength = matchEnd - matchStart

    if (closerLength === openerLength) {
      // Found matching closer length.
      if (!silent) {
        const token = state.push('code_inline', 'code', 0)
        const body = state.src.slice(pos, matchStart)
        const raw = body.replace(/\n/g, ' ')
        token.markup = marker
        token.content = raw.replace(/^ (.+) $/, '$1')
        const contentStart = pos + (raw.length - token.content.length) / 2
        // the line of the content: a stripped leading newline starts it on the next one
        let line = state.currentLine
        for (let nl = state.src.indexOf('\n', pos); nl !== -1 && nl < contentStart; nl = state.src.indexOf('\n', nl + 1)) { line++ }
        const lineOffset = getLineOffset(state, line)
        token.position = contentStart + lineOffset
        token.size = token.content.length
        if (raw !== body) {
          addCodeInlineLines(state, token, contentStart, line, lineOffset)
        }
      }
      state.pos = matchEnd
      return true
    }

    // Some different length found, put it in cache as upper limit of where closer can be found
    state.backticks[closerLength] = matchStart
  }

  // Scanned through the end, didn't find anything
  state.backticksScanned = true

  if (!silent) state.pending += marker
  state.pos += openerLength
  return true
}
