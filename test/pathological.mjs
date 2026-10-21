import needle from 'needle'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { Worker as JestWorker } from 'jest-worker'
import { readFileSync } from 'fs'

async function test_pattern (str) {
  const worker = new JestWorker(
    new URL('./pathological_worker.js', import.meta.url),
    {
      numWorkers: 1,
      enableWorkerThreads: true
    }
  )

  let result
  const ac = new AbortController()

  try {
    result = await Promise.race([
      worker.render(str),
      new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Terminated (timeout exceeded)')), 3000).unref()
      })
    ])
  } finally {
    ac.abort()
    await worker.end()
  }

  return result
}

describe('Pathological sequences speed', () => {
  it('Integrity check', async () => {
    assert.strictEqual(
      await test_pattern('foo'),
      '<p>foo</p>\n'
    )
  })

  // Ported from cmark, https://github.com/commonmark/cmark/blob/master/test/pathological_tests.py
  describe('Cmark', () => {
    // Watches upstream for new pathological patterns to port. It needs network
    // and fails whenever upstream edits the file, so it only runs when
    // CMARK_PATHOLOGICAL_CHECK=1 (scheduled CI), not in regular test runs.
    const checkUpstream = process.env.CMARK_PATHOLOGICAL_CHECK === '1';
    (checkUpstream ? it : it.skip)('verify original source crc (CMARK_PATHOLOGICAL_CHECK=1)', async () => {
      /* eslint-disable  max-len */
      const tracked = JSON.parse(readFileSync(new URL('./pathological.json', import.meta.url)))
      const src = await needle('get', 'https://raw.githubusercontent.com/commonmark/cmark/master/test/pathological_tests.py')
      const src_md5 = crypto.createHash('md5').update(src.body).digest('hex')

      assert.strictEqual(
        src_md5,
        tracked.md5,
        `cmark pathological tests changed since ${tracked.commit}: port new patterns from https://github.com/commonmark/cmark/compare/${tracked.commit}...master, then update pathological.json`
      )
    })

    it('nested inlines', async () => {
      await test_pattern('*'.repeat(60000) + 'a' + '*'.repeat(60000))
    })

    it('nested strong emph', async () => {
      await test_pattern('*a **a '.repeat(5000) + 'b' + ' a** a*'.repeat(5000))
    })

    it('many emph closers with no openers', async () => {
      await test_pattern('a_ '.repeat(30000))
    })

    it('many emph openers with no closers', async () => {
      await test_pattern('_a '.repeat(30000))
    })

    it('many link closers with no openers', async () => {
      await test_pattern('a]'.repeat(10000))
    })

    it('many link openers with no closers', async () => {
      await test_pattern('[a'.repeat(10000))
    })

    it('mismatched openers and closers', async () => {
      await test_pattern('*a_ '.repeat(50000))
    })

    it('commonmark/cmark#389', async () => {
      await test_pattern('*a '.repeat(20000) + '_a*_ '.repeat(20000))
    })

    it('openers and closers multiple of 3', async () => {
      await test_pattern('a**b' + ('c* '.repeat(50000)))
    })

    it('link openers and emph closers', async () => {
      await test_pattern('[ a_'.repeat(10000))
    })

    it('pattern [ (]( repeated', async () => {
      await test_pattern('[ (]('.repeat(40000))
    })

    it('pattern ![[]() repeated', async () => {
      await test_pattern('![[]()'.repeat(20000))
    })

    it('nested brackets', async () => {
      await test_pattern('['.repeat(20000) + 'a' + ']'.repeat(20000))
    })

    it('nested block quotes', async () => {
      await test_pattern('> '.repeat(50000) + 'a')
    })

    it('deeply nested lists', async () => {
      await test_pattern(Array(1000).fill(0).map(function (_, x) { return '  '.repeat(x) + '* a\n' }).join(''))
    })

    it('U+0000 in input', async () => {
      await test_pattern('abc\u0000de\u0000'.repeat(100000))
    })

    it('backticks', async () => {
      await test_pattern(Array(3000).fill(0).map(function (_, x) { return 'e' + '`'.repeat(x) }).join(''))
    })

    it('unclosed links A', async () => {
      await test_pattern('[a](<b'.repeat(30000))
    })

    it('unclosed links B', async () => {
      await test_pattern('[a](b'.repeat(30000))
    })

    it('unclosed <!--', async () => {
      await test_pattern('</' + '<!--'.repeat(100000))
    })

    it('empty lines in deeply nested lists', async () => {
      await test_pattern('- '.repeat(30000) + 'x' + '\n'.repeat(30000))
    })

    it('empty lines in deeply nested lists in blockquote', async () => {
      await test_pattern('> ' + '- '.repeat(30000) + 'x\n' + '>\n'.repeat(30000))
    })

    it('emph in deep blockquote', async () => {
      await test_pattern('>'.repeat(100000) + 'a*'.repeat(100000))
    })
  })

  describe('Markdown-it', () => {
    it('emphasis **_* pattern', async () => {
      await test_pattern('**_* '.repeat(50000))
    })

    it('backtick ``\\``\\`` pattern', async () => {
      await test_pattern('``\\'.repeat(50000))
    })

    it('autolinks <<<<...<<> pattern', async () => {
      await test_pattern('<'.repeat(400000) + '>')
    })

    it('hardbreak whitespaces pattern', async () => {
      await test_pattern('x' + ' '.repeat(150000) + 'x  \nx')
    })

    it('many code spans on one line', async () => {
      await test_pattern('` x` '.repeat(300000))
    })

    it('many images on one line', async () => {
      await test_pattern('![x](u) '.repeat(300000))
    })
  })
})
