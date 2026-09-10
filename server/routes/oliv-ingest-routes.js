import * as db from '../lib/database.js';

const TABLE = 'affiliate_oliv_meetings';

function initTable() {
  const d = db.getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE,
      sender TEXT,
      subject TEXT,
      source_type TEXT DEFAULT 'meeting',
      received_at TEXT,
      affiliate_name TEXT,
      affiliate_email TEXT,
      candidate_emails TEXT,
      promoter_id TEXT,
      meeting_type TEXT,
      summary TEXT,
      research TEXT,
      deal_details TEXT,
      affiliate_commitments TEXT,
      manager_commitments TEXT,
      blocker TEXT,
      next_action TEXT,
      follow_up_date TEXT,
      raw_body TEXT,
      crm_note TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_affiliate_oliv_status ON ${TABLE}(status);
    CREATE INDEX IF NOT EXISTS idx_affiliate_oliv_received ON ${TABLE}(received_at);
  `);
  try { d.exec(`ALTER TABLE ${TABLE} ADD COLUMN source_type TEXT DEFAULT 'meeting'`); } catch {}
}

const clean = v => String(v || '').replace(/\r/g, '').trim();
const first = (...vals) => vals.map(clean).find(Boolean) || '';

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(Number(n)); } catch { return _; } });
}

function htmlToText(value) {
  const src = String(value || '');
  if (!/<[a-z][\s\S]*>/i.test(src)) return clean(src);
  return clean(decodeEntities(src
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|tr|table|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')));
}

function section(body, names) {
  const src = clean(body);
  if (!src) return '';
  const headings = ['Summary','Meeting Summary','Call Summary','Key takeaways','Key Takeaways','AI Summary','Research','Account Research','Pre-call Research','Deal overview','Deal Overview','Deal Details','Deal Intelligence','What\'s going well','What\'s not going well','Scorecard','Tasks','Action Items','Next Steps','Commitments','Affiliate Commitments','Manager Commitments','Blocker','Blockers','Risk','Risks','Follow-up','Follow Up','Participants','Focus areas','Focus Areas','Metrics','Economic Buyer','Decision Criteria','Decision Process','Paper Process','Identify Pain','Champion','Competition'];
  const stop = headings.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*)?${escaped}\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:#{1,4}\\s*)?(?:${stop})\\s*:?\\s*\\n|$)`, 'i');
    const m = src.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return '';
}

