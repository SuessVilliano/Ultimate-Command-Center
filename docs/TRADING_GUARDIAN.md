# LIV8 Trading Guardian

The Trading Guardian is an advisory layer between raw TradingView/Hybrid AI alerts and any human trading decision.

## Source hierarchy
1. Hybrid AI Alert System — raw event source only.
2. Hybrid Journal — canonical signal/trade/session/performance store and QQE/market-cause intelligence.
3. MNQ Trading Bible — session, signal-quality, risk, and process rules.
4. QQE Framework — confluence/quality scoring.

## Hybrid AI alert lifecycle
The TradingView script emits exactly these messages:
- `BUY ENTRY {{ticker}} @ {{close}}`
- `SELL ENTRY {{ticker}} @ {{close}}`
- `TP1 HIT {{ticker}}`
- `TP2 HIT {{ticker}}`
- `TP3 HIT {{ticker}}`
- `STOP LOSS HIT {{ticker}}`

The raw ENTRY event comes from a 9/21 SMA crossover with ATR-derived SL/TP levels. It is a candidate, not approval.

## Qualification policy
Fresh ENTRY events may be enriched with Hybrid Journal QQE + current signal metadata and then evaluated against:
- active ET session window
- A+ signal grade
- 80%+ confidence
- sweep/reversal confirmation where applicable
- QQE score and directional bias
- VIX regime
- event proximity
- max 0.4% planned risk
- consecutive-loss circuit breaker
- 2–3 quality setups/day over-trading limit

TP and SL events are lifecycle/management events and do not create a new trade recommendation.

## Safety
The Guardian never places a live order. Live execution remains behind the dedicated Hybrid Journal confirmation gate.

## Routes
- `GET /api/trading/guardian/status`
- `POST /api/trading/guardian/parse-alert`
- `POST /api/trading/guardian/alert`
- `POST /api/trading/guardian/evaluate`

Example alert payload:
```json
{
  "message": "BUY ENTRY MNQ1! @ 23875.25",
  "riskPct": 0.4,
  "tradesToday": 1,
  "consecutiveLosses": 0
}
```
