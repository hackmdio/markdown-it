'use strict'
// Implemented originally in https://github.com/markdown-it/markdown-it/pull/204

const assert = require('chai').assert

function assertTokenContent (src, token, content) {
  assert.strictEqual(src.slice(token.position, token.position + token.size), content)
}

describe('Annotation', function () {
  const md = require('../')({
    html: true,
    langPrefix: '',
    typographer: false,
    linkify: false
  })

  it('should annotate paragraph', function () {
    const tokens = md.parse('Hello World\n\nThis is great !')
    assert.strictEqual(tokens.length, 6)

    // First paragraph
    assert.strictEqual(tokens[0].position, 0)
    assert.strictEqual(tokens[0].size, 0)
    assert.strictEqual(tokens[1].position, 0)
    assert.strictEqual(tokens[1].size, 11)
    assert.strictEqual(tokens[2].position, 11)
    assert.strictEqual(tokens[2].size, 0)

    // Second paragraph
    assert.strictEqual(tokens[3].position, 13)
    assert.strictEqual(tokens[3].size, 0)
    assert.strictEqual(tokens[4].position, 13)
    assert.strictEqual(tokens[4].size, 15)
    assert.strictEqual(tokens[5].position, 28)
    assert.strictEqual(tokens[5].size, 0)
  })

  it('should annotate headings', function () {
    const tokens = md.parse('# Hello\n\n## World ##\n')
    assert.strictEqual(tokens.length, 6)

    // First heading
    assert.strictEqual(tokens[0].position, 0)
    assert.strictEqual(tokens[0].size, 1)
    assert.strictEqual(tokens[1].position, 2)
    assert.strictEqual(tokens[1].size, 6)
    assert.strictEqual(tokens[2].position, 7)
    assert.strictEqual(tokens[2].size, 0)

    // Second heading
    assert.strictEqual(tokens[3].position, 9)
    assert.strictEqual(tokens[3].size, 2)
    assert.strictEqual(tokens[4].position, 12)
    assert.strictEqual(tokens[4].size, 7)
    assert.strictEqual(tokens[5].position, 18)
    assert.strictEqual(tokens[5].size, 2)
  })

  it('should annotate lheadings', function () {
    const src = 'Hello\n=====\n\nWorld\n======='
    const tokens = md.parse(src)
    assert.strictEqual(tokens.length, 6)

    // First heading
    assert.strictEqual(tokens[0].position, 0)
    assertTokenContent(src, tokens[0], '')
    assertTokenContent(src, tokens[1], 'Hello')
    assertTokenContent(src, tokens[2], '=====\n')

    // Second heading
    assert.strictEqual(tokens[3].position, 13)
    assert.strictEqual(tokens[3].size, 0)
    assertTokenContent(src, tokens[4], 'World')
    assertTokenContent(src, tokens[5], '=======')
  })

  it('should annotate code blocks', function () {
    const tokens = md.parse('\tHello\n\tWorld\n\nt\n\n\tBlock 2\n')
    assert.strictEqual(tokens.length, 5)

    assert.strictEqual(tokens[0].position, 0)
    assert.strictEqual(tokens[0].size, 14)

    assert.strictEqual(tokens[4].position, 18)
    assert.strictEqual(tokens[4].size, 9)
  })

  it('should annotate tables', function () {
    const src = 'Test:\n\n' +
              ' | Type | Message |\n' +
              ' | ---- | ------- |\n' +
              '| Hello | World\n' +
              ' | Bonjour | Monde |\n'
    const tokens = md.parse(src)
    assert.strictEqual(tokens.length, 33)

    // Begin
    assert.strictEqual(tokens[3].position, 7)
    assert.strictEqual(tokens[3].size, 0)

    // head (open)
    assert.strictEqual(tokens[4].position, 7)
    assert.strictEqual(tokens[4].size, 0)

    // head -> TR (open)
    assert.strictEqual(tokens[5].position, 7)
    assert.strictEqual(tokens[5].size, 0)

    // head -> columns
    assertTokenContent(src, tokens[6], '|')
    assertTokenContent(src, tokens[7], 'Type')
    assertTokenContent(src, tokens[8], '')
    assertTokenContent(src, tokens[9], '|')
    assertTokenContent(src, tokens[10], 'Message')
    assertTokenContent(src, tokens[11], '|')

    // head -> TR (close)
    assert.strictEqual(tokens[12].position, 26)
    assert.strictEqual(tokens[12].size, 0)

    // head (close)
    assertTokenContent(src, tokens[13], ' | ---- | ------- |')

    // body (open)
    assert.strictEqual(tokens[14].position, 47)
    assert.strictEqual(tokens[14].size, 0)

    // body -> rows
    assertTokenContent(src, tokens[16], '|')
    assertTokenContent(src, tokens[17], 'Hello')
    assertTokenContent(src, tokens[18], '')
    assertTokenContent(src, tokens[19], '|')
    assertTokenContent(src, tokens[20], 'World')
    assertTokenContent(src, tokens[21], '\n')

    assertTokenContent(src, tokens[24], '|')
    assertTokenContent(src, tokens[25], 'Bonjour')
    assertTokenContent(src, tokens[26], '')
    assertTokenContent(src, tokens[27], '|')
    assertTokenContent(src, tokens[28], 'Monde')
    assertTokenContent(src, tokens[29], '|')
  })

  function assertTextTokens (src) {
    let count = 0
    md.parse(src, {}).forEach(function (token) {
      (token.children || []).forEach(function (child) {
        if (child.type !== 'text' || !child.content) { return }
        count++
        assertTokenContent(src, child, child.content)
      })
    })
    assert.isAbove(count, 0)
  }

  it('should annotate inline text inside containers', function () {
    [
      '>a\n> b\n> c\n',
      '> a\nb *c*\n',
      '> a\n>\n> b\n> c\n',
      '> a\n>\n>\n> b\n> c\n',
      '> # h\n> b\n> c\n',
      '> a\n>\n> # h\n',
      '> a\n> b\n> ---\n',
      '> > a\n> > b\n> > c\n',
      '> a\n>\n> > b\n> > c\n',
      '- > a\n  > b\n',
      '> - a\n>   b\n> - c\n',
      '- a\n  b\n  c\n',
      '- a\nb\n',
      '1. a\n   b\n',
      '- a\n  b\n  ---\n',
      '> | a | b |\n> | - | - |\n> | c | d |\n',
      '>\ta\n>\tb\n',
      '> a\n> b\n\n> c\n> d\n'
    ].forEach(assertTextTokens)
  })

  it('should annotate inline tokens on every line of a container', function () {
    const mdLinkify = require('../')({ linkify: true, html: true })
    const markers = { em_open: '*', strong_open: '**', s_open: '~~', image: '![', link_open: '<' }
    const lines = 'first\nsecond *em* `code` ~~del~~ ![alt](x.png) <https://x.com> https://y.com end'
    const sources = [
      lines,
      lines.split('\n').map((l, i) => (i ? '  ' : '- ') + l).join('\n'),
      lines.split('\n').map((l) => '> ' + l).join('\n'),
      '> a `code\n> span` b\n> c',
      'see\nhttps://x.com after',
      '**a** \nb c'
    ]
    sources.forEach(function (src) {
      mdLinkify.parse(src, {}).forEach(function (token) {
        (token.children || []).forEach(function (child) {
          if ((child.type === 'text' || child.type === 'code_inline') && child.content && !/\n/.test(src.substr(child.position, child.size))) {
            assertTokenContent(src, child, child.content)
          }
          const marker = markers[child.type]
          if (marker && (child.type !== 'link_open' || child.markup === 'autolink')) {
            assert.strictEqual(src.substr(child.position, marker.length), marker, JSON.stringify(src) + ' ' + child.type)
          }
        })
      })
    })
  })

  it('should annotate text after a failed inline rule', function () {
    ['a\n[x] b', '**a**[b]', '[ ] a b'].forEach(function (src) {
      md.parse(src, {}).forEach(function (token) {
        (token.children || []).forEach(function (child) {
          if (child.type === 'text' && child.content) { assertTokenContent(src, child, child.content) }
        })
      })
    })
  })

  it('should keep escapes and entities as separate positioned tokens', function () {
    const src = '- a\n  b \\* c &amp; d'
    const children = md.parse(src, {})[3].children.filter(function (t) { return t.type === 'text' })
    const escape = children.find(function (t) { return t.content === '*' })
    const entity = children.find(function (t) { return t.content === '&' })
    assertTokenContent(src, escape, '\\*')
    assertTokenContent(src, entity, '&amp;')
    assertTokenContent(src, children[children.length - 1], ' d')
  })

  it('should annotate table cells after an escaped pipe', function () {
    const src = '| a \\| b | c |\n| - | - |\n| d | e |'
    const cell = md.parse(src, {}).find(function (t) { return t.type === 'inline' && t.content === 'c' })
    assertTokenContent(src, cell, 'c')
  })

  it('should not use line offsets from another document', function () {
    const env = {}
    md.parse('> a\n> b\n> c\n', env)
    const tokens = md.parseInline('x\ny\nz', env)[0].children
    assert.strictEqual(tokens[4].content, 'z')
    assert.strictEqual(tokens[4].position, 4)
  })
})
