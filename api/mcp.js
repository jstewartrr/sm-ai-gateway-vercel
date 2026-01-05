// SM AI Gateway - Unified access for all Sovereign Mind AIs
const GROK_MCP = 'https://grok-mcp.graygrass-be154dbb.eastus.azurecontainerapps.io';
const GEMINI_MCP = 'https://gemini-mcp.lemoncoast-87756bcf.eastus.azurecontainerapps.io';
const VERTEX_MCP = 'https://vertex-ai-mcp.lemoncoast-87756bcf.eastus.azurecontainerapps.io';

async function callMCP(url, tool, args) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    const response = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await response.json();
    return data.result?.content?.[0]?.text || JSON.stringify(data);
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

const TOOLS = [
  // Hive Mind (via Grok)
  { name: 'sm_hive_mind_read', description: 'Read from Sovereign Mind Hive Mind shared memory', inputSchema: { type: 'object', properties: { limit: { type: 'integer', default: 5 } } } },
  { name: 'sm_hive_mind_write', description: 'Write entry to Hive Mind', inputSchema: { type: 'object', properties: { summary: { type: 'string' }, category: { type: 'string' }, workstream: { type: 'string' } }, required: ['summary'] } },
  // AI Chat functions
  { name: 'grok_chat', description: 'Chat with Grok (xAI) - full tool access', inputSchema: { type: 'object', properties: { message: { type: 'string' }, use_tools: { type: 'boolean', default: true } }, required: ['message'] } },
  { name: 'gemini_chat', description: 'Chat with Gemini (Google)', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } },
  { name: 'vertex_generate', description: 'Generate with Vertex AI (images, text)', inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] } },
  { name: 'vertex_imagen', description: 'Generate image with Imagen 3', inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] } },
  // Inter-AI messaging
  { name: 'ai_message', description: 'Send message to another AI via Hive Mind', inputSchema: { type: 'object', properties: { to_ai: { type: 'string' }, message: { type: 'string' }, priority: { type: 'string', default: 'NORMAL' } }, required: ['to_ai', 'message'] } },
  // Gateway tools (via Grok)
  { name: 'gateway_tool', description: 'Call any tool on SM Gateway (240+ tools)', inputSchema: { type: 'object', properties: { tool: { type: 'string' }, args: { type: 'object' } }, required: ['tool'] } }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { method, params, id } = req.body;
  if (method === 'tools/list') return res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    let result;
    try {
      switch (name) {
        case 'sm_hive_mind_read': 
          result = await callMCP(GROK_MCP, 'sm_hive_mind_read', { limit: args.limit || 5 }); 
          break;
        case 'sm_hive_mind_write': 
          result = await callMCP(GROK_MCP, 'grok_hive_mind_write', { 
            summary: args.summary, 
            category: args.category || 'GENERAL',
            workstream: args.workstream || 'SM_OPERATIONS',
            priority: args.priority || 'NORMAL'
          }); 
          break;
        case 'grok_chat': 
          result = await callMCP(GROK_MCP, 'grok_chat', { message: args.message, use_tools: args.use_tools !== false }); 
          break;
        case 'gemini_chat': 
          result = await callMCP(GEMINI_MCP, 'gemini_chat', { message: args.message }); 
          break;
        case 'vertex_generate': 
          result = await callMCP(VERTEX_MCP, 'vertex_gemini_generate', { prompt: args.prompt }); 
          break;
        case 'vertex_imagen':
          result = await callMCP(VERTEX_MCP, 'vertex_imagen_generate', { prompt: args.prompt });
          break;
        case 'ai_message':
          // Write message to Hive Mind for inter-AI communication
          result = await callMCP(GROK_MCP, 'grok_hive_mind_write', {
            summary: `[AI_MESSAGE] To: ${args.to_ai} | ${args.message}`,
            category: 'AI_MESSAGE',
            workstream: 'INTER_AI',
            priority: args.priority || 'NORMAL'
          });
          break;
        case 'gateway_tool':
          // Pass through to Grok which has gateway access
          result = await callMCP(GROK_MCP, args.tool, args.args || {});
          break;
        default: 
          return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Unknown tool: ${name}. Available: ${TOOLS.map(t=>t.name).join(', ')}` }], isError: true } });
      }
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }] } });
    } catch (e) {
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true } });
    }
  }
  return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
}
