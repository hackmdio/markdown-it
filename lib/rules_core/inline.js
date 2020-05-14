'use strict';

module.exports = function inline(state, positionOffset) {
  var tokens = state.tokens, tok, i, l;

  // Parse inlines
  for (i = 0, l = tokens.length; i < l; i++) {
    tok = tokens[i];
    tok.position += positionOffset || 0;

    if (tok.type === 'inline') {
      state.md.inline.parse(tok.content, state.md,
        Object.assign(
          {},
          state.env,
          { parentToken: tok, parentState: state, parentTokenIndex: i }
        ),
        tok.children);

      // Update position of all children to be absolute
      for (var child = 0; child < tok.children.length; child++) {
        tok.children[child].position += tok.position;
      }
    }
  }
};
