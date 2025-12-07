import assert from 'assert'
import { transformMarkdownTo } from '../src/parse/markdownTo.js'

// Test 1: paragraph with multiple kbd tags
{
  const md = 'Use <kbd>Ctrl</kbd>+<kbd>C</kbd>'
  const res = transformMarkdownTo(md)
  assert(res && Array.isArray(res.children) && res.children.length === 1, 'Expected one top-level node')
  const text = res.children[0].data.text
  assert.strictEqual(text, 'Use Ctrl+C')
}

// Test 2: heading with kbd
{
  const md = '# Press <kbd>Enter</kbd>'
  const res = transformMarkdownTo(md)
  assert(res && res.children.length >= 1, 'Expected heading node')
  const text = res.children[0].data.text
  assert.strictEqual(text, 'Press Enter')
}

// Test 3: math block conversion $$...$$ -> $...$
{
  const md = 'Math block: $$x = y$$ end'
  const res = transformMarkdownTo(md)
  const text = res.children[0].data.text
  assert.strictEqual(text, 'Math block: $x = y$ end')
}

console.log('All tests passed')
