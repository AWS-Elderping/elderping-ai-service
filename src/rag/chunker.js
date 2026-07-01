// chunker.js
// Splits extracted document text into overlapping character-window chunks
// suitable for embedding. Pure function, no AWS/DB dependency.

/**
 * @param {string} text
 * @param {{ maxChars?: number, overlapChars?: number }} [options]
 * @returns {string[]}
 */
function chunkText(text, { maxChars = 1200, overlapChars = 150 } = {}) {
  const normalized = (text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);

    if (end < normalized.length) {
      // Prefer to break on a paragraph or sentence boundary near the end of the window
      const window = normalized.slice(start, end);
      const paragraphBreak = window.lastIndexOf('\n\n');
      const sentenceBreak = Math.max(window.lastIndexOf('. '), window.lastIndexOf('.\n'));

      if (paragraphBreak > maxChars * 0.5) {
        end = start + paragraphBreak + 2;
      } else if (sentenceBreak > maxChars * 0.5) {
        end = start + sentenceBreak + 2;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}

module.exports = { chunkText };
