// Parser state class

import Token from '../token.mjs'
import { isSpace } from '../common/utils.mjs'

function StateBlock (src, md, env, tokens) {
  this.src = src

  // link to parser instance
  this.md     = md

  this.env = env
  if (env) {
    env.state_block = this
  } else {
    this.env = { state_block: this }
  }

  //
  // Internal state vartiables
  //

  this.tokens = tokens

  this.bMarks = []  // line begin offsets for fast jumps
  this.eMarks = []  // line end offsets for fast jumps
  this.tShift = []  // offsets of the first non-space characters (tabs not expanded)
  this.sCount = []  // indents for each line (tabs expanded)
  this.lineOffsets = []
  // spaces added by `getLines` at the start of each line for a partially consumed tab
  this.linePads = []
  // `lineOffsets` and `linePads` of inline tokens, saved before `getLines`
  // overwrites them (see `getLines`): number of tokens checked, end of the
  // lines of the inline tokens among them, and inline token -> saved values
  this._inlineScanned = 0
  this._inlineLineEnd = 0
  this._inlineSaved = null

  // An amount of virtual spaces (tabs expanded) between beginning
  // of each line (bMarks) and real beginning of that line.
  //
  // It exists only as a hack because blockquotes override bMarks
  // losing information in the process.
  //
  // It's used only when expanding tabs, you can think about it as
  // an initial tab length, e.g. bsCount=21 applied to string `\t123`
  // means first tab should be expanded to 4-21%4 === 3 spaces.
  //
  this.bsCount = []

  // block parser variables

  // required block content indent (for example, if we are
  // inside a list, it would be positioned after list marker)
  this.blkIndent  = 0
  this.line       = 0 // line index in src
  this.lineMax    = 0 // lines count
  this.tight      = false  // loose/tight mode for lists
  this.ddIndent   = -1 // indent of the current dd block (-1 if there isn't any)
  this.listIndent = -1 // indent of the current list block (-1 if there isn't any)

  // can be 'blockquote', 'list', 'root', 'paragraph' or 'reference'
  // used in lists to determine if they interrupt a paragraph
  this.parentType = 'root'

  this.level = 0

  // Create caches
  // Generate markers.
  const s = this.src

  for (let start = 0, pos = 0, indent = 0, offset = 0, len = s.length, indent_found = false; pos < len; pos++) {
    const ch = s.charCodeAt(pos)

    if (!indent_found) {
      if (isSpace(ch)) {
        indent++

        if (ch === 0x09) {
          offset += 4 - offset % 4
        } else {
          offset++
        }
        continue
      } else {
        indent_found = true
      }
    }

    if (ch === 0x0A || pos === len - 1) {
      if (ch !== 0x0A) { pos++ }
      this.bMarks.push(start)
      this.eMarks.push(pos)
      this.tShift.push(indent)
      this.sCount.push(offset)
      this.bsCount.push(0)
      this.lineOffsets.push(null)

      indent_found = false
      indent = 0
      offset = 0
      start = pos + 1
    }
  }

  // Push fake entry to simplify cache bounds checks
  this.bMarks.push(s.length)
  this.eMarks.push(s.length)
  this.tShift.push(0)
  this.sCount.push(0)
  this.bsCount.push(0)
  this.lineOffsets.push(null)

  this.lineMax = this.bMarks.length - 1 // don't count last fake line
}

// Push new token to "stream".
//
StateBlock.prototype.push = function (type, tag, nesting) {
  const token = new Token(type, tag, nesting)
  token.block = true

  if (nesting < 0) this.level-- // closing tag
  token.level = this.level
  if (nesting > 0) this.level++ // opening tag

  this.tokens.push(token)
  return token
}

StateBlock.prototype.isEmpty = function isEmpty (line) {
  return this.bMarks[line] + this.tShift[line] >= this.eMarks[line]
}

StateBlock.prototype.skipEmptyLines = function skipEmptyLines (from) {
  for (let max = this.lineMax; from < max; from++) {
    if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
      break
    }
  }
  return from
}

// Skip spaces from given position.
StateBlock.prototype.skipSpaces = function skipSpaces (pos) {
  for (let max = this.src.length; pos < max; pos++) {
    const ch = this.src.charCodeAt(pos)
    if (!isSpace(ch)) { break }
  }
  return pos
}

// Skip spaces from given position in reverse.
StateBlock.prototype.skipSpacesBack = function skipSpacesBack (pos, min) {
  if (pos <= min) { return pos }

  while (pos > min) {
    if (!isSpace(this.src.charCodeAt(--pos))) { return pos + 1 }
  }
  return pos
}

