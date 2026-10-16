// Inline parser state

import Token from '../token.mjs'
import { isWhiteSpace, isPunctChar, isMdAsciiPunct, getLineOffset } from '../common/utils.mjs'

function StateInline (src, md, env, outTokens) {
  this.src = src
  this.env = env
  this.md = md
  this.tokens = outTokens
  this.tokens_meta = Array(outTokens.length)

  this.posStart = []
  this.pos = 0
  this.posMax = this.src.length
  this.level = 0
  this._pending = ''
  Object.defineProperty(this, 'pending', {
    get: function () { return this._pending },
    set: function (val) {
      if (this._pending.length === 0) {
        if (val.length > 0) { this.posStart.push(this.pos) }
      } else if (val.length === 0) {
        // pending text discarded without being flushed (e.g. by linkify)
        this.posStart.pop()
      }
      this._pending = val
    }
  })
  this.pendingLevel = 0
  this.startLine = env.parentToken && env.parentToken.map ? env.parentToken.map[0] : 0
  // Source line of `pos`, kept in sync by the inline parser
  this.currentLine = this.startLine
  this._newlines = null

  // Stores { start: end } pairs. Useful for backtrack
  // optimization of pairs parse (emphasis, strikes).
  this.cache = {}

  // List of emphasis-like delimiters for current tag
  this.delimiters = []

  // Stack of delimiter lists for upper level tags
  this._prev_delimiters = []

  // backtick length => last seen position
  this.backticks = {}
  this.backticksScanned = false

  // Counter used to disable inline linkify-it execution
  // inside <a> and markdown links
  this.linkLevel = 0
}

// Flush pending text
//
StateInline.prototype.pushPending = function () {
  const token = new Token('text', '', 0)
  token.content = this.pending
  token.level = this.pendingLevel
  // the text may span lines (without the newline rule); its range ends at its
  // last character, so a trailing newline does not include the next prefix
  const start = this.posStart.shift()
  const end = start + token.content.length - 1
  const startOffset = getLineOffset(this, this.lineAt(start))
  token.position = start + startOffset
  token.size = token.content.length + (end > start ? getLineOffset(this, this.lineAt(end)) - startOffset : 0)
  this.tokens.push(token)
  this._pending = ''
  return token
}

// Set `currentLine` to the source line of `pos`. Rules may consume several
// lines at once (code spans, html, link destinations) or re-tokenize a range
// (link labels), so the line is derived from `pos` instead of being counted.
//
StateInline.prototype.syncCurrentLine = function () {
  this.currentLine = this.lineAt(this.pos)
}

// Source line of the character at `pos`.
//
StateInline.prototype.lineAt = function (pos) {
  if (this._newlines === null) {
    this._newlines = []
    for (let i = this.src.indexOf('\n'); i !== -1; i = this.src.indexOf('\n', i + 1)) {
      this._newlines.push(i)
    }
  }

  // number of line breaks before `pos`
  const newlines = this._newlines
  let lo = 0
  let hi = newlines.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (newlines[mid] < pos) { lo = mid + 1 } else { hi = mid }
  }
  return this.startLine + lo
}

// Push new token to "stream".
// If pending text exists - flush it as text token
//
StateInline.prototype.push = function (type, tag, nesting) {
  if (this.pending) {
    this.pushPending()
  }

  const token = new Token(type, tag, nesting)
  let token_meta = null

  if (nesting < 0) {
    // closing tag
    this.level--
    this.delimiters = this._prev_delimiters.pop()
  }

  token.level = this.level

  if (nesting > 0) {
    // opening tag
    this.level++
    this._prev_delimiters.push(this.delimiters)
    this.delimiters = []
    token_meta = { delimiters: this.delimiters }
  }

  this.pendingLevel = this.level
  this.tokens.push(token)
  this.tokens_meta.push(token_meta)
  return token
}

// Scan a sequence of emphasis-like markers, and determine whether
// it can start an emphasis sequence or end an emphasis sequence.
//
//  - start - position to scan from (it should point at a valid marker);
//  - canSplitWord - determine if these markers can be found inside a word
//
StateInline.prototype.scanDelims = function (start, canSplitWord) {
  const max = this.posMax
  const marker = this.src.charCodeAt(start)

  // treat beginning of the line as a whitespace
  const lastChar = start > 0 ? this.src.charCodeAt(start - 1) : 0x20

  let pos = start
  while (pos < max && this.src.charCodeAt(pos) === marker) { pos++ }

  const count = pos - start

  // treat end of the line as a whitespace
  const nextChar = pos < max ? this.src.charCodeAt(pos) : 0x20

  const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar))
  const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar))

  const isLastWhiteSpace = isWhiteSpace(lastChar)
  const isNextWhiteSpace = isWhiteSpace(nextChar)

  const left_flanking =
    !isNextWhiteSpace && (!isNextPunctChar || isLastWhiteSpace || isLastPunctChar)
  const right_flanking =
    !isLastWhiteSpace && (!isLastPunctChar || isNextWhiteSpace || isNextPunctChar)

  const can_open  = left_flanking  && (canSplitWord || !right_flanking || isLastPunctChar)
  const can_close = right_flanking && (canSplitWord || !left_flanking  || isNextPunctChar)

  return { can_open, can_close, length: count }
}

// re-export Token class to use in block rules
StateInline.prototype.Token = Token

export default StateInline
