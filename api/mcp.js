const GATEWAY = 'https://sm-mcp-gateway.lemoncoast-87756bcf.eastus.azurecontainerapps.io';

async function callGateway(tool, args) {
  try {
    const response = await fetch(`${GATEWAY}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: tool, arguments: args }
      })
    });
    const data = await response.json();
    const text = data.result?.content?.[0]?.text;
    return text || JSON.stringify(data);
  } catch (e) {
    return `Error calling gateway: ${e.message}`;
  }
}

// AI-specific chat functions
async function geminiChat(message) {
  // Call Gemini MCP for chat
  try {
    const response = await fetch('https://gemini-mcp.lemoncoast-87756bcf.eastus.azurecontainerapps.io/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'tools/call',
        params: { name: 'gemini_chat', arguments: { message } }
      })
    });
    const data = await response.json();
    return data.result?.content?.[0]?.text || JSON.stringify(data);
  } catch (e) {
    return `Gemini error: ${e.message}`;
  }
}

async function vertexChat(message) {
  try {
    const response = await fetch('https://vertex-ai-mcp.lemoncoast-87756bcf.eastus.azurecontainerapps.io/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'tools/call',
        params: { name: 'vertex_gemini_generate', arguments: { prompt: message } }
      })
    });
    const data = await response.json();
    return data.result?.content?.[0]?.text || JSON.stringify(data);
  } catch (e) {
    return `Vertex error: ${e.message}`;
  }
}

const TOOLS = [
  // Hive Mind tools (via gateway)
  { name: 'sm_hive_mind_read', description: 'Read from Sovereign Mind Hive Mind', inputSchema: { type: 'object', properties: { limit: { type: 'integer', default: 5 } } } },
  { name: 'sm_hive_mind_write', description: 'Write to Hive Mind', inputSchema: { type: 'object', properties: { summary: { type: 'string' }, category: { type: 'string' }, workstream: { type: 'string' } }, required: ['summary'] } },
  // AI Chat tools
  { name: 'gemini_chat', description: 'Chat with Gemini (Sovereign Mind)', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } },
  { name: 'vertex_chat', description: 'Chat with Vertex AI', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } },
  // Gateway passthrough
  { name: 'gateway_call', description: 'Call any tool on SM Gateway', inputSchema: { type: 'object', properties: { tool: { type: 'string' }, args: { type: 'object' } }, required: ['tool'] } }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { method, params, id } = req.body;
    
    if (method === 'tools/list') {
      return res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    }
    
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      let result;
      
      switch (name) {
        case 'sm_hive_mind_read':
          result = await callGateway('hivemind_read', { limit: args.limit || 5 });
          break;
        case 'sm_hive_mind_write':
          result = await callGateway('hivemind_write', {
            source: args.source || 'SM_AI_GATEWAY',
            category: args.category || 'GENERAL',
            workstream: args.workstream || 'SM_OPERATIONS',
            summary: args.summary,
            details: args.details || {},
            priority: args.priority || 'NORMAL'
          });
          break;
        case 'gemini_chat':
          result = await geminiChat(args.message);
          break;
        case 'vertex_chat':
          result = await vertexChat(args.message);
          break;
        case 'gateway_call':
          result = await callGateway(args.tool, args.args || {});
          break;
        default:
          return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true } });
      }
      
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }] } });
    }
    
    return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  } catch (error) {
    return res.json({ jsonrpc: '2.0', id: req.body?.id, result: { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true } });
  }
}
