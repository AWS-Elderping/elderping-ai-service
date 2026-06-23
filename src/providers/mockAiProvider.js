const AiProviderInterface = require('./aiProviderInterface');

class MockAiProvider extends AiProviderInterface {
  constructor() {
    super();
  }

  async generateResponse(prompt, capability, modelId) {
    try {
      let responseText = `Mock response for: ${capability}. `;
      if (capability === 'symptom_check') {
        responseText += `Based on the provided symptoms, it is recommended to maintain hydration, rest, and log metrics regularly. Please seek a certified general practitioner if status degrades.`;
      } else if (capability === 'qa') {
        responseText += `Elderly individuals require a nutrient-dense diet containing high fiber, lean proteins, calcium, and Vitamin D. Exclude excess sodium.`;
      } else if (capability === 'risk_analysis') {
        responseText += `Risk parameters: Normal. Vitals patterns reflect steady levels. Daily compliance metrics verified at 94%.`;
      } else if (capability === 'finops_recs') {
        responseText += `FinOps Recommendation: scale down inactive EKS worker nodes during off-peak hours (10PM-6AM). Consolidate database instances to AWS Aurora Serverless v2 instances to save ~32% on monthly charges.`;
      } else {
        responseText += `AI Processing successful. Text analyzed.`;
      }

      this.lastSuccessfulInvoke = new Date().toISOString();

      return {
        response: responseText,
        inputTokens: prompt.length / 4,
        outputTokens: responseText.length / 4,
        cost: 0.00
      };
    } catch (err) {
      this.errorCount += 1;
      throw err;
    }
  }

  async getStatus() {
    return {
      provider: 'mock',
      healthy: true,
      lastSuccessfulInvoke: this.lastSuccessfulInvoke,
      cacheAvailable: this.cacheAvailable,
      errorCount: this.errorCount,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }
}

module.exports = MockAiProvider;
