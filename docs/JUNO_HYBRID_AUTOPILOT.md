# Juno Hybrid Autopilot

## Goal

Turn Hybrid AI / Auto Hybrid AI / AH-AI QQE / Hybrid AI Supercator alerts into one deterministic Juno workflow that can be controlled with natural-language trading-plan instructions and routed across multiple demo accounts before any live execution is considered.

## Architecture

TradingView Pine signal -> `/api/trading/guardian/alert` -> rich signal normalization -> Hybrid Journal/guardian context -> active Juno trading plan -> internal paper ledger -> selected broker demo adapters -> Highest Self / Hybrid Journal tracking.

Juno Gateway natural language -> `/api/juno/gateway/command` -> paper-plan compiler -> persisted Juno trading plan.

## Account registry

The broker router knows these account classes:

- `JUNO_DEMO` — internal shadow/paper ledger.
- `KRAKEN_FUTURES_DEMO` — Kraken Futures demo REST adapter.
- `TRADOVATE_DEMO` — Tradovate simulation REST adapter.
- `DXTRADE_DEMO` — provider-specific DXtrade demo adapter.
- `KRAKEN_FUTURES_LIVE` — registered/status-only.
- `KRAKEN_SPOT_LIVE` — registered/status-only.
- `TRADOVATE_LIVE` — registered/status-only.
- `DXTRADE_LIVE` — registered/status-only.

Automatic routing is demo-only. Live accounts are visible to the registry but cannot be selected by the demo execution engine.

## Natural conversation examples

- `Wait for ORB, then trade signals either above or below on demo.`
- `Use MNQ only, minimum A grade, 70 score, max risk 0.25%.`
- `Use Kraken demo and Tradovate demo.`
- `Use all demo accounts.`
- `Arm paper trading.`
- `Stop trading.`
- `Only take short signals on demo.`

Juno compiles these statements into persisted deterministic plan fields rather than asking an LLM to invent a trade.

## Default plan

- mode: PAPER
- enabled: false
- waitForOrb: true
- ORB: 09:30–10:00 ET
- direction: BOTH
- allowed symbol: MNQ
- target account: JUNO_DEMO
- minimum score: 65
- minimum grade: A
- max risk cap: 0.25%
- confirmed bars required
- one open internal paper position per symbol

## TradingView webhook payload

Prefer the rich signal contract below:

```json
{
  "signal_id": "MNQ-10-20260901-1000-S",
  "strategy_id": "hybrid_supercator",
  "strategy_version": "1.0",
  "action": "sell",
  "ticker": "MNQ",
  "tf": "10",
  "price": 29474.75,
  "entry": 29474.75,
  "score": 82,
  "grade": "A+",
  "sl": 29514.25,
  "tp1": 29395.75,
  "tp2": 29356.25,
  "tp3": 29316.75,
  "adx": 33.4,
  "tenkan": 29480.0,
  "kijun": 29491.0,
  "sma": 29510.0,
  "atr": 26.5,
  "regime": "SHORT",
  "cloud": "BELOW",
  "mtf": "BEARISH",
  "volume_ok": true,
  "confirmed": true
}
```

## Endpoints

### Trading plan

- `GET /api/trading/juno/plan`
- `POST /api/trading/juno/plan/compile`
- `PATCH /api/trading/juno/plan`
- `POST /api/trading/juno/arm`

Compile and apply:

```json
{
  "text": "wait for ORB, use MNQ, minimum A, score 70, use Kraken demo and Tradovate demo, max risk .25%",
  "apply": true
}
```

Arm selected demos:

```json
{
  "enabled": true,
  "mode": "PAPER",
  "targetAccounts": ["JUNO_DEMO", "KRAKEN_FUTURES_DEMO", "TRADOVATE_DEMO"]
}
```

### Broker registry / tests

- `GET /api/trading/juno/brokers`
- `POST /api/trading/juno/brokers/KRAKEN_FUTURES_DEMO/test`
- `POST /api/trading/juno/brokers/TRADOVATE_DEMO/test`
- `POST /api/trading/juno/brokers/DXTRADE_DEMO/test`

The status response never returns full credentials.

### TradingView signal ingestion

`POST /api/trading/guardian/alert`

The response contains parsed alert, normalized rich alert, guardian analysis, active Juno plan, deterministic plan evaluation, internal paper order, and broker-routing results.

## Render environment variables

### Kraken Futures demo

```text
KRAKEN_FUTURES_DEMO_ENABLED=true
KRAKEN_FUTURES_DEMO_API_KEY=<demo public key>
KRAKEN_FUTURES_DEMO_API_SECRET=<demo private key>
KRAKEN_FUTURES_DEMO_BASE_URL=https://demo-futures.kraken.com/derivatives/api/v3
```

Kraken uses a separate demo environment and separate demo API keys. Do not reuse production keys.

### Tradovate demo

```text
TRADOVATE_DEMO_ENABLED=true
TRADOVATE_DEMO_ACCESS_TOKEN=<current demo bearer token>
TRADOVATE_DEMO_ACCOUNT_ID=<demo account id>
TRADOVATE_DEMO_USERNAME=<account spec / username>
TRADOVATE_DEMO_BASE_URL=https://demo.tradovateapi.com/v1
```

The first implementation uses a supplied access token. Token refresh/auth automation should be added once the exact API-key/CID credentials are available.

### DXtrade demo

DXtrade is a B2B platform and the API contract can differ by the broker/prop provider. Configure only after obtaining the provider's exact API details:

```text
DXTRADE_DEMO_ENABLED=true
DXTRADE_DEMO_ORDER_URL=<provider order endpoint>
DXTRADE_DEMO_ACCESS_TOKEN=<provider token>
```

### Symbol and size mapping

Do not guess broker contract symbols. Map the TradingView symbol to the exact broker contract after verifying it in that account:

```text
JUNO_SYMBOL_MNQ=<verified broker symbol>
JUNO_SIZE_MNQ=1
```

Per-account overrides are also supported, for example:

```text
JUNO_SYMBOL_TRADOVATE_DEMO_MNQ=<current Tradovate MNQ contract>
JUNO_SIZE_TRADOVATE_DEMO_MNQ=1
```

## Protection orders

The first broker-adapter pass sends demo entries and keeps SL/TP1/TP2/TP3 in the Juno trade record. Broker-native bracket/OCO protection must be validated separately for each provider before enabling it. This avoids silently assuming that different broker order semantics are identical.

## Deployment

`render.yaml` has `autoDeploy: true` for the API service. Commits to the connected branch should trigger a Render deployment automatically. The new broker environment variables are declared in `render.yaml` with secrets marked `sync: false`; they still must be entered in Render.

## Safety boundary

The automatic broker router is demo-only. Live Kraken spot/futures, Tradovate live, and DXtrade live are registered as account targets for status/architecture purposes but are not available to unattended routing in this implementation.

## Principle

TradingView/Pine decides that a strategy signal exists. Juno does not freestyle a replacement strategy. Juno understands the signal, applies the current trading plan and account policy, routes eligible demo orders, explains every pass/block decision, and records the result for later strategy comparison.
