const test = require('node:test');
const assert = require('node:assert/strict');
const { retrieveContext } = require('../src/rag/retriever');

function makeFakePool(rows) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows };
    }
  };
}

test('retrieveContext scopes the query to elder_id and uses the pgvector <=> operator', async () => {
  const fakeRows = [{ chunk_text: 'some text', document_id: 1, chunk_index: 0, distance: 0.1 }];
  const pool = makeFakePool(fakeRows);
  const embedding = [0.1, 0.2, 0.3];

  const result = await retrieveContext(pool, 'elder-7', embedding, 5);

  assert.equal(pool.calls.length, 1);
  const { sql, params } = pool.calls[0];
  assert.ok(sql.includes('elder_id = $2'), 'must filter by elder_id');
  assert.ok(sql.includes('<=>'), 'must use pgvector cosine distance operator');
  assert.ok(sql.includes('LIMIT $3'), 'must respect topK limit param');
  assert.equal(params[1], 'elder-7');
  assert.equal(params[2], 5);
  assert.deepEqual(result, fakeRows);
});

test('retrieveContext serializes the embedding as a Postgres vector literal', async () => {
  const pool = makeFakePool([]);
  await retrieveContext(pool, 'elder-1', [1, 2, 3], 3);
  const { params } = pool.calls[0];
  assert.equal(params[0], '[1,2,3]');
});

test('retrieveContext defaults topK to 5 when not provided', async () => {
  const pool = makeFakePool([]);
  await retrieveContext(pool, 'elder-1', [1, 2, 3]);
  const { params } = pool.calls[0];
  assert.equal(params[2], 5);
});
