export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    service: 'sm-ai-gateway-vercel',
    version: '1.0.0',
    status: 'healthy',
    description: 'Unified AI Gateway with Hive Mind access for all Sovereign Mind AIs',
    supported_ais: ['GEMINI', 'VERTEX', 'CHATGPT', 'BEDROCK', 'COPILOT'],
    gateway_backend: 'https://sm-mcp-gateway.lemoncoast-87756bcf.eastus.azurecontainerapps.io',
    hive_mind: true
  });
}
