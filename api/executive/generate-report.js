// Generate Report API - Triggers Claude to process emails and update Asana
// POST /api/executive/generate-report

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { user = 'jstewart' } = req.body || {};
    
    // Claude API endpoint on abbi-ai.com
    const CLAUDE_API = 'https://abbi-ai.com/api/chat';
    
    const prompt = `Execute the EMAIL_TRIAGE_PROCESSOR skill immediately for the morning briefing:

1. **Email Triage** - Process both mailboxes:
   - jstewart@middleground.com (unread emails)
   - john.claude@middleground.com (unread emails)
   - Delete obvious spam
   - Identify priority emails requiring action

2. **Calendar Review** - Check today's M365 calendar for jstewart@middleground.com

3. **Asana Task Management**:
   - Check overdue tasks for John Stewart (ID: 373563475019846)
   - Add comments to tasks overdue >7 days
   - Create new tasks for action items from emails
   - Assign meeting scheduling to Jackie Reed (ID: 1203396465474133)

4. **Log to Hive Mind** - Insert briefing summary to SOVEREIGN_MIND.RAW.HIVE_MIND

Return a structured summary with:
- Emails processed count
- Spam deleted count  
- Priority emails list (sender, subject, action needed)
- Tasks created
- Overdue task count
- Calendar events for today

Execute now - this is an automated trigger from the Executive Dashboard.`;

    try {
        const response = await fetch(CLAUDE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                system: `You are ABBI, the Adaptive Second Brain Intelligence for Your Grace (John Stewart), Chairman of MiddleGround Capital. Execute tasks immediately using MCP tools. You have access to: M365 (email, calendar), Asana, Snowflake, and other integrations via the SM Gateway.`
            })
        });
        
        if (!response.ok) {
            throw new Error(`Claude API error: ${response.status}`);
        }
        
        const result = await response.json();
        
        let reportContent = '';
        if (result.content) {
            reportContent = result.content.map(c => c.text || '').join('\n');
        } else if (result.choices) {
            reportContent = result.choices[0]?.message?.content || '';
        } else {
            reportContent = JSON.stringify(result);
        }
        
        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            user,
            report: reportContent,
            message: 'Email triage and Asana update completed'
        });
        
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
