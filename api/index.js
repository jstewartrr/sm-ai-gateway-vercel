export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    service: 'SM AI Gateway',
    version: '2.0.0',
    status: 'healthy',
    description: 'Unified AI Gateway for Sovereign Mind ecosystem',
    hive_mind: true,
    available_ais: {
      GROK: { status: 'OPERATIONAL', features: ['chat', 'tools', 'hive_mind', 'gateway_access'] },
      GEMINI: { status: 'OPERATIONAL', features: ['chat', 'hive_mind'] },
      VERTEX: { status: 'OPERATIONAL', features: ['chat', 'imagen', 'hive_mind'] },
      CHATGPT: { status: 'UNAVAILABLE', reason: 'API key expired' },
      BEDROCK: { status: 'LIMITED', reason: 'AWS rate limiting' },
      COPILOT: { status: 'UNAVAILABLE', reason: 'Azure OpenAI not configured' }
    },
    tools: ['sm_hive_mind_read', 'sm_hive_mind_write', 'grok_chat', 'gemini_chat', 'vertex_generate', 'vertex_imagen', 'ai_message', 'gateway_tool'],
    gateway_backend: 'Grok MCP (250 tools)',
    endpoint: '/api/mcp'
  });
}
