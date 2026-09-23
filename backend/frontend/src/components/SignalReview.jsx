import { useState } from "react";
import { backtestCandles, riskReward } from "../lib/technicalBacktest";

const stamp = value => value ? new Date(value).toLocaleString() : "Not available";
export default function SignalReview({ audit, rows, interval, now }) {
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState("buy");
  const [cost, setCost] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const ratio = riskReward(Number(entry), Number(stop), Number(target), direction);
  function replay(event) {
    event.preventDefault();
    try {
      if (cost.trim() === "") throw Error("Enter round-trip costs first; use 0 only for an explicit cost-free test.");
      setResult({ ...backtestCandles(rows || [], interval, { now, cost: Number(cost) }), ranAt: Date.now(), cost: Number(cost) });
      setError("");
    } catch (failure) { setError(failure.message); setResult(null); }
  }
  return <section className="terminal-card signal-review">
    <div className="terminal-panel-title"><h2>Signal Review</h2><span>VERIFY THE SETUP</span></div>
    <p className="coverage-status"><strong>Audit: {audit?.status === "saved" ? "Saved in Atlas" : audit?.status === "collecting" ? "Collecting completed candles" : "Not available"}</strong></p>
    {audit?.warning && <p className="analysis-method">{audit.warning}</p>}
    {audit?.revisedInput && <p className="coverage-status">Candle inputs changed after the first record. The original recorded decision is retained.</p>}
    <p className="analysis-method">First observed: {stamp(audit?.observedAt)}. Records start when the website requests this timeframe; this is not continuous market monitoring. Macro context is recorded only when available at observation time.</p>
    <details><summary>Recent recorded decisions</summary><ul className="audit-records">{audit?.recent?.length ? audit.recent.map(record => <li key={record.key}><time>{stamp(record.observedAt)}</time><strong>{record.analysis.confirmation === "None" ? "No confirmation" : record.analysis.confirmation}</strong><span>{record.analysis.state} · Macro: {record.macro?.bias || "Not captured"} · Combined: {record.combinedSignal || "Not recorded"}</span></li>) : <li>No saved records returned yet.</li>}</ul></details>
    <details><summary>Risk-to-reward calculator</summary>
      <p className="analysis-method">Enter your own planned prices. This calculator does not choose an entry, stop or target.</p>
      <div className="review-fields"><label>Direction<select value={direction} onChange={e => setDirection(e.target.value)}><option value="buy">Buy</option><option value="sell">Sell</option></select></label>{[["Entry", entry, setEntry], ["Stop", stop, setStop], ["Target", target, setTarget]].map(([label, value, update]) => <label key={label}>{label}<input type="number" min="0.01" step="any" value={value} onChange={e => update(e.target.value)} /></label>)}</div>
      <p role="status">{ratio ? `Risk : reward = 1 : ${ratio.ratio.toFixed(2)} before costs` : "Enter prices with the stop on the risk side and the target on the reward side."}</p>
    </details>
    <details><summary>Replay loaded candles</summary>
      <p className="analysis-method">Technical-only experiment: next-candle open entry after confirmation, hard stop at the opposite edge of the retested zone, 2R target, maximum 10 candles held, one position at a time. If both stop and target are touched, stop is assumed first. Gaps through stops fill at the opening price. Entries follow the estimated session schedule. Uses completed loaded candles only; no current macro bias or news filter is applied.</p>
      <form onSubmit={replay} className="review-fields"><label>Round-trip spread + slippage + fees (USD/oz)<input required type="number" min="0" step="any" value={cost} onChange={e => { setCost(e.target.value); setResult(null); }} /></label><button type="submit">Run offline replay</button></form>
      {error && <p role="alert">{error}</p>}
      {result && <div role="status"><p>{result.candleCount} candles · {result.trades.length} closed trades · {result.winRate === null ? "No win rate yet" : `${result.winRate.toFixed(1)}% win rate`} · {result.netR.toFixed(2)} net R</p><p className="analysis-method">Cost: ${result.cost}/oz per trade. Run at {stamp(result.ranAt)}. {result.openTrade ? "One unfinished trade excluded from results." : "No unfinished trade."} Fixed sample from this run; rerun after loading more history. Results depend on feed quality and the selected history window. Macro-filtered backtesting awaits point-in-time macro data.</p></div>}
    </details>
  </section>;
}
