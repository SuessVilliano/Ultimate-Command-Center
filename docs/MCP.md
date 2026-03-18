# LIV8 Command Center - MCP Server

Connect your Command Center to AI clients like Claude Desktop, Cursor, Windsurf, and custom AI agents using the Model Context Protocol (MCP).

---

## What is MCP?

MCP (Model Context Protocol) lets AI assistants use your Command Center as a **tool**. Instead of just chatting, the AI can directly search tickets, triage issues, generate drafts, query your knowledge base, and manage memory — all through structured tool calls.

---

## Setup

### Claude Desktop

1. Open Claude Desktop settings
2. Edit your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "liv8-command-center": {
      "command": "node",
      "args": ["/full/path/to/Ultimate-Command-Center/server/mcp-server.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key",
        "GROQ_API_KEY": "your-free-groq-key"
      }
    }
  }
}
```

3. Restart Claude Desktop
4. You'll see the LIV8 tools icon in the chat input

### Cursor / Windsurf

Add to your MCP configuration (settings > MCP):

```json
{
  "liv8-command-center": {
    "command": "node",
    "args": ["/full/path/to/server/mcp-server.js"]
  }
}
```

### Custom Agents (stdio transport)

Spawn the MCP server as a child process:

```javascript
import { spawn } from 'child_process';

const mcp = spawn('node', ['server/mcp-server.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send JSON-RPC 2.0 messages
mcp.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'my-agent', version: '1.0' }
  }
}) + '\n');

// Read responses
mcp.stdout.on('data', (data) => {
  const response = JSON.parse(data.toString().trim());
  console.log(response);
});
```

---

## Available Tools (15)

### Ticket Management

| Tool | Description |
|------|-------------|
| `search_tickets` | List and filter tickets by status. Returns tickets with AI triage data. |
| `get_ticket` | Get a single ticket by Freshdesk ID with full analysis. |
| `triage_ticket` | Run AI triage on any ticket. Returns urgency, category, suggested response. |
| `generate_draft_response` | Create an AI draft response using knowledge base context. |
| `process_ticket_pipeline` | Full pipeline: triage -> context search -> draft -> QA evaluation. |

### Draft Queue

| Tool | Description |
|------|-------------|
| `get_draft_queue` | View pending drafts. Filter by status (PENDING_REVIEW, APPROVED, etc). |
| `update_draft_status` | Approve, reject, or request edits on a draft. |

### Knowledge & Research

| Tool | Description |
|------|-------------|
| `search_knowledge_base` | Semantic search across resolved tickets and resolutions. |
| `ask_knowledge_base` | Ask questions answered by RAG over your ticket history. |
| `search_casebook` | Search human-approved gold-standard responses. |

### AI Chat & Agents

| Tool | Description |
|------|-------------|
| `chat` | Send a message to LIV8 AI and get a response. |
| `route_to_agent` | Route a request to the best specialized agent. |

### Memory & System

| Tool | Description |
|------|-------------|
| `get_memory_facts` | Retrieve learned facts from long-term memory. |
| `store_memory_fact` | Store a new fact for the Command Center to remember. |
| `get_system_status` | Full system health: AI provider, DB, pipeline, RAG stats. |

---

## Tool Details & Examples

### triage_ticket

**Input:**
```json
{
  "subject": "Can't send SMS from my GHL account",
  "description": "I registered my A2P 10DLC but messages still fail with error 30007",
  "requester_name": "John"
}
```

**Output:**
```json
{
  "escalation_type": "technical",
  "urgency_score": 7,
  "category": "sms-delivery",
  "summary": "A2P registered but SMS failing with 30007 (filtered)",
  "suggested_response": "Hi John, error 30007 means...",
  "keywords": ["a2p", "10dlc", "sms", "30007"]
}
```

### search_knowledge_base

**Input:**
```json
{
  "query": "customer can't port their phone number",
  "limit": 3
}
```

Returns similar resolved tickets with their resolutions.

### chat

**Input:**
```json
{
  "message": "What are the most common ticket categories this week?"
}
```

### get_system_status

No input required. Returns complete system health.

---

## Environment Variables

The MCP server reads from `server/.env`. Required:

```env
# At least one AI provider key
ANTHROPIC_API_KEY=sk-ant-...
# OR
GROQ_API_KEY=gsk_...     # Free!
# OR
OPENAI_API_KEY=sk-...

# Optional but recommended
DATABASE_PATH=./data/liv8.db
```

---

## Architecture

```
┌──────────────────┐     stdio (JSON-RPC 2.0)     ┌─────────────────────┐
│  Claude Desktop  │ ◄──────────────────────────► │  mcp-server.js      │
│  Cursor          │                               │                     │
│  Custom Agent    │                               │  ┌─ ai-provider    │
│                  │                               │  ├─ database       │
│  "Search tickets │                               │  ├─ langchain-rag  │
│   about billing" │                               │  ├─ memory         │
│                  │                               │  ├─ pipeline       │
│  AI calls tool:  │                               │  └─ orchestrator   │
│  search_tickets  │                               │                     │
└──────────────────┘                               └─────────────────────┘
```

The MCP server initializes the same backend modules as the Express server, so it has full access to the database, AI providers, RAG, memory, and pipeline.

---

## Troubleshooting

**"Backend not initialized"**
- Ensure `server/.env` exists with at least one AI key
- Check that `server/data/` directory is writable

**Tools not appearing in Claude Desktop**
- Restart Claude Desktop after config changes
- Check `~/Library/Logs/Claude/mcp*.log` (macOS) for errors
- Verify the full path to `mcp-server.js` is correct

**Slow responses**
- The first call initializes the database and AI — subsequent calls are faster
- Use Groq (free, fast) for cost-effective operation
