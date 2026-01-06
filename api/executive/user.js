// Executive Dashboard Live API
// Fetches real-time data from M365, Asana, and Snowflake

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    
    const { user } = req.query;
    const userConfig = getUserConfig(user);
    
    if (!userConfig) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    try {
        const [calendar, emails, tasks, activity] = await Promise.all([
            fetchCalendar(userConfig),
            fetchEmails(userConfig),
            fetchTasks(userConfig),
            fetchHiveMind()
        ]);
        
        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            user: userConfig.name,
            data: { calendar, emails, tasks, activity }
        });
    } catch (error) {
        console.error('Dashboard API Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

function getUserConfig(user) {
    const users = {
        'jstewart': { name: 'John Stewart', email: 'jstewart@middleground.com', asanaId: '373563475019846' },
        'john.claude': { name: 'John Claude', email: 'John.Claude@middleground.com', asanaId: '1212591470852740' }
    };
    return users[user];
}

const GW = 'https://cv-sm-gateway-v3.lemoncoast-87756bcf.eastus.azurecontainerapps.io';
const SF = 'https://cv-sm-snowflake-20260105.lemoncoast-87756bcf.eastus.azurecontainerapps.io';

async function mcpCall(url, tool, args) {
    const r = await fetch(`${url}/mcp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: tool, arguments: args }, id: Date.now() })
    });
    const d = await r.json();
    if (d.result?.content?.[0]?.text) { try { return JSON.parse(d.result.content[0].text); } catch { return d.result.content[0].text; } }
    return d.result || d;
}

async function fetchCalendar(u) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const r = await mcpCall(GW, 'm365_list_calendar_events', { user: u.email, start_date: today, end_date: today, top: 20 });
        if (Array.isArray(r)) return r.map(e => ({ time: fmtTime(e.start?.dateTime||e.start), title: e.subject||'No Title', type: catEvent(e.subject), location: e.location?.displayName||'' }));
        return [];
    } catch { return []; }
}

async function fetchEmails(u) {
    try {
        const r = await mcpCall(GW, 'm365_read_emails', { user: u.email, unread_only: true, top: 10 });
        if (Array.isArray(r)) return r.map(e => ({ id: e.id, from: e.from?.emailAddress?.name||e.from||'Unknown', subject: e.subject||'No Subject', priority: e.importance==='high'?'high':'medium', time: fmtRel(e.receivedDateTime) }));
        return [];
    } catch { return []; }
}

async function fetchTasks(u) {
    try {
        const r = await mcpCall(GW, 'asana_search_tasks', { assignee: u.asanaId, completed: false, limit: 50 });
        const now = new Date(); let tasks = [], cnt = 0;
        if (Array.isArray(r)) { tasks = r.filter(t => { if (t.due_on && new Date(t.due_on) < now) { cnt++; return true; } return false; }).slice(0,10).map(t => ({ id: t.gid, name: t.name, due: fmtDate(t.due_on), project: t.projects?.[0]?.name||'No Project', url: `https://app.asana.com/0/0/${t.gid}` })); }
        return { tasks, overdueCount: cnt };
    } catch { return { tasks: [], overdueCount: 0 }; }
}

async function fetchHiveMind() {
    try {
        const r = await mcpCall(SF, 'snowflake_execute_query', { query: `SELECT CATEGORY, WORKSTREAM, SUMMARY FROM SOVEREIGN_MIND.RAW.HIVE_MIND WHERE CREATED_AT >= DATEADD(hour, -24, CURRENT_TIMESTAMP()) ORDER BY CREATED_AT DESC LIMIT 6`, response_format: 'json' });
        if (Array.isArray(r)) return r.map(x => ({ type: x.WORKSTREAM||x.CATEGORY||'System', title: x.CATEGORY||'Update', desc: (x.SUMMARY||'').substring(0,80) }));
        return [];
    } catch { return []; }
}

function fmtTime(d) { if (!d) return '--:--'; return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
function fmtDate(d) { if (!d) return 'No date'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtRel(d) { if (!d) return ''; const ms = Date.now() - new Date(d).getTime(); const m = Math.floor(ms/60000), h = Math.floor(ms/3600000); if (m < 60) return `${m}m ago`; if (h < 24) return `${h}h ago`; return 'Yesterday'; }
function catEvent(t) { const l = (t||'').toLowerCase(); if (l.includes('desk')||l.includes('focus')) return 'desk'; if (l.includes('lunch')||l.includes('personal')||l.includes('massage')) return 'personal'; return 'meeting'; }
