class AiProviderInterface {
  constructor() {
    this.startTime = Date.now();
    this.lastSuccessfulInvoke = null;
    this.errorCount = 0;
    this.cacheAvailable = false;
  }

  /**
   * Generate text response from prompt.
   * @param {string} prompt
   * @param {string} capability
   * @param {string} [modelId]
   * @returns {Promise<{response: string, inputTokens: number, outputTokens: number, cost: number}>}
   */
  async generateResponse(prompt, capability, modelId) {
    throw new Error('generateResponse must be implemented by subclass');
  }

  /**
   * Retrieve provider health, uptime, and invocation metrics.
   * @returns {Promise<{provider: string, healthy: boolean, lastSuccessfulInvoke: string|null, cacheAvailable: boolean, errorCount: number, uptimeSeconds: number}>}
   */
  async getStatus() {
    throw new Error('getStatus must be implemented by subclass');
  }
}

module.exports = AiProviderInterface;
