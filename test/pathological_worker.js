'use strict'

exports.render = async (str) => {
  return (await import('../index.mjs')).default().render(str)
}

// Milliseconds to render `str`, best of `runs`.
exports.time = async (str, runs) => {
  const md = (await import('../index.mjs')).default()
  let best = Infinity
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    md.render(str)
    best = Math.min(best, performance.now() - start)
  }
  return best
}
