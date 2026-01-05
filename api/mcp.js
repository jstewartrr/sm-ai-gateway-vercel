// Use Grok MCP for Hive Mind (it has working Snowflake)
const GROK_MCP = 'https://grok-mcp.graygrass-be154dbb.eastus.azurecontainerapps.io';
const GEMINI_MCP = 'https://gemini-mcp.lemoncoast-87756bcf.eastus.azurecontainerapps.io';
const VERTEX_MCP = 'https://vertex-ai-mcp.lemoncoast-87756bcf.eastus.azurecontainerapps.io';

async function callMCP(url, tool, args) {
  try {
    const response = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: tool, arguments: args }
      })
    });
    const data = await response.json();
    return data.result?.content?.[0]?.text || JSON.stringify(data);
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

const TOOLS = [
  { name: 'sm_hive_mind_read', description: 'Read Hive Mind (via Grok)', inputSchema: { type: 'object', properties: { limit: { type: 'integer', default: 5 } } } },
  { name: 'sm_hive_mind_write', description: 'Write to Hive Mind', inputSchema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } },
  { name: 'gemini_chat', description: 'Chat with Gemini', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } },
  { name: 'vertex_chat', description: 'Chat with Vertex', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } },
  { name: 'grok_chat', description: 'Chat with Grok', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } }
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
        case 'sm_hive_mind_read': result = await callMCP(GROK_MCP, 'sm_hive_mind_read', { limit: args.limit || 5 }); break;
        case 'sm_hive_mind_write': result = await callMCP(GROK_MCP, 'grok_hive_mind_write', { summary: args.summary, category: args.category || 'GENERAL' }); break;
        case 'gemini_chat': result = await callMCP(GEMINI_MCP, 'gemini_chat', { message: args.message }); break;
        case 'vertex_chat': result = await callMCP(VERTEX_MCP, 'vertex_gemini_generate', { prompt: args.message }); break;
        case 'grok_chat': result = await callMCP(GROK_MCP, 'grok_chat', { message: args.message, use_tools: true }); break;
        default: return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Unknown: ${name}` }], isError: true } });
      }
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }] } });
    } catch (e) {
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true } });
    }
  }
  return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
}
