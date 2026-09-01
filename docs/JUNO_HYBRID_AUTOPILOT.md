# Juno Hybrid Autopilot — Phase 1

## Goal

Turn Hybrid AI / Auto Hybrid AI / AH-AI QQE / Hybrid AI Supercator alerts into a deterministic Juno workflow that can be controlled with natural-language plan instructions and tested on PAPER/DEMO before any live broker routing is enabled.

## Architecture

TradingView Pine signal -> `/api/trading/guardian/alert` -> rich signal normalization -> Hybrid Journal/guardian context -> active Juno trading plan -> PAPER/DEMO order ledger -> Highest Self / Hybrid Journal tracking.

Juno Gateway natural language -> `/api/juno/gateway/command` -> paper-plan compiler -> persisted Juno trading plan.

## Safety boundary

Phase 1 cannot place live orders. `mode` is forced to `PAPER` for automatic routing. Live/real/funded-account language remains confirmation-gated by Juno Gateway and no live broker adapter is called by this engine.

## Natural conversation examples

These can be sent through Juno Gateway:

- `Wait for ORB, then trade signals either above or below on demo.`
- `Use MNQ only, minimum A grade, 70 score, max risk 0.25%.`
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
- minimum score: 65
- minimum grade: A
- max risk cap: 0.25%
- confirmed bars required
- one open paper position per symbol

## TradingView webhook payload

The Hybrid AI Supercator already emits most of this structure. Prefer sending the richer contract below:

```json
{
  "signal_id": "MNQ-10-20260901-1000-S",
  "strategy_id": "hybrid_supercator",
  "strategy_version": "1.0",
  "action": "sell",
  "ticker": "MNQ1!",
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

Compile without applying:

```json
{ "text": "wait for ORB then trade signals either above or below on demo, max risk .25%", "apply": false }
```

Compile and apply:

```json
{ "text": "wait for ORB then trade signals either above or below on demo, max risk .25%", "apply": true }
```

Arm PAPER routing:

```json
{ "enabled": true, "mode": "PAPER" }
```

### TradingView signal ingestion

`POST /api/trading/guardian/alert`

The response contains:

- parsed legacy alert
- normalized rich alert
- guardian analysis
- active Juno plan
- deterministic plan evaluation
- PAPER order result

The PAPER order is created automatically only when the persisted plan is armed and its deterministic checks pass.

### Paper order ledger

- `GET /api/trading/juno/paper/orders`
- `POST /api/trading/juno/paper/orders/:id/close`

Example close payload:

```json
{ "exit": 29395.75, "pnl": 158.00, "status": "CLOSED", "reason": "TP1/managed exit" }
```

## Phase 2

After paper validation:

1. add TradingView strategy/version fields to every Pine webhook;
2. add lifecycle webhook events for TP1/TP2/TP3/SL;
3. reconcile PAPER orders against TradingView outcomes and Hybrid Journal;
4. add real broker adapter interfaces behind the same normalized order contract;
5. connect Kraken demo/test environment first where supported;
6. connect prop-platform demo accounts separately;
7. add account-level risk rules and max-drawdown controls;
8. enable LIVE only behind Juno Gateway explicit confirmation + account arming + kill switch.

## Principle

TradingView/Pine decides that a strategy signal exists. Juno does not freestyle a replacement strategy. Juno understands the signal, applies the current trading plan and account policy, routes eligible paper orders, explains every pass/block decision, and records the result for later strategy comparison.
