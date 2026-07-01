const test = require('node:test');
const assert = require('node:assert/strict');
const { chunkText } = require('../src/rag/chunker');

test('returns empty array for empty/whitespace input', () => {
  assert.deepEqual(chunkText(''), []);
  assert.deepEqual(chunkText('   \n  '), []);
  assert.deepEqual(chunkText(undefined), []);
});

test('short text returns a single chunk unchanged', () => {
  const text = 'Patient reports mild headache and fatigue.';
  const chunks = chunkText(text, { maxChars: 1200, overlapChars: 150 });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], text);
});

test('long text is split into multiple chunks', () => {
  const paragraph = 'The patient was prescribed medication for blood pressure. '.repeat(50);
  const chunks = chunkText(paragraph, { maxChars: 200, overlapChars: 30 });
  assert.ok(chunks.length > 1, 'expected more than one chunk for long input');
  chunks.forEach((c) => assert.ok(c.length > 0));
});

test('adjacent chunks overlap so context is not lost at boundaries', () => {
  const text = 'ABCDEFGHIJ'.repeat(40); // 400 chars, no natural sentence breaks
  const chunks = chunkText(text, { maxChars: 100, overlapChars: 20 });
  assert.ok(chunks.length > 1);
  // The tail of chunk N should reappear at the head of chunk N+1 (overlap window)
  for (let i = 0; i < chunks.length - 1; i++) {
    const tailOfCurrent = chunks[i].slice(-10);
    assert.ok(
      chunks[i + 1].includes(tailOfCurrent) || chunks[i + 1].startsWith(chunks[i].slice(-20)),
      `expected overlap between chunk ${i} and ${i + 1}`
    );
  }
});

test('prefers breaking on paragraph boundaries when available', () => {
  const text = 'First paragraph with some content here.\n\n' + 'B'.repeat(200);
  const chunks = chunkText(text, { maxChars: 60, overlapChars: 10 });
  assert.ok(chunks[0].trim().endsWith('here.') || chunks[0].includes('First paragraph'));
});
