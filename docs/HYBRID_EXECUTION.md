# Command Center — Hybrid Execution Integration

`command.liv8.co` is the primary trading cockpit. The existing Trading Command Center and Trading Guardian remain the operating surface and safety boundary; Kraken is added behind them as another execution adapter.

Shared browser helpers: `src/lib/hybrid-execution.js`.

## Existing architecture to preserve

The Trading Command Center already has Hybrid Journal status/snapshot/analysis, an order text area, order preview, and explicit `CONFIRM_LIVE_TRADE` execution flow. The Trading Guardian is intentionally advisory-only today. This integration keeps those controls instead of creating a second trading path.

## Target trading tab

The trading tab should expose:

- broker/account selector
- broker capability and health status
- paper/live mode
- balances and buying power
- open positions
- working orders
- text-to-trade composer
- push-to-talk trade command
- parsed TradeIntent preview
- Trading Guardian/risk decision
- order readback
- explicit live confirmation where required
- order/fill status
- global cancel/flatten controls
- links to the corresponding Hybrid Journal record

## Routing

Command Center does not decide that every trade belongs on Kraken. It creates a broker-neutral TradeIntent and the execution layer validates the requested broker/account/instrument.

Examples:

- BTCUSD spot -> Kraken
- EURUSD/CFD -> cTrader-compatible adapter
- MNQ/NQ -> Tradovate/CrossTrade/Ninja-compatible adapter

## Talk-to-trade

`listenForTradeCommand()` captures speech where supported. The transcript is passed through the same parser, guardian and preview path as typed text. Voice never bypasses confirmation or risk policy.

## Kraken MCP

The official Kraken MCP process stays on a controlled server/execution node and is not exposed directly to the browser. Command Center calls the Hybrid Execution Gateway. This avoids duplicating Kraken credentials across products and preserves a single audit/risk path.

## Rollout

1. Show Kraken capabilities/health in the trading tab.
2. Enable Kraken market/account reads and paper order previews.
3. Verify Journal events and broker state after every paper action.
4. Enable guarded live Kraken execution for an explicitly selected account.
5. Add controlled position-management commands.
6. Add additional broker adapters behind the same TradeIntent contract.

## Safety

Keep the existing preview + explicit confirmation path for live orders. The deterministic Trading Guardian/risk layer is the final authority, not the LLM. Broker funding/withdrawal permissions are outside the trading-agent permission set.
