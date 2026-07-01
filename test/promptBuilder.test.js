const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRagPrompt, REFUSAL_MESSAGE, SYSTEM_PROMPT } = require('../src/rag/promptBuilder');

test('SYSTEM_PROMPT instructs the model to answer only from CONTEXT and refuse otherwise', () => {
  assert.ok(SYSTEM_PROMPT.includes('STRICTLY and ONLY'));
  assert.ok(SYSTEM_PROMPT.includes(REFUSAL_MESSAGE));
  assert.ok(SYSTEM_PROMPT.toLowerCase().includes('do not use any outside medical knowledge'));
});

test('buildRagPrompt interpolates the question and formatted context chunks', () => {
  const chunks = [
    { document_id: 42, chunk_index: 0, chunk_text: 'Blood pressure recorded at 130/85.' },
    { document_id: 42, chunk_index: 1, chunk_text: 'Prescribed Lisinopril 10mg daily.' }
  ];
  const prompt = buildRagPrompt('What is my blood pressure medication?', chunks);

  assert.ok(prompt.includes('What is my blood pressure medication?'));
  assert.ok(prompt.includes('[Document #42, chunk 0]: Blood pressure recorded at 130/85.'));
  assert.ok(prompt.includes('[Document #42, chunk 1]: Prescribed Lisinopril 10mg daily.'));
  assert.ok(prompt.includes('CONTEXT:'));
  assert.ok(prompt.includes('QUESTION:'));
});

test('buildRagPrompt with no chunks still produces a well-formed prompt (caller decides whether to skip the model call)', () => {
  const prompt = buildRagPrompt('Any question', []);
  assert.ok(prompt.includes('Any question'));
  assert.ok(prompt.includes('CONTEXT:'));
});
