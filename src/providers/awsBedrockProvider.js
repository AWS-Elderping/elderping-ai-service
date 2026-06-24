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

  async generateResponse(prompt, capability, modelId = 'amazon.nova-lite-v1:0') {
    if (!this.client) {
      this.errorCount += 1;
      throw new Error('Bedrock client is not initialized.');
    }
    try {
      // Amazon Nova models use a different request/response format than Anthropic models
      const isNovaModel = modelId.startsWith('amazon.nova');
      const payload = isNovaModel
        ? {
            messages: [{ role: 'user', content: [{ text: prompt }] }],
            inferenceConfig: { maxTokens: 1000 }
          }
        : {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }]
          };

      const command = new InvokeModelCommand({
        modelId: modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
      });
      const response = await this.client.send(command);
      const resPayload = JSON.parse(Buffer.from(response.body).toString('utf-8'));

      let textResponse, inputTokens, outputTokens;
      if (isNovaModel) {
        textResponse = resPayload.output?.message?.content?.[0]?.text || '';
        inputTokens  = resPayload.usage?.inputTokens || 0;
        outputTokens = resPayload.usage?.outputTokens || 0;
      } else {
        textResponse = resPayload.content[0].text;
        inputTokens  = resPayload.usage?.input_tokens || 0;
        outputTokens = resPayload.usage?.output_tokens || 0;
      }

      this.lastSuccessfulInvoke = new Date().toISOString();

      // Nova Lite pricing: $0.00006/1K input, $0.00024/1K output
      const cost = isNovaModel
        ? (inputTokens * 0.00006 + outputTokens * 0.00024) / 1000
        : (inputTokens * 0.00025 + outputTokens * 0.00125) / 1000;

      return { response: textResponse, inputTokens, outputTokens, cost };
    } catch (err) {
      this.errorCount += 1;
      throw err;
    }
  }

  async getStatus() {
    const isConfigured = !!this.client;
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
