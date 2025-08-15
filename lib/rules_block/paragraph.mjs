// Paragraph

export default function paragraph (state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules('paragraph')
  const pos = state.bMarks[startLine]
  const oldParentType = state.parentType
  let nextLine = startLine + 1
  state.parentType = 'paragraph'

  // jump line-by-line until empty one or EOF
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.sCount[nextLine] - state.blkIndent > 3) { continue }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.sCount[nextLine] < 0) { continue }

    // Some tags can terminate paragraph without empty line.
    let terminate = false
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true
        break
      }
    }
    if (terminate) { break }
  }

  const content = state.getLines(startLine, nextLine, state.blkIndent, false).trim()

  state.line = nextLine

  const token_o    = state.push('paragraph_open', 'p', 1)
  token_o.map      = [startLine, state.line]
  token_o.position = pos
  token_o.size     = 0

  const token_i    = state.push('inline', '', 0)
  token_i.content  = content
  token_i.map      = [startLine, state.line]
  token_i.children = []
  token_i.position = pos + state.tShift[startLine]
  token_i.size     = content.length

  const token_c    = state.push('paragraph_close', 'p', -1)
  token_c.size     = 0
  token_c.position = content.length + pos + state.tShift[startLine]

  state.parentType = oldParentType

  return true
}