// Skip char codes from given position
StateBlock.prototype.skipChars = function skipChars (pos, code) {
  for (let max = this.src.length; pos < max; pos++) {
    if (this.src.charCodeAt(pos) !== code) { break }
  }
  return pos
}

// Skip char codes reverse from given position - 1
StateBlock.prototype.skipCharsBack = function skipCharsBack (pos, code, min) {
  if (pos <= min) { return pos }

  while (pos > min) {
    if (code !== this.src.charCodeAt(--pos)) { return pos + 1 }
  }
  return pos
}

function inlineLineEnd (map) {
  return map[1] > map[0] ? map[1] : map[0] + 1
}

function saveTokenLines (state, token) {
  const first = token.map[0]
  const last = inlineLineEnd(token.map)
  const offsets = new Array(last - first)
  const pads = new Array(last - first)
  for (let line = first; line < last; line++) {
    offsets[line - first] = state.lineOffsets[line]
    pads[line - first] = state.linePads[line]
  }
  if (!state._inlineSaved) state._inlineSaved = new Map()
  state._inlineSaved.set(token, { begin: first, offsets, pads })
}

// Before `getLines` overwrites `[begin, end)`: save the values of the lines of
// inline tokens pushed earlier (see `getLines`). Rules read lines after the
// ones of the tokens pushed so far, unless they probe: other calls only check
// the tokens pushed since the last call.
function saveInlineLines (state, begin, end) {
  const tokens = state.tokens
  if (!tokens) return

  let i = Math.min(state._inlineScanned, tokens.length)
  let lineEnd = state._inlineLineEnd
  for (; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type !== 'inline' || !token.map) continue
    // still being built: its content may come from the call being made
    // (e.g. definition list terms), and the values are its own
    if (token.content === '' && i === tokens.length - 1) break
    const last = inlineLineEnd(token.map)
    if (last > lineEnd) lineEnd = last
  }
  state._inlineScanned = i
  state._inlineLineEnd = lineEnd
  if (begin >= lineEnd) return

  // inline tokens are pushed in source order: look back from the last one
  // until a token ends before `begin`
  for (let k = i - 1; k >= 0; k--) {
    const token = tokens[k]
    if (token.type !== 'inline' || !token.map) continue
    if (inlineLineEnd(token.map) <= begin) break
    if (token.map[0] >= end) continue
    if (state._inlineSaved && state._inlineSaved.has(token)) continue
    saveTokenLines(state, token)
  }
}

// The saved `lineOffsets` and `linePads` of the inline tokens of block state
// `state` whose lines a `getLines` call overwrote after they were pushed:
// a map for `restoreInlineLines`, or null if there are none.
export function savedInlineLines (state) {
  return state._inlineSaved || null
}

// Write back the values of inline token `token` saved in `saved` (from
// `savedInlineLines`), if any.
export function restoreInlineLines (state, saved, token) {
  const values = saved.get(token)
  if (!values) return
  for (let k = 0; k < values.offsets.length; k++) {
    state.lineOffsets[values.begin + k] = values.offsets[k]
    state.linePads[values.begin + k] = values.pads[k]
  }
}

