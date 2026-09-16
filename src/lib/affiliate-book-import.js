function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

function num(value) {
  const parsed = Number(String(value || '').replace(/[$,%\s]/g, '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function first(raw, ...keys) {
  for (const key of keys) {
    if (raw[key] != null && String(raw[key]).trim() !== '') return String(raw[key]).trim();
  }
  return '';
}

function hasStopInstruction(row) {
  const text = [row.story, row.dnc, row.activeStatus].join(' ').toLowerCase();
  return /suspend|do not contact|do-not-contact|outreach should stop|no check-in|stop until leadership|not to keep/.test(text);
}

function mapRow(headers, values) {
  const raw = Object.fromEntries(headers.map((h, i) => [String(h || '').trim(), String(values[i] || '').trim()]));
  const row = {
    id: first(raw, 'Promoter ID', 'PROMOTER ID'),
    name: first(raw, 'Promoter Full Name', 'AFFILIATE', 'Promoter Email', 'EMAIL') || 'Unknown',
    email: first(raw, 'Promoter Email', 'EMAIL'),
    previousAfm: first(raw, 'AFM'),
    newAfm: first(raw, 'NEW AFM'),
    priority: first(raw, 'PRIORITY'),
    dormantBand: first(raw, 'DORMANT BAND'),
    lifetime: num(first(raw, 'Lifetime', 'LIFETIME')),
    prevQ: num(first(raw, 'Prev Q', 'PREV Q')),
    currQ: num(first(raw, 'Curr Q', 'QTD')),
    mtd: num(raw.MTD),
    qoqPacing: num(raw['QoQ PACING']),
    mom: first(raw, 'MoM', 'MOM'),
    activeStatus: first(raw, 'ACTIVE STATUS', 'STATUS'),
    lastMrr: num(raw['Last MRR']),
    endorsement: first(raw, 'Endorsement', 'ENDORSEMENT'),
    award: first(raw, 'Award', 'AWARD'),
    country: first(raw, 'Country', 'COUNTRY'),
    niche: first(raw, 'Niche', 'NICHE'),
    story: first(raw, 'The story · last note', 'LAST NOTE'),
    promoterProfile: first(raw, 'PROMOTER PROFILE'),
    youtube: first(raw, 'YOUTUBE'),
    instagram: first(raw, 'INSTAGRAM'),
    endorsementWorkbook: first(raw, 'ENDORSEMENT WORKBOOK'),
    forecasting: first(raw, 'FORECASTING'),
    affiliateDoc: first(raw, 'AFFILIATE DOC'),
    highlevelContact: first(raw, 'HIGHLEVEL CONTACT'),
    touches: num(raw.TOUCHES),
    valueGiven: first(raw, 'VALUE GIVEN?'),
    replied: first(raw, 'REPLIED?'),
    dnc: first(raw, 'DO NOT CONTACT'),
    exhausted: first(raw, 'EXHAUSTED?'),
    outcome: first(raw, 'OUTCOME'),
    owner: first(raw, 'OWNER'),
    nextMove: first(raw, 'NEXT MOVE + DATE'),
    source: raw.AFFILIATE ? 'Affiliate EXPAND · Book View' : 'Affiliate EXPAND · Reactivation',
    raw,
  };
  row.stopOutreach = hasStopInstruction(row);
  return row;
}

export function parseAffiliateBookCSV(text) {
  const rows = parseCSV(text);
  const headerIndex = rows.findIndex(r => {
    const cells = r.map(c => String(c).trim());
    return (cells.includes('Promoter Email') && cells.includes('NEW AFM')) ||
      (cells.includes('AFFILIATE') && cells.includes('PROMOTER ID') && cells.includes('ACTIVE STATUS'));
  });
  if (headerIndex < 0) throw new Error('This file does not look like an Affiliate EXPAND book export.');
  const headers = rows[headerIndex];
  const isBookView = headers.includes('AFFILIATE');
  const mapped = rows.slice(headerIndex + 1)
    .filter(r => r.some(Boolean))
    .map(r => mapRow(headers, r))
    .filter(r => (isBookView || String(r.newAfm || '').toLowerCase() === 'jamaur johnson') && r.id);
  if (!mapped.length) throw new Error('No assigned affiliates were found in this export.');
  return {
    rows: mapped,
    headers,
    kind: isBookView ? 'book-view' : 'reactivation',
  };
}
