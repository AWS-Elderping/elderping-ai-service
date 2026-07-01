// retriever.js
// pgvector similarity search against document_embeddings, scoped to a
// specific elder so one patient's chatbot never sees another's documents.

/**
 * @param {import('pg').Pool} pool
 * @param {string|number} elderId
 * @param {number[]} questionEmbedding
 * @param {number} [topK]
 * @returns {Promise<{ chunk_text: string, document_id: number, distance: number }[]>}
 */
async function retrieveContext(pool, elderId, questionEmbedding, topK = 5) {
  const vectorLiteral = `[${questionEmbedding.join(',')}]`;

  const result = await pool.query(
    `SELECT chunk_text, chunk_index, document_id, embedding <=> $1::vector AS distance
     FROM document_embeddings
     WHERE elder_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorLiteral, elderId, topK]
  );

  return result.rows;
}

module.exports = { retrieveContext };