const ZWSP = '\u200B' // zero width space
// cut lines range from source.
//
// Also records `lineOffsets[line]`: the number of source characters dropped
// before `line`, counted from `begin` (container markers such as `> `,
// stripped indent, minus spaces added when expanding tabs), and `linePads`.
// Every call overwrites them for `[begin, end)`, and `trimmedContentStart`
// rebases them in place. Inline parsing runs after the whole block parse and
// maps the content of each `inline` token through these arrays: before a call
// overwrites lines of an `inline` token pushed earlier (e.g. a rule probing
// lines it does not use), the values of that token are saved, and the core
// `inline` rule writes them back before parsing it. So the arrays hold the
// offsets of the inline token being parsed, whatever rules ran in between.
// An `inline` token is covered once a later `getLines` call starts, for the
// lines of its `map` (`[map[0], map[1])`, or line `map[0]` when `map[1]` is
// not greater): a rule may still change the values of its own token's lines
// (e.g. with `trimmedContentStart`) until then. The last token, if `inline`
// with empty content, is covered by the call after: its content may come from
// this call (e.g. definition list terms, pushed before their `getLines`).
// Values written before a token is pushed are not covered: a rule that builds
// inline tokens without calling `getLines` for their lines (e.g. tables) maps
// them through whatever the arrays hold, including the values of a rule that
// probed these lines before. To probe lines, use `getLine`, `bMarks` and
// `eMarks`, which do not touch the arrays.
//
// - replaceIndentSpaceWithZWSP: prefix each line with one U+200B per stripped
//   indent character (not container markers such as `> `).
// - lineInfo: optional `{ srcLineStarts, zwsp, pads }` arrays, receiving for
//   each returned line `k`:
//   - srcLineStarts: source offset of the first character of the line (its
//     first U+200B, padding space or text character), so the starts are
//     increasing and each lies in its own source line,
//   - zwsp: number of U+200B prepended,
//   - pads: number of spaces added for a partially consumed tab.
//
//   Line `k` is `zwsp[k]` U+200B, then `pads[k]` spaces, then the line text.
//   With `s = srcLineStarts[k]`, `z = zwsp[k]` and `p = pads[k]`, the line
//   text starts in the source at `t = s + 1` when `p > 0` and `z` is 0, else
//   at `t = s + z`, and the source offset of character `c` depends on its part:
//   - U+200B (`c < z`): `s + c`, the stripped indent character it stands for
//     (the last one is the partially consumed tab, if any),
//   - padding (`c < z + p`): the tab, at `t - 1`,
//   - line text: `t + c - z - p`.
//   Without a partially consumed tab (`p` is 0), every character maps to
//   `s + c`.
StateBlock.prototype.getLines = function getLines (begin, end, indent, keepLastLF, replaceIndentSpaceWithZWSP, lineInfo) {
  replaceIndentSpaceWithZWSP = replaceIndentSpaceWithZWSP || false

  if (begin >= end) {
    return ''
  }

  saveInlineLines(this, begin, end)

  const queue = new Array(end - begin)
  let dropped = 0

  for (let i = 0, line = begin; line < end; line++, i++) {
    let lineIndent = 0
    const lineStart = this.bMarks[line]
    // bMarks may have been moved past container markers (blockquotes)
    const srcLineStart = line > 0 ? this.eMarks[line - 1] + 1 : 0
    let first = lineStart
    let last

    if (line + 1 < end || keepLastLF) {
      // No need for bounds check because we have fake entry on tail.
      last = this.eMarks[line] + 1
    } else {
      last = this.eMarks[line]
    }

    while (first < last && lineIndent < indent) {
      const ch = this.src.charCodeAt(first)

      if (isSpace(ch)) {
        if (ch === 0x09) {
          lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4
        } else {
          lineIndent++
        }
      } else if (first - lineStart < this.tShift[line]) {
        // patched tShift masked characters to look like spaces (blockquotes, list markers)
        lineIndent++
      } else {
        break
      }

      first++
    }

    let pad = 0
    if (lineIndent > indent) {
      // partially expanding tabs in code blocks, e.g '\t\tfoobar'
      // with indent=2 becomes '  \tfoobar'
      pad = lineIndent - indent
      queue[i] = ' '.repeat(pad) + this.src.slice(first, last)
    } else {
      queue[i] = this.src.slice(first, last)
    }

    const lineDropped = first - srcLineStart - pad
    if (i > 0) {
      dropped += lineDropped
      this.lineOffsets[line] = dropped
    } else {
      this.lineOffsets[line] = 0
    }

    // as before source mapping: the stripped indent, not container markers,
    // so the default output is unchanged
    let zwsp = 0
    if (replaceIndentSpaceWithZWSP && first > lineStart) {
      zwsp = first - lineStart
      queue[i] = ZWSP.repeat(zwsp) + queue[i]
    }

    this.linePads[line] = pad

    if (lineInfo) {
      // with padding but no U+200B the line starts with the spaces, which
      // stand for the tab consumed last, right before `first`
      lineInfo.srcLineStarts.push(pad > 0 && zwsp === 0 ? first - 1 : first - zwsp)
      lineInfo.zwsp.push(zwsp)
      lineInfo.pads.push(pad)
    }

    // Ensure a trailing LF when requested even if source lacks one
    if (keepLastLF && !queue[i].endsWith('\n')) {
      queue[i] += '\n'
    }
  }

  return queue.join('')
}

// `token.meta` for code tokens from `getLines` line info
StateBlock.prototype.codeLineMeta = function codeLineMeta (lineInfo, zwspIndent) {
  const meta = { srcLineStarts: lineInfo.srcLineStarts }
  if (zwspIndent) { meta.indentZwsp = lineInfo.zwsp }
  if (lineInfo.pads.some(function (pad) { return pad > 0 })) { meta.srcLinePads = lineInfo.pads }
  return meta
}

// re-export Token class to use in block rules
StateBlock.prototype.Token = Token

export default StateBlock
