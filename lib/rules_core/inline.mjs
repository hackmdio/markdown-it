// `positionOffset` (optional) is added to the position of every token, e.g.
// the length of a front matter stripped from the source before parsing. The
// absolute source offsets in `meta` (`srcLineStarts` of `fence` and
// `code_block` tokens) are shifted with it; offsets relative to
// `token.position` (`srcLineOffsets` of `code_inline`) need no change.
export default function inline (state, positionOffset) {
  const tokens = state.tokens

  // Parse inlines
  for (let i = 0, l = tokens.length; i < l; i++) {
    const tok = tokens[i]
    tok.position += positionOffset || 0
    if (positionOffset) {
      const lineStarts = tok.meta && tok.meta.srcLineStarts
      if (lineStarts) {
        for (let k = 0; k < lineStarts.length; k++) lineStarts[k] += positionOffset
      }
    }

    if (tok.type === 'inline') {
      state.md.inline.parse(
        tok.content,
        state.md,
        Object.assign(
          {},
          state.env,
          { parentToken: tok, parentState: state, parentTokenIndex: i }
        ),
        tok.children
      )

      // Update position of all children to be absolute
      for (let child = 0; child < tok.children.length; child++) {
        tok.children[child].position += tok.position
      }
    }
  }
}
