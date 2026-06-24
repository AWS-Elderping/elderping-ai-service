const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { validateToken, checkRelationship, requirePermission } = require('./authMiddleware');
const providerRegistry = require('./providers/providerRegistry');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Liveness probe (must be before path-rewrite middleware)
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'ai-service' }));
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok', service: 'ai-service' }));
app.get('/ready', (req, res) => res.status(200).json({ status: 'ok', service: 'ai-service' }));

// K8s ALB path prefix compatibility: strip /api/ai prefix
app.use((req, _res, next) => {
  if (req.url.startsWith('/api/ai')) {
    req.url = req.url.replace('/api/ai', '') || '/';
  }
  next();
});

// Helper to invoke provider via registry
async function generateAIResponse(prompt, capability, modelId) {
  const provider = providerRegistry.getProvider();
  return await provider.generateResponse(prompt, capability, modelId);
}

// GET /ai/provider-status
app.get('/ai/provider-status', validateToken, requirePermission('AI_READ'), async (req, res) => {
  try {
    const provider = providerRegistry.getProvider();
    const status = await provider.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// General AI queries (Q&A, symptom checks, medication, risk assessment)
app.post('/ai/query', validateToken, requirePermission('AI_EXECUTE'), checkRelationship('userId'), async (req, res) => {
  try {
    const { userId, capability, query } = req.body;
    if (!userId || !capability || !query) {
      return res.status(400).json({ error: 'userId, capability, and query are required' });
    }

    const prompt = `System: You are an intelligent healthcare assistant helping an elder/caregiver. Scoped capability: ${capability}. User query: ${query}`;
    const result = await generateAIResponse(prompt, capability);

    // Write to audit log in PostgreSQL
    await pool.query(
      `INSERT INTO ai_interactions (user_id, model_id, capability, prompt_payload, response_payload, input_tokens, output_tokens, estimated_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, 'amazon.nova-lite-v1', capability, query, result.response, Math.round(result.inputTokens), Math.round(result.outputTokens), result.cost]
    );

    res.json({ result: result.response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Voice check-in (Receives voice-transcribed text, processes it, creates summary note)
app.post('/ai/voice-checkin', validateToken, requirePermission('AI_EXECUTE'), checkRelationship('userId'), async (req, res) => {
  try {
    const { userId, transcribedText } = req.body;
    if (!userId || !transcribedText) {
      return res.status(400).json({ error: 'userId and transcribedText are required' });
    }

    const prompt = `Analyze the following voice checkin transcript from an elderly patient. Summarize key issues, concerns, pain points, or notes. Keep the summary under 150 words. Transcript: "${transcribedText}"`;
    const result = await generateAIResponse(prompt, 'voice_summary');

    // Create Note in notes-service
    const notesServiceUrl = process.env.NOTES_SERVICE_URL || 'http://notes-service:3000';
    const noteResponse = await fetch(`${notesServiceUrl}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization },
      body: JSON.stringify({
        userId: userId,
        noteType: 'AI_NOTE',
        content: `AI Generated Voice Check-in Summary: ${result.response}`
      })
    });

    // Logging AI interaction
    await pool.query(
      `INSERT INTO ai_interactions (user_id, model_id, capability, prompt_payload, response_payload, input_tokens, output_tokens, estimated_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, 'amazon.nova-lite-v1', 'voice_summary', transcribedText, result.response, Math.round(result.inputTokens), Math.round(result.outputTokens), result.cost]
    );

    let note = null;
    if (noteResponse.ok) {
      note = await noteResponse.json();
    }

    res.json({ summary: result.response, createdNote: note });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cost optimization advisor (FinOps insights)
app.post('/ai/finops-recs', validateToken, requirePermission('AI_EXECUTE'), async (req, res) => {
  try {
    const { costMetricsString } = req.body;
    const prompt = `Analyze the following infrastructure billing breakdown and suggest specific cost optimization improvements for EKS, RDS, and Bedrock: "${costMetricsString || 'Default metrics profile'}"`;
    const result = await generateAIResponse(prompt, 'finops_recs');

    res.json({ recommendation: result.response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch AI interactions summary for Super Admin
app.get('/ai/interactions', validateToken, requirePermission('AI_READ'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_interactions ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_interactions (
      id               SERIAL PRIMARY KEY,
      user_id          INT NOT NULL,
      model_id         VARCHAR(100),
      capability       VARCHAR(50),
      prompt_payload   TEXT,
      response_payload TEXT,
      input_tokens     INT DEFAULT 0,
      output_tokens    INT DEFAULT 0,
      estimated_cost   DECIMAL(12,8) DEFAULT 0,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ AI interactions table ready.');
}

initDb()
  .then(() => app.listen(PORT, () => console.log(`AI service running on port ${PORT}`)))
  .catch(err => { console.error('DB init failed:', err.message); process.exit(1); });
