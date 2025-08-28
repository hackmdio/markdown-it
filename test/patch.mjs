export function stripZeroWidthSpaces (md) {
  const originalRender = md.render.bind(md)

  md.render = (src, env) => {
    const result = originalRender(src, env)
    return result.replace(/\u200b/g, '')
  }
}
