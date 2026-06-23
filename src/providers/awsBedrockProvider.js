const AiProviderInterface = require('./aiProviderInterface');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

class AwsBedrockProvider extends AiProviderInterface {
  constructor(region = 'us-east-1') {
    super();
    this.region = region;
    this.client = null;
    this.initError = null;
    try {
      this.client = new BedrockRuntimeClient({ region: this.region });
    } catch (err) {
      this.initError = err;
      this.errorCount += 1;
      console.warn('⚠️ Amazon Bedrock runtime client could not initialize:', err.message);
    }
  }

  async generateResponse(prompt, capability, modelId = 'anthropic.claude-3-haiku-20240307-v1:0') {
    if (!this.client || !process.env.AWS_ACCESS_KEY_ID) {
      this.errorCount += 1;
      throw new Error('Bedrock client is not initialized or AWS credentials are missing.');
    }
    try {
      const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      };
      const command = new InvokeModelCommand({
        modelId: modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
      });
      const response = await this.client.send(command);
      const resPayload = JSON.parse(Buffer.from(response.body).toString('utf-8'));
      const textResponse = resPayload.content[0].text;

      this.lastSuccessfulInvoke = new Date().toISOString();

      return {
        response: textResponse,
        inputTokens: resPayload.usage?.input_tokens || 0,
        outputTokens: resPayload.usage?.output_tokens || 0,
        cost: ((resPayload.usage?.input_tokens || 0) * 0.00025 + (resPayload.usage?.output_tokens || 0) * 0.00125) / 1000
      };
    } catch (err) {
      this.errorCount += 1;
      throw err;
    }
  }

  async getStatus() {
    const isConfigured = !!(this.client && process.env.AWS_ACCESS_KEY_ID);
    return {
      provider: 'aws',
      healthy: isConfigured && !this.initError,
      lastSuccessfulInvoke: this.lastSuccessfulInvoke,
      cacheAvailable: this.cacheAvailable,
      errorCount: this.errorCount,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }
}

module.exports = AwsBedrockProvider;
