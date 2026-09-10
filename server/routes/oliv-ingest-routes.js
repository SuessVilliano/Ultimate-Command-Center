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
}

const clean = v => String(v || '').replace(/\r/g, '').trim();
const first = (...vals) => vals.map(clean).find(Boolean) || '';

function section(body, names) {
  const src = clean(body);
  if (!src) return '';
  for (const name of names) {
    const re = new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*)?${name}\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:#{1,4}\\s*)?(?:Summary|Research|Deal Details|Deal Intelligence|Action Items|Next Steps|Commitments|Affiliate Commitments|Manager Commitments|Blockers?|Risks?|Follow[- ]?up|Attendees?|Participants?)\\s*:?\\s*\\n|$)`, 'i');
    const m = src.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return '';
}

function extractEmails(text) {
  const all = clean(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const filtered = all.filter(e => !/@(?:oliv\.ai|gohighlevel\.com|leadconnectorhq\.com)$/i.test(e));
  return [...new Set(filtered.map(e => e.toLowerCase()))];
}

function normalize(payload = {}) {
  const body = first(payload.body, payload.text, payload.plainText, payload.emailBody, payload.rawBody, payload.content);
  const candidateEmails = [...new Set([
    ...extractEmails(body),
    ...extractEmails(first(payload.attendees, payload.participants, payload.to, payload.cc)),
    clean(payload.affiliateEmail).toLowerCase(),
  ].filter(Boolean))];

  const summary = first(payload.summary, section(body, ['Summary', 'Meeting Summary', 'Call Summary']), body.slice(0, 4000));
  const research = first(payload.research, section(body, ['Research', 'Account Research', 'Pre-call Research']));
  const dealDetails = first(payload.dealDetails, payload.deal_details, section(body, ['Deal Details', 'Deal Intelligence']));
  const affiliateCommitments = first(payload.affiliateCommitments, payload.affiliate_commitments, section(body, ['Affiliate Commitments', 'Commitments']));
  const managerCommitments = first(payload.managerCommitments, payload.manager_commitments, section(body, ['Manager Commitments', 'My Commitments']));
  const blocker = first(payload.blocker, payload.risk, section(body, ['Blocker', 'Blockers', 'Risk', 'Risks']));
  const nextAction = first(payload.nextAction, payload.next_action, section(body, ['Next Action', 'Next Steps', 'Action Items']));
  const followUpDate = first(payload.followUpDate, payload.follow_up_date);
  const affiliateName = first(payload.affiliateName, payload.affiliate_name, payload.contactName, payload.contact_name);
  const affiliateEmail = first(payload.affiliateEmail, payload.affiliate_email, candidateEmails.length === 1 ? candidateEmails[0] : '');
  const meetingType = first(payload.meetingType, payload.meeting_type, /zoom/i.test(body) ? 'Zoom' : 'Meeting');
  const dateText = first(payload.receivedAt, payload.received_at, payload.date, new Date().toISOString());

  const note = `AFFILIATE MEETING UPDATE | ${meetingType} | ${dateText}\n\nAffiliate: ${affiliateName || affiliateEmail || 'Match required'}\n\nSummary:\n${summary || 'No summary supplied'}${research ? `\n\nResearch / account context:\n${research}` : ''}${dealDetails ? `\n\nDeal / growth details:\n${dealDetails}` : ''}${affiliateCommitments ? `\n\nAffiliate commitments:\n${affiliateCommitments}` : ''}${managerCommitments ? `\n\nManager commitments:\n${managerCommitments}` : ''}${blocker ? `\n\nRisk or blocker:\n${blocker}` : ''}${nextAction ? `\n\nNext action:\n${nextAction}` : ''}${followUpDate ? `\n\nFollow-up date:\n${followUpDate}` : ''}\n\nSource:\nOliv.ai → TaskMagic → Ultimate Command Center`;

  return {
    messageId: first(payload.messageId, payload.message_id, payload.id, `${clean(payload.subject)}|${dateText}|${affiliateEmail || affiliateName}`),
    sender: first(payload.from, payload.sender, 'oliv.ai'),
    subject: first(payload.subject, 'Oliv.ai meeting summary'),
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
    res.json({ configured: Boolean(process.env.OLIV_INGEST_SECRET), endpoint: '/api/affiliate/oliv-ingest', source: 'Oliv.ai via TaskMagic' });
  });

  app.post('/api/affiliate/oliv-ingest', (req, res) => {
    try {
      if (!process.env.OLIV_INGEST_SECRET) return res.status(503).json({ error: 'OLIV_INGEST_SECRET is not configured' });
      if (!authorized(req)) return res.status(401).json({ error: 'Invalid Oliv ingest secret' });
      const item = normalize(req.body || {});
      const d = db.getDb();
      const stmt = d.prepare(`
        INSERT INTO ${TABLE} (message_id,sender,subject,received_at,affiliate_name,affiliate_email,candidate_emails,promoter_id,meeting_type,summary,research,deal_details,affiliate_commitments,manager_commitments,blocker,next_action,follow_up_date,raw_body,crm_note,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')
        ON CONFLICT(message_id) DO UPDATE SET
          sender=excluded.sender, subject=excluded.subject, received_at=excluded.received_at,
          affiliate_name=excluded.affiliate_name, affiliate_email=excluded.affiliate_email, candidate_emails=excluded.candidate_emails,
          promoter_id=excluded.promoter_id, meeting_type=excluded.meeting_type, summary=excluded.summary, research=excluded.research,
          deal_details=excluded.deal_details, affiliate_commitments=excluded.affiliate_commitments, manager_commitments=excluded.manager_commitments,
          blocker=excluded.blocker, next_action=excluded.next_action, follow_up_date=excluded.follow_up_date, raw_body=excluded.raw_body,
          crm_note=excluded.crm_note, updated_at=CURRENT_TIMESTAMP
      `);
      stmt.run(item.messageId,item.sender,item.subject,item.receivedAt,item.affiliateName,item.affiliateEmail,JSON.stringify(item.candidateEmails),item.promoterId,item.meetingType,item.summary,item.research,item.dealDetails,item.affiliateCommitments,item.managerCommitments,item.blocker,item.nextAction,item.followUpDate,item.rawBody,item.crmNote);
      const row = d.prepare(`SELECT * FROM ${TABLE} WHERE message_id = ?`).get(item.messageId);
      res.json({ success:true, meeting:rowToJson(row) });
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
      const allowed = new Set(['pending','posted','training','dismissed','needs_match']);
      const status = clean(req.body?.status);
      if (!allowed.has(status)) return res.status(400).json({ error:'Invalid status' });
      db.getDb().prepare(`UPDATE ${TABLE} SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(status, req.params.id);
      res.json({ success:true });
    } catch (error) { res.status(500).json({ error:error.message }); }
  });
}

export default registerOlivIngestRoutes;
