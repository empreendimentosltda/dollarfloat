module.exports = {
  async createCheckoutSession() { throw new Error('Gateway nao configurado.'); },
  verifyWebhookSignature() { throw new Error('Gateway nao configurado.'); },
  parseWebhookEvent() { return { type: 'other' }; },
};