function extractEmails(text) {
  const all = clean(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const filtered = all.filter(e => !/@(?:oliv\.ai|oliv\.guide|gohighlevel\.com|leadconnectorhq\.com)$/i.test(e));
  return [...new Set(filtered.map(e => e.toLowerCase()))];
}

function inferSourceType(payload, subject, sender) {
  const explicit = clean(payload.sourceType || payload.source_type).toLowerCase();
  if (['meeting','research','deal'].includes(explicit)) return explicit;
  const hay = `${subject} ${sender}`.toLowerCase();
  if (/research|account research|pre-call research/.test(hay)) return 'research';
  if (/deal|meeting prep|deal-assist/.test(hay)) return 'deal';
  return 'meeting';
}

function inferAffiliateName(subject, body) {
  const subjectMatch = String(subject || '').match(/Affiliate Call:\s*([^•|\n]+)/i);
  if (subjectMatch?.[1]) return clean(subjectMatch[1]);
  const bodyMatch = String(body || '').match(/Affiliate Call:\s*([^\n]+)/i);
  return clean(bodyMatch?.[1] || '').replace(/\s{2,}.*/, '');
}

function normalize(payload = {}) {
  const rawBody = first(payload.body, payload.text, payload.plainText, payload.emailBody, payload.rawBody, payload.content);
  const body = htmlToText(rawBody);
  const subject = first(payload.subject, 'Oliv.ai update');
  const sender = first(payload.from, payload.sender, 'oliv.ai');
  const sourceType = inferSourceType(payload, subject, sender);

  const candidateEmails = [...new Set([
    ...extractEmails(body),
    ...extractEmails(first(payload.attendees, payload.participants, payload.to, payload.cc)),
    clean(payload.affiliateEmail).toLowerCase(),
  ].filter(Boolean))];

  const keyTakeaways = section(body, ['Key takeaways','Key Takeaways']);
  const aiSummary = section(body, ['AI Summary']);
  const meetingSummary = section(body, ['Summary','Meeting Summary','Call Summary']);
  const dealOverview = section(body, ['Deal overview','Deal Overview']);
  const researchSection = section(body, ['Research','Account Research','Pre-call Research']);
  const summary = first(payload.summary, sourceType === 'meeting' ? keyTakeaways : '', meetingSummary, aiSummary, dealOverview, body.slice(0, 5000));

  const research = first(
    payload.research,
    researchSection,
    sourceType === 'research' ? [section(body,['AI Summary']), section(body,['Focus areas','Focus Areas'])].filter(Boolean).join('\n\n') : ''
  );

  const dealDetails = first(
    payload.dealDetails,
    payload.deal_details,
    section(body, ['Deal Details','Deal Intelligence']),
    sourceType === 'deal' ? [dealOverview, section(body,["What's going well"]), section(body,["What's not going well"]), section(body,['Metrics']), section(body,['Identify Pain']), section(body,['Competition'])].filter(Boolean).join('\n\n') : ''
  );

  const tasks = section(body, ['Tasks','Action Items','Next Steps']);
  const affiliateCommitments = first(payload.affiliateCommitments, payload.affiliate_commitments, section(body, ['Affiliate Commitments','Commitments']));
  const managerCommitments = first(payload.managerCommitments, payload.manager_commitments, section(body, ['Manager Commitments','My Commitments']), sourceType === 'meeting' ? tasks : '');
  const blocker = first(payload.blocker, payload.risk, section(body, ['Blocker','Blockers','Risk','Risks']), sourceType === 'deal' ? section(body,["What's not going well"]) : '');
  const nextAction = first(payload.nextAction, payload.next_action, section(body, ['Next Action','Next Steps']), sourceType === 'deal' ? section(body,['Focus areas','Focus Areas']) : '');
  const followUpDate = first(payload.followUpDate, payload.follow_up_date);
  const affiliateName = first(payload.affiliateName, payload.affiliate_name, payload.contactName, payload.contact_name, inferAffiliateName(subject, body));
  const affiliateEmail = first(payload.affiliateEmail, payload.affiliate_email, candidateEmails.length === 1 ? candidateEmails[0] : '');
  const meetingType = first(payload.meetingType, payload.meeting_type, /zoom/i.test(body) ? 'Zoom' : 'Meeting');
  const dateText = first(payload.receivedAt, payload.received_at, payload.date, new Date().toISOString());
  const sourceLabel = `Oliv · ${sourceType.charAt(0).toUpperCase()}${sourceType.slice(1)}`;
  const noteTitle = sourceType === 'meeting' ? 'AFFILIATE MEETING UPDATE' : 'AFFILIATE INTELLIGENCE UPDATE';

  const note = `${noteTitle} | ${sourceLabel} | ${dateText}\n\nAffiliate: ${affiliateName || affiliateEmail || 'Match required'}\n\nSummary:\n${summary || 'No summary supplied'}${research ? `\n\nResearch / account context:\n${research}` : ''}${dealDetails ? `\n\nDeal / growth details:\n${dealDetails}` : ''}${affiliateCommitments ? `\n\nAffiliate commitments:\n${affiliateCommitments}` : ''}${managerCommitments ? `\n\nManager commitments / tasks:\n${managerCommitments}` : ''}${blocker ? `\n\nRisk or blocker:\n${blocker}` : ''}${nextAction ? `\n\nNext action / focus:\n${nextAction}` : ''}${followUpDate ? `\n\nFollow-up date:\n${followUpDate}` : ''}\n\nSource:\n${sourceLabel} → TaskMagic → Ultimate Command Center`;

  return {
    messageId: first(payload.messageId, payload.message_id, payload.id, `${subject}|${dateText}|${affiliateEmail || affiliateName}|${sourceType}`),
    sender,
    subject,
    sourceType,
    receivedAt: dateText,
    affiliateName,
    affiliateEmail,
    candidateEmails,
    promoterId: first(payload.promoterId, payload.promoter_id),
    meetingType,
    summary,
    research,
    dealDetails,
    affiliateCommitments,
    managerCommitments,
    blocker,
    nextAction,
    followUpDate,
    rawBody: body,
    crmNote: note,
  };
}

function authorized(req) {
  const expected = process.env.OLIV_INGEST_SECRET || '';
  if (!expected) return false;
  const supplied = first(req.headers['x-oliv-webhook-secret'], req.query?.key, req.body?.secret);
  return supplied === expected;
}

function rowToJson(row) {
  if (!row) return row;
  return { ...row, candidate_emails: (() => { try { return JSON.parse(row.candidate_emails || '[]'); } catch { return []; } })() };
}

export function registerOlivIngestRoutes(app) {
  initTable();

  app.get('/api/affiliate/oliv-ingest/status', (_req, res) => {
    res.json({ configured: Boolean(process.env.OLIV_INGEST_SECRET), endpoint: '/api/affiliate/oliv-ingest', source: 'Oliv.ai via TaskMagic', supportedSourceTypes:['meeting','research','deal'] });
  });

  app.post('/api/affiliate/oliv-ingest', (req, res) => {
    try {
      if (!process.env.OLIV_INGEST_SECRET) return res.status(503).json({ error: 'OLIV_INGEST_SECRET is not configured' });
      if (!authorized(req)) return res.status(401).json({ error: 'Invalid Oliv ingest secret' });
      const item = normalize(req.body || {});
      const d = db.getDb();
      const stmt = d.prepare(`
        INSERT INTO ${TABLE} (message_id,sender,subject,source_type,received_at,affiliate_name,affiliate_email,candidate_emails,promoter_id,meeting_type,summary,research,deal_details,affiliate_commitments,manager_commitments,blocker,next_action,follow_up_date,raw_body,crm_note,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')
        ON CONFLICT(message_id) DO UPDATE SET
          sender=excluded.sender, subject=excluded.subject, source_type=excluded.source_type, received_at=excluded.received_at,
          affiliate_name=excluded.affiliate_name, affiliate_email=excluded.affiliate_email, candidate_emails=excluded.candidate_emails,
          promoter_id=excluded.promoter_id, meeting_type=excluded.meeting_type, summary=excluded.summary, research=excluded.research,
          deal_details=excluded.deal_details, affiliate_commitments=excluded.affiliate_commitments, manager_commitments=excluded.manager_commitments,
          blocker=excluded.blocker, next_action=excluded.next_action, follow_up_date=excluded.follow_up_date, raw_body=excluded.raw_body,
          crm_note=excluded.crm_note, updated_at=CURRENT_TIMESTAMP
      `);
      stmt.run(item.messageId,item.sender,item.subject,item.sourceType,item.receivedAt,item.affiliateName,item.affiliateEmail,JSON.stringify(item.candidateEmails),item.promoterId,item.meetingType,item.summary,item.research,item.dealDetails,item.affiliateCommitments,item.managerCommitments,item.blocker,item.nextAction,item.followUpDate,item.rawBody,item.crmNote);
      const row = d.prepare(`SELECT * FROM ${TABLE} WHERE message_id = ?`).get(item.messageId);
      res.json({ success:true, sourceType:item.sourceType, meeting:rowToJson(row) });
    } catch (error) {
      res.status(500).json({ error:error.message });
    }
  });

  app.get('/api/affiliate/oliv-meetings', (req, res) => {
    try {
      const status = clean(req.query.status || 'pending');
      const rows = status === 'all'
        ? db.getDb().prepare(`SELECT * FROM ${TABLE} ORDER BY COALESCE(received_at,created_at) DESC LIMIT 100`).all()
        : db.getDb().prepare(`SELECT * FROM ${TABLE} WHERE status = ? ORDER BY COALESCE(received_at,created_at) DESC LIMIT 100`).all(status);
      res.json({ meetings:rows.map(rowToJson) });
    } catch (error) { res.status(500).json({ error:error.message }); }
  });

  app.patch('/api/affiliate/oliv-meetings/:id', (req, res) => {
    try {
      const allowed = new Set(['pending','posted','training','dismissed','needs_match','reviewed']);
      const status = clean(req.body?.status);
      if (!allowed.has(status)) return res.status(400).json({ error:'Invalid status' });
      db.getDb().prepare(`UPDATE ${TABLE} SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(status, req.params.id);
      res.json({ success:true });
    } catch (error) { res.status(500).json({ error:error.message }); }
  });
}

export default registerOlivIngestRoutes;
