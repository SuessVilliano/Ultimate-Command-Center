# Juno Gateway

Juno Gateway is the single authenticated control plane for Command Center, Telegram, OpenClaw, voice, and Siri. Interfaces submit commands; registered actions execute through the same adapters and every attempt is written to the Juno Action Ledger.

## Required configuration

Set a strong `JUNO_GATEWAY_KEY`. For Telegram webhook delivery, also set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and the comma-separated `TELEGRAM_ALLOWED_CHAT_IDS` allowlist.

Optional write adapters are configured with `OBS_BRIDGE_URL`/`OBS_BRIDGE_KEY`, `CALENDAR_WRITE_ADAPTER_URL`, `GMAIL_SEND_ADAPTER_URL`, and `GITHUB_WRITE_ADAPTER_URL` plus their matching keys. An unconfigured adapter fails and the ledger records the failure; Juno never reports it as completed.

## API

- `GET /api/juno/gateway/status`
- `GET /api/juno/gateway/actions`
- `POST /api/juno/gateway/command`
- `POST /api/juno/gateway/actions/:actionId/confirm`
- `GET /api/juno/gateway/ledger`
- `GET /api/juno/gateway/session/:source/:externalId`
- `POST /api/juno/gateway/telegram/webhook`

All endpoints except status and the Telegram webhook require `Authorization: Bearer <JUNO_GATEWAY_KEY>`. Telegram uses the Bot API `X-Telegram-Bot-Api-Secret-Token` header and rejects chats not on the allowlist.

Structured clients should send an explicit action and parameters:

```json
{
  "source": "openclaw",
  "externalId": "owner-primary",
  "userId": "owner",
  "message": "Add paper validation to Hybrid Copy",
  "action": "nifty.task.create",
  "params": {
    "projectName": "Hybrid Copy",
    "title": "Validate master to follower paper routing"
  }
}
```

Natural-language resolution supports memory, journal, Nifty task creation, OBS recording/scene commands, and trade preview/paper/live requests. Explicit actions are preferred for deterministic automation.

## Confirmation contract

Outbound communication, calendar writes, destructive or unknown external writes, and live trades are held. Live trades must first produce a successful order preview. The response returns an action UUID and an exact token such as `CONFIRM 5a…`. Submit that full token to the confirmation endpoint. Telegram users can send the token as a standalone message.

The existing Hybrid execution route performs a second live-trade check using `CONFIRM_LIVE_TRADE`; the adapter adds it only after Gateway confirmation. Paper trading never enters the live route.

## Registered actions

- `memory.remember`
- `journal.save`
- `nifty.task.create`, `nifty.task.update`, `nifty.task.complete`
- `obs.record.start`, `obs.record.stop`, `obs.scene.switch`
- `calendar.create`, `gmail.send`
- `github.patch`
- `hybrid.trade.preview`, `hybrid.trade.paper`, `hybrid.trade.execute`

The ledger statuses are `received`, `running`, `awaiting_confirmation`, `success`, `confirmed`, `partial`, and `failed`. A success or confirmed status is written only after the selected adapter returns successfully.
