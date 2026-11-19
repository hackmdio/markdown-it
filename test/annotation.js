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

  it('should position each emphasis marker of nested runs', function () {
    [
      '***x***',
      '****x****',
      '*a **b***',
      '_**x**_',
      '> a\n> ***b*** c',
      '- a\n  **_b_** ***c***'
    ].forEach(function (src) {
      md.parse(src, {}).forEach(function (token) {
        // markers are all alike, so also check that they do not overlap
        const covered = new Set()
        ;(token.children || []).forEach(function (child) {
          if (!/^(em|strong)_(open|close)$/.test(child.type)) { return }
          const label = JSON.stringify(src) + ' ' + child.type + '@' + child.position
          assert.strictEqual(child.size, child.markup.length, label)
          assert.strictEqual(src.substr(child.position, child.size), child.markup, label)
          for (let i = child.position; i < child.position + child.size; i++) {
            assert.isFalse(covered.has(i), label + ' overlaps at ' + i)
            covered.add(i)
          }
        })
      })
    })
  })

  it('should cover the whole source of a multi-line image', function () {
    [
      ['> ![a\n> b](x.png) c', '![a\n> b](x.png)'],
      ['> ![a](\n> x.png "t"\n> ) c', '![a](\n> x.png "t"\n> )'],
      ['- ![a\n  b](x.png)', '![a\n  b](x.png)'],
      ['![a\nb](x.png)', '![a\nb](x.png)']
    ].forEach(function ([src, image]) {
      const token = md.parse(src, {}).find(function (t) { return t.type === 'inline' })
        .children.find(function (t) { return t.type === 'image' })
      assert.strictEqual(src.substr(token.position, token.size), image, JSON.stringify(src))
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

  it('should use line offsets after a core rule replaces the token array', function () {
    const replacing = require('../')()
    replacing.core.ruler.before('inline', 'replace_tokens', function (state) {
      state.tokens = state.tokens.slice()
    })
    const src = '> a\n> b\n'
    const texts = replacing.parse(src, {}).find(function (t) { return t.type === 'inline' }).children
      .filter(function (t) { return t.type === 'text' })
    assert.deepStrictEqual(texts.map(function (t) { return sourceOf(src, t) }), ['a', 'b'])
  })

  it('should map inline content without env', function () {
    const src = '> a\n> *b*\n'
    const texts = md.parse(src).find(function (t) { return t.type === 'inline' }).children
      .filter(function (t) { return t.type === 'text' })
    assert.deepStrictEqual(texts.map(function (t) { return sourceOf(src, t) }), ['a', 'b'])
    const inline = md.parseInline('a *b*')[0].children.find(function (t) { return t.content === 'b' })
    assert.strictEqual(inline.position, 3)
  })

  it('should keep line offsets when a block rule parses a nested document with the same env', function () {
    const nesting = require('../')()
    nesting.block.ruler.before('paragraph', 'nested', function (state, startLine, endLine, silent) {
      const start = state.bMarks[startLine] + state.tShift[startLine]
      if (state.src.slice(start, start + 3) !== '%%%') return false
      if (silent) return true
      state.md.parse('> x\n> y\n', state.env)
      state.line = startLine + 1
      return true
    })
    const src = '%%%\n\n> a\n> *b*\n'
    const texts = nesting.parse(src, {}).find(function (t) { return t.type === 'inline' }).children
      .filter(function (t) { return t.type === 'text' })
    assert.deepStrictEqual(texts.map(function (t) { return sourceOf(src, t) }), ['a', 'b'])
  })

  it('should annotate hardbreaks with a backslash', function () {
    const src = '> a\\\n> b'
    const hardbreak = md.parse(src, {}).find(function (t) { return t.type === 'inline' }).children
      .find(function (t) { return t.type === 'hardbreak' })
    assertTokenContent(src, hardbreak, '\\\n')
  })

  const codeSources = [
    '```\nfoo\nbar\n```\n',
    '- a\n\n  ```\n  foo\n  bar\n  ```\n',
    '> ```\n> foo\n> bar\n> ```\n',
    '>```\n>foo\n>  bar\n>```\n',
    '> - a\n>\n>   ```\n>   foo\n>   ```\n',
    '- > ```\n  > foo\n  > ```\n',
    '> > ```\n> > foo\n> > ```\n',
    '    foo\n    bar\n',
    '    foo\n\n    bar\n',
    '>     foo\n>     bar\n',
    '- a\n\n      foo\n      bar\n',
    // tabs partially consumed by the indent
    '- a\n\n  ```\n\tfoo\n  ```\n',
    '- a\n\n  \t\tfoo\n',
    '- a\n\n  ```\n \t\tfoo\n\tbar\n  ```\n',
    '> - a\n>\n>   ```\n>\t\tfoo\n>   ```\n'
  ]

  function findCode (tokens) {
    return tokens.find(function (t) { return t.type === 'fence' || t.type === 'code_block' })
  }

  // Source offset of character `c` of line `k` of a fence / code_block token,
  // following the rule documented on `StateBlock#getLines`
  function codeSourceOffset (token, k, c) {
    const zwsp = token.meta.indentZwsp ? token.meta.indentZwsp[k] : 0
    const pad = token.meta.srcLinePads ? token.meta.srcLinePads[k] : 0
    const start = token.meta.srcLineStarts[k]
    const textStart = pad > 0 && zwsp === 0 ? start + 1 : start + zwsp
    if (c < zwsp) { return start + c }
    if (c < zwsp + pad) { return textStart - 1 }
    return textStart + c - zwsp - pad
  }

  // `srcLineStarts[k]` is where line `k` starts in the source: its first
  // character maps there, and it lies in the source line of the line text.
  function assertRealLineStarts (src, token, label) {
    const starts = token.meta.srcLineStarts
    token.content.split('\n').slice(0, starts.length).forEach(function (line, k) {
      const where = label + ' line ' + k
      const start = starts[k]
      assert.isAtLeast(start, 0, where)
      if (k > 0) { assert.isAbove(start, starts[k - 1], where + ': increasing') }
      if (line.length > 0) {
        assert.strictEqual(codeSourceOffset(token, k, 0), start, where + ': first character')
        const last = codeSourceOffset(token, k, line.length - 1)
        assert.notInclude(src.slice(start, last + 1), '\n', where + ': same source line')
      }
    })
  }

  // Checks every character of a code token against the source: U+200B stand
  // for stripped indent, padding spaces for a tab, other characters for themselves.
  function assertCodeMapsToSource (src, token, label) {
    const zwspCounts = token.meta.indentZwsp
    const pads = token.meta.srcLinePads
    token.content.split('\n').forEach(function (line, k) {
      const zwsp = zwspCounts ? zwspCounts[k] : 0
      const pad = pads ? pads[k] : 0
      // the U+200B stand for the `zwsp` source characters right before the line text
      const textStart = codeSourceOffset(token, k, zwsp + pad)
      for (let c = 0; c < line.length; c++) {
        const at = codeSourceOffset(token, k, c)
        const where = label + ' line ' + k + ' col ' + c
        if (c < zwsp) {
          assert.strictEqual(line[c], '\u200B', where)
          assert.strictEqual(at, textStart - zwsp + c, where + ': U+200B maps to the stripped indent')
          assert.match(src[at], /^[ \t]$/, where + ': U+200B maps to indent')
        } else if (c < zwsp + pad) {
          assert.strictEqual(line[c], ' ', where)
          assert.strictEqual(src[at], '\t', where + ': padding maps to the tab')
        } else {
          assert.strictEqual(src[at], line[c], where)
        }
      }
    })
    assertRealLineStarts(src, token, label)
  }

  it('should keep the code content of earlier versions by default', function () {
    // ZWSP stand for the stripped indent only, not container markers
    const Z = '\u200B';
    [
      ['> ```\n> foo\n> bar\n> ```\n', 'foo\nbar\n'],
      ['> - a\n>\n>   ```\n>   foo\n>   ```\n', Z.repeat(2) + 'foo\n'],
      ['- > ```\n  > foo\n  > ```\n', 'foo\n'],
      ['> > ```\n> > foo\n> > ```\n', 'foo\n'],
      ['    foo\n    bar\n', Z.repeat(4) + 'foo\n' + Z.repeat(4) + 'bar\n'],
      ['>     foo\n>     bar\n', Z.repeat(4) + 'foo\n' + Z.repeat(4) + 'bar\n'],
      ['- a\n\n      foo\n      bar\n', Z.repeat(6) + 'foo\n' + Z.repeat(6) + 'bar\n']
    ].forEach(function ([src, content]) {
      assert.strictEqual(findCode(md.parse(src, {})).content, content, JSON.stringify(src))
    })
  })

  it('should map lines of a code span across container prefixes', function () {
    [
      ['- first `code\n  spans word here` end\n', true],
      ['> first `` a\n> b `\n>  c word `` end\n', true],
      ['1. x `a\n   b`\n', true],
      ['- > a `x\n  > y word` z\n', true],
      ['> lazy `x\ny word` z\n', false],
      ['first `code\nspans word` end\n', false],
      ['first `code\n   spans word` end\n', false],
      // spaces added for partially consumed tabs stand for the tab
      ['- `a\n\tb`\n', true],
      ['- a `x\n\tb\n\tc` d\n', true],
      ['- `\n\tb `\n', true],
      ['- `\n\tb\n\tc `\n', true],
      ['> - `a\n>\tb`\n', true],
      // ending in the padding of its last line
      ['- ` a\n\t`\n', true],
      ['- ` a\n\tb\n\t`\n', true],
      ['- `\n\t`\n', true]
    ].forEach(function ([src, mapped]) {
      const tokens = require('../')().parse(src, {})
      const code = tokens.find(function (t) { return t.type === 'inline' }).children
        .find(function (t) { return t.type === 'code_inline' })
      assert.strictEqual(Boolean(code.meta), mapped, src)
      const starts = code.meta ? code.meta.contentLineStarts : []
      const offsets = code.meta ? code.meta.srcLineOffsets : []
      const pads = (code.meta && code.meta.srcLinePads) || []
      // every content char (newlines are rendered as spaces) maps back to the source
      for (let i = 0; i < code.content.length; i++) {
        let k = -1
        while (k + 1 < starts.length && starts[k + 1] <= i) k++
        if (k >= 0 && i - starts[k] < (pads[k] || 0)) {
          assert.strictEqual(src[code.position + offsets[k] + pads[k] - 1], '\t', `${JSON.stringify(src)} padding at ${i}`)
          continue
        }
        const at = k < 0 ? code.position + i : code.position + offsets[k] + i - starts[k]
        const ch = src[at] === '\n' ? ' ' : src[at]
        assert.strictEqual(ch, code.content[i], `${JSON.stringify(src)} at ${i}`)
      }
      const k = starts.length - 1
      const inPadding = k >= 0 && code.content.length - starts[k] < (pads[k] || 0)
      const last = k < 0
        ? code.position + code.content.length
        : code.position + offsets[k] + (inPadding ? pads[k] : code.content.length - starts[k])
      assert.strictEqual(code.position + code.size, last, src)
    })
  })

  function sourceOf (src, token) {
    return src.slice(token.position, token.position + token.size)
  }

  function inlineChildren (src) {
    return require('../')().parse(src, {}).find(function (t) { return t.type === 'inline' }).children
  }

  it('should map text after Unicode whitespace trimmed at the start of a block', function () {
    ['\u00a0Title\n---\n', '\u00a0para\n', '> \u00a0 para\n'].forEach(function (src) {
      const tokens = require('../')().parse(src, {})
      const inline = tokens.find(function (t) { return t.type === 'inline' })
      assert.strictEqual(sourceOf(src, inline), inline.content, JSON.stringify(src))
      assert.strictEqual(sourceOf(src, inline.children[0]), inline.children[0].content, JSON.stringify(src))
    })
  })

  it('should map text after whole lines of Unicode whitespace trimmed at the start of a block', function () {
    ['> \u00a0\n> a\n> b\n', '> \u00a0\n> a\n> b\n> ---\n', '- \u00a0\n  \u00a0\n  a *b*\n  c\n'].forEach(function (src) {
      const inline = require('../')().parse(src, {}).find(function (t) { return t.type === 'inline' })
      assert.strictEqual(src[inline.position], 'a', JSON.stringify(src))
      inline.children.filter(function (t) { return t.type === 'text' }).forEach(function (t) {
        assert.strictEqual(sourceOf(src, t), t.content, JSON.stringify(src) + ' ' + t.content)
      })
    })
  })

  it('should count line offsets from the block for an inline token moved to its next line', function () {
    // as plugins removing a first line of content do (GitHub alert titles)
    const md = require('../')()
    md.core.ruler.before('inline', 'drop_first_line', function (state) {
      const inline = state.tokens.find(function (t) { return t.type === 'inline' })
      const cut = inline.content.indexOf('\n') + 1
      inline.content = inline.content.slice(cut)
      inline.position += cut
      inline.map = [inline.map[0] + 1, inline.map[1]]
    })
    const src = '> title\n> a\n> b\n'
    const texts = md.parse(src, {}).find(function (t) { return t.type === 'inline' }).children
      .filter(function (t) { return t.type === 'text' })
    assert.deepStrictEqual(texts.map(function (t) { return sourceOf(src, t) }), ['a', 'b'])
  })

  it('should map pending text spanning lines from its first line', function () {
    [require('../')().disable('newline'), require('../')('zero').enable('blockquote')].forEach(function (md) {
      const src = '> a\n> b\n'
      const text = md.parse(src, {}).find(function (t) { return t.type === 'inline' }).children[0]
      assert.strictEqual(text.content, 'a\nb')
      assert.strictEqual(sourceOf(src, text), 'a\n> b')
    })
    // ending with a newline: not the prefix of the next line
    const src = '> a\n> `b`\n'
    const texts = require('../')().disable('newline').parse(src, {}).find(function (t) { return t.type === 'inline' }).children
    assert.strictEqual(texts[0].content, 'a\n')
    assert.strictEqual(sourceOf(src, texts[0]), 'a\n')
    // text left by an unmatched delimiter on the next line
    const delimited = '> a\n> *b\n'
    require('../')().disable('newline').parse(delimited, {}).find(function (t) { return t.type === 'inline' }).children.forEach(function (t) {
      assert.strictEqual(sourceOf(delimited, t), t.content, JSON.stringify(t.content))
    })
  })

  it('should map code spans starting or ending with a newline', function () {
    [
      ['> `\n> a `\n', 'a'], ['> ` a\n> `\n', 'a'], ['- `\n  a\n  b `\n', 'a\n  b'],
      ['> `a\n> `\n', 'a\n'], ['> `a\n> b\n> `\n', 'a\n> b\n'],
      // from the tab its padding stands for
      ['- `\n\tb `\n', '\tb'],
      // through the tab its padding stands for
      ['- ` a\n\t`\n', 'a\n\t'], ['- ` a\n\tb\n\t`\n', 'a\n\tb\n\t']
    ].forEach(function ([src, source]) {
      const code = inlineChildren(src).find(function (t) { return t.type === 'code_inline' })
      assert.strictEqual(sourceOf(src, code), source, JSON.stringify(src))
    })
  })

  it('should map strikethrough markers moved after closing tags', function () {
    ['~~x~~~ end\n', '~~a ~~b~~~~~ c\n'].forEach(function (src) {
      inlineChildren(src).forEach(function (t) {
        assert.strictEqual(sourceOf(src, t), t.type === 'text' ? t.content : t.markup, JSON.stringify(src) + ' ' + t.type)
      })
    })
  })

  it('should map lines of a code span whose last line has no offset', function () {
    // dropped indent (+2), then spaces added for partly consumed tabs (-1 each)
    const src = '- a `x\n  b\n\tc\n\td` e\n'
    const code = require('../')().parse(src, {}).find(function (t) { return t.type === 'inline' }).children
      .find(function (t) { return t.type === 'code_inline' })
    const starts = code.meta.contentLineStarts
    Array.from('xbcd').forEach(function (ch) {
      const i = code.content.indexOf(ch)
      let k = -1
      while (k + 1 < starts.length && starts[k + 1] <= i) k++
      const at = k < 0 ? code.position + i : code.position + code.meta.srcLineOffsets[k] + i - starts[k]
      assert.strictEqual(src[at], ch, ch)
    })
  })

  it('should record spaces added for a partially consumed tab', function () {
    [true, false].forEach(function (zwspIndent) {
      const src = '- a\n\n  \t\tfoo\n'
      const token = findCode(require('../')({ zwspIndent }).parse(src, {}))
      const zwsp = zwspIndent ? token.meta.indentZwsp[0] : 0
      const pad = token.meta.srcLinePads[0]
      assert.strictEqual(pad, 2)
      assert.strictEqual(token.content.slice(zwsp), '  foo\n')
      // the line starts at the stripped indent (U+200B) or at the tab (padding)
      const tab = src.indexOf('\t\tfoo') + 1
      assert.strictEqual(token.meta.srcLineStarts[0], zwspIndent ? src.indexOf('  \t\tfoo') : tab)
      assert.strictEqual(codeSourceOffset(token, 0, zwsp), tab)
      assert.strictEqual(codeSourceOffset(token, 0, zwsp + pad), src.indexOf('foo'))
    })
  })

  it('should start code lines with a partially consumed tab in their own source line', function () {
    [
      // used to be [-1] and [1]: before the source, and on the `>`
      ['>\t\tfoo\n', 1, 2],
      // used to be [9] and [10]: in the line of the opening fence
      ['- a\n\n  ```\n\tfoo\n  ```\n', 11, 11],
      // used to end in the newline of the previous code line
      ['- a\n\n  ```\n  x\n\tfoo\n  ```\n', 15, 15]
    ].forEach(function ([src, withZwsp, withoutZwsp]) {
      [[true, withZwsp], [false, withoutZwsp]].forEach(function ([zwspIndent, expected]) {
        const token = findCode(require('../')({ zwspIndent }).parse(src, {}))
        const starts = token.meta.srcLineStarts
        assert.strictEqual(starts[starts.length - 1], expected, JSON.stringify(src) + ' zwspIndent: ' + zwspIndent)
        assertCodeMapsToSource(src, token, JSON.stringify(src))
      })
    })
  })

  it('should record the ZWSP prepended to each code line', function () {
    const clean = require('../')({ zwspIndent: false })
    codeSources.concat(['- a\n\n  ```\n  \u200Buser zwsp\n  ```\n']).forEach(function (src) {
      const token = findCode(md.parse(src, {}))
      const lines = token.content.split('\n')
      const stripped = lines.map(function (line, k) {
        return k < token.meta.indentZwsp.length ? line.slice(token.meta.indentZwsp[k]) : line
      }).join('\n')
      assert.strictEqual(stripped, findCode(clean.parse(src, {})).content, JSON.stringify(src))
    })
  })

  it('should map code lines to source with srcLineStarts', function () {
    [true, false].forEach(function (zwspIndent) {
      const md2 = require('../')({ zwspIndent })
      codeSources.forEach(function (src) {
        const token = findCode(md2.parse(src, {}))
        if (!zwspIndent) { assert.notInclude(token.content, '\u200B') }
        assertCodeMapsToSource(src, token, JSON.stringify(src))
      })
    })
  })

  it('should map U+200B on a line with a partially consumed tab to the stripped indent', function () {
    const src = '- a\n\n  ```\n\tfoo\n  ```\n'
    const token = findCode(require('../')().parse(src, {}))
    assert.strictEqual(token.content, '\u200B  foo\n')
    assert.deepStrictEqual(token.meta.indentZwsp, [1])
    assert.deepStrictEqual(token.meta.srcLinePads, [2])
    const tab = src.indexOf('\tfoo')
    // the U+200B and both padding spaces stand for the tab
    assert.strictEqual(codeSourceOffset(token, 0, 0), tab)
    assert.strictEqual(codeSourceOffset(token, 0, 1), tab)
    assert.strictEqual(codeSourceOffset(token, 0, 2), tab)
    assert.strictEqual(codeSourceOffset(token, 0, 3), tab + 1)
  })

  it('should map every character of generated code blocks to the source', function () {
    let seed = 42
    function rnd (n) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return (seed >>> 16) % n
    }
    function pick (list) { return list[rnd(list.length)] }
    const indents = ['', ' ', '  ', '   ', '    ', '\t', ' \t', '  \t', '\t\t', ' \t\t', '\u200B', '  \u200B']
    const texts = ['x', 'a b', '\tc', '> q', '- l', '\u200Bz', '']
    const mds = [require('../')(), require('../')({ zwspIndent: false })]

    for (let n = 0; n < 400; n++) {
      const lines = []
      for (let i = rnd(4) + 1; i > 0; i--) lines.push(pick(indents) + pick(texts))
      let block
      if (rnd(3) === 0) {
        block = lines.map(function (line) { return pick(['    ', '\t', '     ', '  \t']) + line })
      } else {
        const fenceIndent = pick(['', ' ', '  ', '   '])
        block = [fenceIndent + '```'].concat(lines, [fenceIndent + '```'])
      }
      const container = pick([
        { first: '', rest: '' }, { first: '> ', rest: '> ' }, { first: '>', rest: '>' },
        { first: '- ', rest: '  ' }, { first: '- ', rest: '\t' }, { first: '1. ', rest: '   ' },
        { first: '> - ', rest: '>   ' }, { first: '- > ', rest: '  > ' }
      ])
      const src = ['p', ''].concat(block).map(function (line, i) {
        return (i === 0 ? container.first : container.rest) + line
      }).join('\n') + '\n'

      mds.forEach(function (md) {
        md.parse(src, {}).forEach(function (token) {
          if (token.type === 'fence' || token.type === 'code_block') {
            assertCodeMapsToSource(src, token, JSON.stringify(src))
          }
        })
      })
    }
  })
})

describe('Annotation with rules calling getLines again', function () {
  const fs = require('fs')
  const path = require('path')
  const markdownit = require('../')

  // Looks back over the lines before each block, e.g. to find what it follows,
  // and gives up: the lines belong to inline tokens pushed before.
  function lookBack (md) {
    md.block.ruler.before('table', 'look_back', function (state, startLine, endLine, silent) {
      if (!silent && startLine > 0) {
        state.getLines(Math.max(0, startLine - 3), startLine, 0, false)
      }
      return false
    })
  }

  // Looks ahead over the next lines with another indent, and gives up.
  function lookAhead (md) {
    md.block.ruler.before('table', 'look_ahead', function (state, startLine, endLine, silent) {
      if (!silent) state.getLines(startLine, Math.min(endLine, startLine + 3), state.blkIndent + 1, true)
      return false
    })
  }

  // Reads the line before each block together with the first line of the
  // block, and gives up: the first line keeps values counted from the line before.
  function lookAround (md) {
    md.block.ruler.before('paragraph', 'look_around', function (state, startLine, endLine, silent) {
      if (!silent && startLine > 0) state.getLines(startLine - 1, startLine + 1, 0, false)
      return false
    })
  }

  // Reads the lines of its paragraph again after pushing its tokens.
  function reread (md) {
    const rule = md.block.ruler.__rules__.find(function (r) { return r.name === 'paragraph' })
    const paragraph = rule.fn
    md.block.ruler.at('paragraph', function (state, startLine, endLine, silent) {
      const line = state.line
      if (!paragraph(state, startLine, endLine, silent)) return false
      state.getLines(startLine + 1, state.line, 0, true)
      state.getLines(line, state.line, state.blkIndent + 2, false)
      return true
    }, { alt: rule.alt })
  }

  // Pushes an inline token, then sets its content from `getLines` (as
  // markdown-it-deflist does for terms): `? term` lines.
  function term (md) {
    md.block.ruler.before('paragraph', 'term', function (state, startLine, endLine, silent) {
      const pos = state.bMarks[startLine] + state.tShift[startLine]
      if (state.src.charCodeAt(pos) !== 0x3F/* ? */ || state.src.charCodeAt(pos + 1) !== 0x20) return false
      if (silent) return true
      state.push('term_open', 'dt', 1).map = [startLine, startLine + 1]
      const token = state.push('inline', '', 0)
      token.map = [startLine, startLine]
      token.content = state.getLines(startLine, startLine + 1, state.blkIndent, false).trim()
      token.position = pos
      token.size = token.content.length
      token.children = []
      state.push('term_close', 'dt', -1)
      state.line = startLine + 1
      return true
    })
  }

  // `lineOffsets` of each inline token, read from the block state during
  // inline parsing (as plugins of hackmd-production do).
  function recordOffsets (md, record) {
    md.inline.ruler.before('text', 'record_offsets', function (state, silent) {
      if (!silent) {
        record.push(state.currentLine + ':' + state.env.state_block.lineOffsets[state.currentLine] +
          ':' + md.utils.getLineOffset(state) + ':' + md.utils.getLinePad(state, state.currentLine))
      }
      return false
    })
  }

  function positions (tokens) {
    const out = []
    tokens.forEach(function (token) {
      out.push(token.type + '@' + token.position + '+' + token.size)
      if (token.children) {
        token.children.forEach(function (child) {
          out.push('  ' + child.type + '@' + child.position + '+' + child.size)
        })
      }
    })
    return out
  }

  function textMapsToSource (src, tokens) {
    tokens.forEach(function (token) {
      if (token.type !== 'inline') return
      token.children.forEach(function (child) {
        if (child.type === 'text' && child.content) {
          assert.strictEqual(src.slice(child.position, child.position + child.size), child.content, JSON.stringify(src))
        }
      })
    })
  }

  const containerSources = [
    '> a\n> b *c*\n\nnext',
    '- a\n  b *c*\n\nnext',
    '> > a\n> > b\n> > *c*\n\nnext',
    '1. a\n   b\n   **c** d\n2. e\n   f *g*\n',
    '> - a\n>   b *c*\n> - d\n>   e\n',
    '- > a\n  > b *c*\n  > d\n',
    '> a\n> b\n> ===\n>\n> c\n> d *e*\n',
    '>\ta\n>\tb *c*\n\n-\ta\n\tb *c*\n',
    '> ? a *b*\n> c\n> d *e*\n> ? f *g*\n',
    '- ? a *b*\n  c *d*\n\n  ? e\n',
    '> a\n>\n> ? b *c*\n> ? d\n'
  ]

  it('should keep inline positions when a rule probes lines of earlier inline tokens', function () {
    const plain = markdownit()
    const probed = markdownit().use(lookBack)
    containerSources.forEach(function (src) {
      textMapsToSource(src, probed.parse(src, {}))
      assert.deepStrictEqual(positions(probed.parse(src, {})), positions(plain.parse(src, {})), JSON.stringify(src))
    })
    // the first example of DEV-3364
    const tokens = probed.parse('> a\n> b *c*\n\nnext', {})
    assert.deepStrictEqual(tokens[2].children.map(function (t) { return t.content + '@' + t.position }),
      ['a@2', '@3', 'b @6', '@8', 'c@9', '@10'])
  })

  it('should keep inline positions when a rule reads its own lines again', function () {
    const plain = markdownit()
    const probed = markdownit().use(reread)
    containerSources.forEach(function (src) {
      assert.deepStrictEqual(positions(probed.parse(src, {})), positions(plain.parse(src, {})), JSON.stringify(src))
    })
  })

  it('should keep the offsets of an inline token whose content comes from getLines after it is pushed', function () {
    const plain = markdownit().use(term)
    const probed = markdownit().use(lookAround).use(term).use(lookAhead).use(lookBack)
    containerSources.forEach(function (src) {
      textMapsToSource(src, probed.parse(src, {}))
      assert.deepStrictEqual(positions(probed.parse(src, {})), positions(plain.parse(src, {})), JSON.stringify(src))
    })
  })

  it('should hold the offsets of the inline token being parsed in lineOffsets', function () {
    containerSources.forEach(function (src) {
      const expected = []
      const actual = []
      markdownit().use(recordOffsets, expected).parse(src, {})
      markdownit().use(lookBack).use(reread).use(recordOffsets, actual).parse(src, {})
      assert.deepStrictEqual(actual, expected, JSON.stringify(src))
    })
  })

  it('should not change positions or HTML of the fixtures when rules probe lines', function () {
    const dir = path.join(__dirname, 'fixtures')
    const files = []
    fs.readdirSync(dir).forEach(function (sub) {
      fs.readdirSync(path.join(dir, sub)).forEach(function (name) { files.push(path.join(dir, sub, name)) })
    })
    const options = { html: true, linkify: true, typographer: true }
    const plain = markdownit(options).use(term)
    const probed = markdownit(options).use(term).use(lookBack).use(reread)
    let count = 0
    files.forEach(function (file) {
      const text = fs.readFileSync(file, 'utf8')
      // whole files, and each part between `.` lines (fixture examples)
      text.split(/^\.$/m).concat([text]).forEach(function (src) {
        // each sample on its own, and nested in containers
        [src, src.replace(/^/mg, '> '), src.replace(/^/mg, '  ').replace(/^ {2}/, '- ')].forEach(function (sample) {
          const plainTokens = plain.parse(sample, {})
          const probedTokens = probed.parse(sample, {})
          assert.deepStrictEqual(positions(probedTokens), positions(plainTokens), JSON.stringify(sample.slice(0, 200)))
          assert.strictEqual(probed.renderer.render(probedTokens, probed.options, {}),
            plain.renderer.render(plainTokens, plain.options, {}))
          count++
        })
      })
    })
    assert.isAbove(count, 3000)
  })

  // Not covered: values written before a token is pushed. A rule that builds
  // inline tokens without calling getLines (tables) maps them through what
  // the arrays hold for their lines, e.g. the values of a rule that probed
  // them before. Probe with getLine, bMarks and eMarks instead.
  it('should still map table cells through values written by probes before the table (documented trap)', function () {
    const src = '> a\n>\n> | h | i |\n> |---|---|\n> | x | y |\n'
    function cells (md) {
      return md.parse(src, {}).filter(function (t) { return t.type === 'inline' }).slice(1).map(function (t) {
        const text = t.children[0]
        return src.slice(text.position, text.position + text.size)
      })
    }
    assert.deepStrictEqual(cells(markdownit()), ['h', 'i', 'x', 'y'])
    assert.notDeepEqual(cells(markdownit().use(lookAhead)), ['h', 'i', 'x', 'y'])
  })
})
