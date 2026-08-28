# Hybrid AI Alert Source Notes

Source document: `Hybrid Ai Alert System.pdf` supplied by the user.

The TradingView Pine Script defines `Hybrid AI – Signals + TP/SL Alerts` and uses:
- ATR length 14
- TP multipliers 1R / 2R / 3R
- SMA 9 as fast average
- SMA 21 as slow average
- buy = SMA 9 crossing above SMA 21
- sell = SMA 9 crossing below SMA 21

Trade state lifecycle:
- 0 no trade
- 1 active
- 2 TP1 hit
- 3 TP2 hit
- 4 TP3 hit / closed

For BUY entries, stop is one ATR below entry and TP1/2/3 are +1/+2/+3 ATR. SELL mirrors the structure above entry / below entry.

Alerts emitted:
- `BUY ENTRY {{ticker}} @ {{close}}`
- `SELL ENTRY {{ticker}} @ {{close}}`
- `TP1 HIT {{ticker}}`
- `TP2 HIT {{ticker}}`
- `TP3 HIT {{ticker}}`
- `STOP LOSS HIT {{ticker}}`

Command Center policy: this script supplies raw market events. It does not itself supply the A+ grade, 80% confidence, QQE score, sweep context, event-risk context, or risk-state information required for Guardian qualification.
