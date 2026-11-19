import { restoreInlineLines, savedInlineLines } from '../rules_block/state_block.mjs'

export default function inline (state, positionOffset) {
  const tokens = state.tokens
  const blockState = state.blockState
  // line offsets of inline tokens that a rule overwrote after they were
  // pushed (see StateBlock#getLines)
  const saved = blockState ? savedInlineLines(blockState) : null

  // Parse inlines
  for (let i = 0, l = tokens.length; i < l; i++) {
    const tok = tokens[i]
    tok.position += positionOffset || 0

    if (tok.type === 'inline') {
      if (saved) restoreInlineLines(blockState, saved, tok)

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
