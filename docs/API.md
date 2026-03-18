# LIV8 Command Center - External API v1

Complete reference for the authenticated REST API that allows external platforms (Zapier, Make, n8n, GHL, custom apps) to interact with your entire Command Center.

**Base URL:** `http://localhost:3005/api/v1`

---

## Authentication

All `/api/v1` endpoints require an API key sent via:

```
Authorization: Bearer liv8_your_key_here
```

Or as a query parameter: `?api_key=liv8_your_key_here`

### Getting Your First Key

When no keys exist yet, call the bootstrap endpoint (no auth required):

```bash
curl -X POST http://localhost:3005/api/bootstrap-key \
  -H "Content-Type: application/json" \
  -d '{"name": "Admin Master Key"}'
```

Response:
```json
{
  "success": true,
  "id": 1,
  "key": "liv8_a1b2c3d4...",
  "prefix": "liv8_a1b2c3d4",
  "name": "Admin Master Key",
  "scopes": ["*"],
  "rateLimit": 120,
  "message": "Store this key securely — it cannot be retrieved again."
}
```

> **Important:** The full key is only shown once. Store it securely.

### Creating Additional Keys

Use your admin key to create scoped keys for different integrations:

```bash
curl -X POST http://localhost:3005/api/v1/keys \
  -H "Authorization: Bearer liv8_your_admin_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GHL Webhook Key",
    "scopes": "tickets,drafts,webhooks",
    "rate_limit": 30
  }'
```

### Available Scopes

| Scope | Access |
|-------|--------|
| `*` | Full access to all endpoints |
| `admin` | Key management (create, revoke, delete keys) |
| `tickets` | Ticket search, triage, draft generation, pipeline |
| `drafts` | Draft queue management (list, approve, reject) |
| `chat` | AI chat and agent routing |
| `knowledge` | Knowledge base search, RAG Q&A, casebook |
| `memory` | Memory facts and user context |
| `webhooks` | Inbound webhook receiver |

### Rate Limiting

Each key has a configurable rate limit (requests per minute). Headers returned:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 55
X-RateLimit-Reset: 45
```

429 response when exceeded.

---

## API Key Management

### List All Keys
```
GET /api/v1/keys
Scope: admin
```

### Get Key Stats
```
GET /api/v1/keys/:id/stats
Scope: admin
```

Returns request history, endpoint usage breakdown, and last-used timestamp.

### Revoke a Key
```
POST /api/v1/keys/:id/revoke
Scope: admin
```

### Reactivate a Key
```
POST /api/v1/keys/:id/activate
Scope: admin
```

### Delete a Key
```
DELETE /api/v1/keys/:id
Scope: admin
```

---

## Tickets

### List Tickets
```
GET /api/v1/tickets
GET /api/v1/tickets?status=2,3
Scope: tickets
```

Query params:
- `status` - Comma-separated status codes (2=open, 3=pending, 4=resolved, 5=closed)

### Get Single Ticket
```
GET /api/v1/tickets/:ticketId
Scope: tickets
```

Returns ticket data with AI triage analysis.

### Triage a Ticket
```
POST /api/v1/tickets/triage
Scope: tickets
```

Submit any ticket for AI analysis — not just GHL tickets. Works with Freshdesk, Zendesk, custom forms, or raw text.

```json
{
  "subject": "Can't access my account",
  "description": "I've been trying to log in for 2 days...",
  "requester_name": "John Doe",
  "requester_email": "john@example.com",
  "priority": 3,
  "source": "zapier"
}
```

Response:
```json
{
  "success": true,
  "triage": {
    "escalation_type": "standard",
    "urgency_score": 7,
    "category": "account-access",
    "summary": "Customer unable to access account for 2 days",
    "suggested_response": "Hi John, I understand how frustrating...",
    "keywords": ["account", "login", "access"]
  }
}
```

### Generate Draft Response
```
POST /api/v1/tickets/draft
Scope: tickets
```

```json
{
  "subject": "Billing question about upgrade",
  "description": "I was charged twice for the Pro plan...",
  "requester_name": "Jane Smith",
  "context": {
    "sop": "Optional SOP content to guide the response"
  }
}
```

### Process Through Full Pipeline
```
POST /api/v1/tickets/pipeline
Scope: tickets
```

Runs: Triage -> Knowledge Base Search -> Draft Generation -> QA Evaluation

```json
{
  "ticket_id": 12345
}
```

---

## Drafts

### List Draft Queue
```
GET /api/v1/drafts
GET /api/v1/drafts?status=PENDING_REVIEW&limit=10
Scope: drafts
```

### Get Draft for Ticket
```
GET /api/v1/drafts/ticket/:ticketId
Scope: drafts
```

### Update Draft Status
```
PATCH /api/v1/drafts/:id/status
Scope: drafts
```

```json
{
  "status": "APPROVED"
}
```

Valid statuses: `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `NEEDS_EDIT`, `ESCALATION_RECOMMENDED`

