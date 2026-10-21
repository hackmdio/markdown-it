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
