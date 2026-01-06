// Executive Dashboard API - Real-time data aggregation
export const config = { maxDuration: 60 };

const USERS = {
  jstewart: { name: 'John Stewart', email: 'jstewart@middleground.com', asanaId: '373563475019846' },
  'john.claude': { name: 'John Claude', email: 'John.Claude@middleground.com', asanaId: null }
};

const GATEWAY_URLS = {
  east: 'https://cv-sm-gateway-v3.lemoncoast-87756bcf.eastus.azurecontainerapps.io/mcp',
  snowflake: 'https://cv-sm-snowflake-20260105.lemoncoast-87756bcf.eastus.azurecontainerapps.io/mcp'
};

async function callMCP(url, toolName, args = {}) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: toolName, arguments: args } })
    });
    const result = await response.json();
    if (result.result?.content?.[0]?.text) return JSON.parse(result.result.content[0].text);
    return result;
  } catch (error) { console.error(`MCP call failed for ${toolName}:`, error.message); return null; }
}

export default async function handler(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const userKey = url.pathname.split('/').pop()?.replace('.js', '') || 'jstewart';
  const user = USERS[userKey];
  if (!user) return response.status(404).json({ success: false, error: 'User not found', availableUsers: Object.keys(USERS) });

  const results = { calendar: [], emails: [], tasks: { tasks: [], overdueCount: 0 }, activity: [] };

  try {
    const [calendarResult, emailResult, tasksResult, activityResult] = await Promise.allSettled([
      callMCP(GATEWAY_URLS.east, 'm365_list_calendar_events', {
        user: user.email, start_date: new Date().toISOString().split('T')[0], end_date: new Date().toISOString().split('T')[0], top: 10
      }),
      callMCP(GATEWAY_URLS.east, 'm365_read_emails', { user: user.email, unread_only: true, top: 10 }),
      user.asanaId ? callMCP(GATEWAY_URLS.east, 'asana_search_tasks', {
        assignee: user.asanaId, completed: false, due_before: new Date().toISOString().split('T')[0], limit: 25
      }) : Promise.resolve(null),
      callMCP(GATEWAY_URLS.snowflake, 'snowflake_execute_query', {
        query: `SELECT SUMMARY, CATEGORY, WORKSTREAM, CREATED_AT FROM SOVEREIGN_MIND.RAW.HIVE_MIND WHERE CREATED_AT > DATEADD(hour, -24, CURRENT_TIMESTAMP()) ORDER BY CREATED_AT DESC LIMIT 10`
      })
    ]);

    if (calendarResult.status === 'fulfilled' && calendarResult.value?.events) results.calendar = calendarResult.value.events;
    if (emailResult.status === 'fulfilled' && emailResult.value?.messages) {
      results.emails = emailResult.value.messages.map(m => ({
        subject: m.subject, from: m.from?.emailAddress?.name || m.from?.emailAddress?.address, receivedDateTime: m.receivedDateTime, importance: m.importance
      }));
    }
    if (tasksResult.status === 'fulfilled' && tasksResult.value?.data) {
      const tasks = tasksResult.value.data || [];
      results.tasks = { tasks: tasks.map(t => ({ gid: t.gid, name: t.name, due_on: t.due_on })), overdueCount: tasks.length };
    }
    if (activityResult.status === 'fulfilled' && activityResult.value?.rows) results.activity = activityResult.value.rows;

    return response.status(200).json({ success: true, timestamp: new Date().toISOString(), user: user.name, data: results });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return response.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}