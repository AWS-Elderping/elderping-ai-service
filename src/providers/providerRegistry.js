const MockAiProvider = require('./mockAiProvider');
const AwsBedrockProvider = require('./awsBedrockProvider');

class ProviderRegistry {
  constructor() {
    const providerType = process.env.AI_PROVIDER || 'aws';
    console.log(`[AI PROVIDER REGISTRY] Initializing with provider: ${providerType}`);
    if (providerType.toLowerCase() === 'aws') {
      this.activeProvider = new AwsBedrockProvider(process.env.AWS_REGION || 'us-east-1');
    } else {
      this.activeProvider = new MockAiProvider();
    }
  }

  getProvider() {
    return this.activeProvider;
  }
}

module.exports = new ProviderRegistry();
