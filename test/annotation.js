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
    // no trailing `|`: the close token sits at the end of the cell
    assert.strictEqual(tokens[21].position, src.indexOf('World') + 5)
    assertTokenContent(src, tokens[21], '')

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

  // One string per cell of each row: 'open position/size inline position
  // close position/size L<inline map[0]>'
  function tableCells (src) {
    const rows = []
    let row
    const tokens = md.parse(src, {})
    tokens.forEach(function (t, i) {
      if (t.type === 'tr_open') { row = []; rows.push(row) }
      if (t.type === 'th_open' || t.type === 'td_open') {
        const inline = tokens[i + 1]
        const close = tokens[i + 2]
        assert.strictEqual(inline.size, inline.content.length)
        assert.strictEqual(inline.map[1], inline.map[0] + 1)
        row.push(t.position + '/' + t.size + ' ' + inline.position + ' ' +
          close.position + '/' + close.size + ' L' + inline.map[0])
      }
    })
    return rows
  }

  it('should annotate table cells of rows without a leading or trailing pipe', function () {
    // no leading `|`: the first open token sits at the start of the cell (size 0);
    // no trailing `|`: the last close token sits at the end of the cell (size 0)
    assert.deepStrictEqual(tableCells('a | b\n--|--\nc | d\n'), [
      ['0/0 0 2/0 L0', '2/1 4 5/0 L0'],
      ['12/0 12 14/0 L2', '14/1 16 17/0 L2']
    ])
    assert.deepStrictEqual(tableCells('e | f |\n--|--|\ng | h |\n'), [
      ['0/0 0 2/0 L0', '2/1 4 6/1 L0'],
      ['15/0 15 17/0 L2', '17/1 19 21/1 L2']
    ])
    assert.deepStrictEqual(tableCells('| i | j\n|---|---\n| k | l\n'), [
      ['0/1 2 4/0 L0', '4/1 6 7/0 L0'],
      ['17/1 19 21/0 L2', '21/1 23 24/0 L2']
    ])
    // a body row without a leading `|` between rows with one
    assert.deepStrictEqual(tableCells('| m | n |\n|---|---|\no | p |\n| q | r |\n'), [
      ['0/1 2 4/0 L0', '4/1 6 8/1 L0'],
      ['20/0 20 22/0 L2', '22/1 24 26/1 L2'],
      ['28/1 30 32/0 L3', '32/1 34 36/1 L3']
    ])
    assert.deepStrictEqual(tableCells('  w | x\n  --|--\n  y | z\n'), [
      ['2/0 2 4/0 L0', '4/1 6 7/0 L0'],
      ['18/0 18 20/0 L2', '20/1 22 23/0 L2']
    ])
    assert.deepStrictEqual(tableCells('> A | B\n> --|--\n> C | D\n'), [
      ['2/0 2 4/0 L0', '4/1 6 7/0 L0'],
      ['18/0 18 20/0 L2', '20/1 22 23/0 L2']
    ])
    // control: leading and trailing `|`
    assert.deepStrictEqual(tableCells('| E | F |\n|---|---|\n| G | H |\n'), [
      ['0/1 2 4/0 L0', '4/1 6 8/1 L0'],
      ['20/1 22 24/0 L2', '24/1 26 28/1 L2']
    ])
  })

  it('should annotate autocompleted table cells at the end of the line', function () {
    // the last real cell keeps the trailing `|`
    assert.deepStrictEqual(tableCells('| s | t | u |\n|---|---|---|\n| v |\n'), [
      ['0/1 2 4/0 L0', '4/1 6 8/0 L0', '8/1 10 12/1 L0'],
      ['28/1 30 32/1 L2', '33/0 33 33/0 L2', '33/0 33 33/0 L2']
    ])
    // trailing spaces after the `|`
    assert.deepStrictEqual(tableCells('a | b  \n--|-- \nc |  \n'), [
      ['0/0 0 2/0 L0', '2/1 4 5/0 L0'],
      ['15/0 15 17/1 L2', '20/0 20 20/0 L2']
    ])
  })

  it('should annotate table cells in edge cases', function () {
    // one column
    assert.deepStrictEqual(tableCells('| a\n|--\n| b\n'), [['0/1 2 3/0 L0'], ['8/1 10 11/0 L2']])
    assert.deepStrictEqual(tableCells('a |\n--|\nb |\n'), [['0/0 0 2/1 L0'], ['8/0 8 10/1 L2']])
    // empty cells, and a row with only a `|`
    assert.deepStrictEqual(tableCells('| | b |\n|-|-|\na ||\n|\n'), [
      ['0/1 2 2/0 L0', '2/1 4 6/1 L0'],
      ['14/0 14 16/0 L2', '16/1 17 17/1 L2'],
      ['20/0 20 20/0 L3', '20/0 20 20/0 L3']
    ])
    // tab indentation in a list item
    assert.deepStrictEqual(tableCells('- x\n\n\ta | b\n\t--|--\n\tc | d\n'), [
      ['6/0 6 8/0 L2', '8/1 10 11/0 L2'],
      ['20/0 20 22/0 L4', '22/1 24 25/0 L4']
    ])
    // lists
    assert.deepStrictEqual(tableCells('- x\n\n  a | b\n  --|--\n  c\n'), [
      ['7/0 7 9/0 L2', '9/1 11 12/0 L2'],
      ['23/0 23 24/0 L4', '24/0 24 24/0 L4']
    ])
    assert.deepStrictEqual(tableCells('> - x\n>\n>   a | b |\n>   --|--|\n>   c\n'), [
      ['12/0 12 14/0 L2', '14/1 16 18/1 L2'],
      ['35/0 35 36/0 L4', '36/0 36 36/0 L4']
    ])
    // header without a leading `|`, body with one
    assert.deepStrictEqual(tableCells('a | b\n--|--\n| c | d |\n'), [
      ['0/0 0 2/0 L0', '2/1 4 5/0 L0'],
      ['12/1 14 16/0 L2', '16/1 18 20/1 L2']
    ])
    // escaped pipes, also at the end of a row
    assert.deepStrictEqual(tableCells('a \\| x | b\n--|--\nc | d \\|\n'), [
      ['0/0 0 7/0 L0', '7/1 9 10/0 L0'],
      ['17/0 17 19/0 L2', '19/1 21 25/0 L2']
    ])
    // Unicode whitespace before the row, removed by trim() but not by tShift
    assert.deepStrictEqual(tableCells('\u00a0| a | b |\n|---|---|\n\u00a0c | d\n'), [
      ['1/1 3 5/0 L0', '5/1 7 9/1 L0'],
      ['22/0 22 24/0 L2', '24/1 26 27/0 L2']
    ])
  })

  it('should keep every table cell within its row', function () {
    let seed = 7
    function rnd (n) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return (seed >>> 16) % n
    }
    function pick (list) { return list[rnd(list.length)] }
    const words = ['a', 'bb', '*c*', '`d`', 'e\\|f', '**g** h', '[i](j)', '&amp;', '']
    // `head` opens the container before the table (a list item needs other
    // content first, or its first line is read as a top-level table row)
    const containers = [
      { head: '', rest: '' }, { head: '', rest: '  ' }, { head: '', rest: '> ' },
      { head: '- x\n\n', rest: '  ' }, { head: '1. x\n\n', rest: '   ' }, { head: '> - x\n>\n', rest: '>   ' }
    ]
    let rowCount = 0

    for (let n = 0; n < 500; n++) {
      const columnCount = rnd(4) + 1
      const container = pick(containers)
      let src = (rnd(3) === 0 ? 'p\n\n' : '') + container.head
      const rows = []

      // Adds a row of `count` cells, and records where the text of each cell
      // starts in the source (its end for an empty cell)
      function addRow (count, delimiter) {
        let lead = rnd(2) === 0
        let trail = rnd(2) === 0
        const cells = []
        for (let c = 0; c < count; c++) {
          if (delimiter) {
            cells.push({ before: '', word: pick(['---', ':--', '--:', ':-:']), after: '' })
          } else {
            cells.push({ before: ' '.repeat(rnd(3)), word: pick(words), after: ' '.repeat(rnd(3)) })
          }
        }
        // without a `|`, an empty first or last cell would be trimmed away
        if (!cells[0].word) lead = true
        if (!cells[count - 1].word) trail = true
        if (count === 1 && !lead && !trail) lead = true
        // spaces before the first cell would indent the row (as code past 3)
        if (!lead) cells[0].before = ''

        let line = container.rest + (!delimiter && rnd(8) === 0 ? ' ' : '') + (lead ? '|' : '')
        const starts = []
        cells.forEach(function (cell, c) {
          if (c > 0) line += '|'
          const start = src.length + line.length
          starts.push(cell.word ? start + cell.before.length : start + cell.before.length + cell.after.length)
          line += cell.before + cell.word + cell.after
        })
        if (trail) line += '|'
        line += ' '.repeat(rnd(2))
        rows.push({ line: src.split('\n').length - 1, start: src.length, end: src.length + line.length, starts })
        src += line + '\n'
      }

      addRow(columnCount)
      addRow(columnCount, true)
      for (let b = rnd(4); b > 0; b--) addRow(rnd(columnCount) + 1)
      rows.splice(1, 1)

      const tokens = md.parse(src, {})
      const tableRows = []
      tokens.forEach(function (t, i) {
        if (t.type === 'tr_open') tableRows.push([])
        if (t.type === 'th_open' || t.type === 'td_open') tableRows[tableRows.length - 1].push(tokens.slice(i, i + 3))
      })
      assert.strictEqual(tableRows.length, rows.length, JSON.stringify(src))

      tableRows.forEach(function (cells, r) {
        const row = rows[r]
        rowCount++
        cells.forEach(function (cell, c) {
          const where = JSON.stringify(src) + ' row ' + r + ' cell ' + c
          const inline = cell[1]
          // the first character of the trimmed cell, or the end of the line
          // for an autocompleted cell
          assert.strictEqual(inline.position, c < row.starts.length ? row.starts[c] : row.end, where)
          if (inline.content) assert.strictEqual(src[inline.position], inline.content[0], where)
          assert.deepStrictEqual(inline.map, [row.line, row.line + 1], where)
          cell.forEach(function (t) {
            assert.isAtLeast(t.position, row.start, where)
            assert.isAtMost(t.position + t.size, row.end, where)
            if (t.type !== 'inline' && t.size === 1) assert.strictEqual(src[t.position], '|', where)
          })
        })
      })
    }
    assert.isAbove(rowCount, 1000)
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