### Draft Queue Stats
```
GET /api/v1/drafts/stats
Scope: drafts
```

---

## AI Chat

### Send Message
```
POST /api/v1/chat
Scope: chat
```

```json
{
  "message": "What are the top priority tickets right now?",
  "conversation_id": "optional-existing-conversation-id",
  "user_id": "optional-user-identifier"
}
```

Response:
```json
{
  "success": true,
  "response": "You have 3 high-priority tickets...",
  "conversation_id": "conv_abc123"
}
```

Conversations persist across messages. Pass `conversation_id` to continue a thread.

### Route to Specialized Agent
```
POST /api/v1/chat/agent
Scope: chat
```

```json
{
  "message": "How do I set up A2P 10DLC registration?"
}
```

Response:
```json
{
  "success": true,
  "agent": "highlevel-specialist",
  "confidence": 0.85,
  "response": "Routed to HighLevel Support Specialist"
}
```

---

## Knowledge Base

### Semantic Search
```
POST /api/v1/knowledge/search
Scope: knowledge
```

```json
{
  "query": "customer can't receive SMS messages",
  "limit": 5
}
```

### Ask a Question (RAG)
```
POST /api/v1/knowledge/ask
Scope: knowledge
```

```json
{
  "question": "What's the most common cause of SMS delivery failures?"
}
```

### Knowledge Base Stats
```
GET /api/v1/knowledge/stats
Scope: knowledge
```

### Search Casebook
```
POST /api/v1/casebook/search
Scope: knowledge
```

Search human-approved gold-standard responses.

```json
{
  "terms": "twilio suspension",
  "limit": 5
}
```

---

## Memory & Context

### Get Memory Facts
```
GET /api/v1/memory/facts
GET /api/v1/memory/facts?category=tasks
Scope: memory
```

### Store a Fact
```
POST /api/v1/memory/facts
Scope: memory
```

```json
{
  "fact": "Customer prefers email communication over phone",
  "category": "preferences",
  "source": "ghl-workflow"
}
```

### Get User Context
```
GET /api/v1/memory/context?user_id=optional
Scope: memory
```

---

## Inbound Webhooks

### Universal Event Receiver
```
POST /api/v1/webhook/incoming
Scope: webhooks
```

Accepts events from any platform. The Command Center auto-processes based on event type.

```json
{
  "event": "ticket.created",
  "source": "freshdesk",
  "data": {
    "subject": "Need help with integration",
    "description": "Full ticket body...",
    "requester_name": "Customer Name"
  }
}
```

Supported events:
| Event | Action |
|-------|--------|
| `ticket.created` | Auto-triages the ticket |
| `ticket.updated` | Re-triages with new info |
| `message.received` | Generates AI response |
| `task.completed` | Stores in memory |
| `task.created` | Stores in memory |
| *(any other)* | Logged for learning |

---

## System Status

### Full System Health
```
GET /api/v1/status
Scope: any valid key
```

Returns: AI provider status, database stats, pipeline status, RAG stats, and your key info.

---

## Integration Examples

### Zapier / Make / n8n

1. Create a scoped key: `POST /api/bootstrap-key`
2. Use "Webhook" or "HTTP Request" module
3. Set `Authorization: Bearer liv8_...` header
4. Point to your endpoint (e.g., `POST /api/v1/tickets/triage`)

### GHL Workflow

1. Add a "Custom Webhook" action in your GHL workflow
2. Set URL: `https://your-server.com/api/v1/webhook/incoming`
3. Add header: `Authorization: Bearer liv8_your_ghl_key`
4. Map GHL fields to the request body

### Freshdesk Automation

1. In Freshdesk Admin > Automations > Ticket Creation
2. Add "Trigger Webhook" action
3. URL: `https://your-server.com/api/v1/tickets/triage`
4. Method: POST, add auth header

### Custom Integration

```javascript
const response = await fetch('https://your-server.com/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer liv8_your_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Summarize all open tickets'
  })
});

const data = await response.json();
console.log(data.response);
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable description"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (missing required fields) |
| 401 | Invalid or missing API key |
| 403 | Insufficient scope or bootstrap disabled |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Server error |
