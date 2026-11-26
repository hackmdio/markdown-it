// A core rule replacing this one must keep the block state on the core
// state, e.g.
//
//   state.blockState = state.md.block.parse(state.src, state.md, state.env, state.tokens) || null
//
// `utils.getLineOffset` and `utils.getLinePad` read the line offsets of
// containers (blockquotes, lists) from `state.blockState`: without it they
// silently return 0, and inline positions after the first line of a
// container are off (in `> a\n> b *c*`, `em_open` at 6 instead of 8).
export default function block (state) {
  let token

  if (state.inlineMode) {
    token          = new state.Token('inline', '', 0)
    token.content  = state.src
    token.map      = [0, 1]
    token.children = []
    state.tokens.push(token)
  } else {
    // kept on the core state: block rules may parse nested documents with
    // the same `env`, replacing `env.state_block`
    state.blockState = state.md.block.parse(state.src, state.md, state.env, state.tokens) || null
  }
}
