import { useState } from "react";

function riskReward(entry, stop, target, direction) {
  if (![entry, stop, target].every(value => Number.isFinite(value) && value > 0)) return null;
  const sign = direction === "buy" ? 1 : direction === "sell" ? -1 : 0;
  const risk = (entry - stop) * sign, reward = (target - entry) * sign;
  return sign && risk > 0 && reward > 0 ? { risk, reward, ratio: reward / risk } : null;
}

const stamp = value => value ? new Date(value).toLocaleString() : "Not available";
export default function SignalReview({ audit }) {
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState("buy");
  const ratio = riskReward(Number(entry), Number(stop), Number(target), direction);
  return <section className="terminal-card signal-review">
    <div className="terminal-panel-title"><h2>Signal Review</h2><span>VERIFY THE SETUP</span></div>
    <p className="coverage-status"><strong>Technical log: {audit?.status === "saved" ? "Recorded" : audit?.status === "collecting" ? "Waiting for completed candles" : "Unavailable"}</strong></p>
    {audit?.warning && <p className="analysis-method">{audit.warning}</p>}
    <details><summary>About the technical log</summary>
      {audit?.revisedInput && <p className="analysis-method">Candle inputs changed after the first record. The original recorded decision is retained.</p>}
      <p className="analysis-method">First observed: {stamp(audit?.observedAt)}. Records start when this timeframe is opened; this is not continuous market monitoring. The log records technical signals only; macro remains separate.</p>
    </details>
    <details><summary>Recent recorded decisions</summary><ul className="audit-records">{audit?.recent?.length ? audit.recent.map(record => <li key={record.key}><time>{stamp(record.observedAt)}</time><strong>{record.analysis.confirmation === "None" ? "No confirmation" : record.analysis.confirmation}</strong><span>{record.analysis.state} · Technical status: {record.technicalSignal || "Legacy record"} · {record.ruleVersion || "Earlier rules"}</span></li>) : <li>No saved records returned yet.</li>}</ul></details>
    <details><summary>Risk-to-reward calculator</summary>
      <p className="analysis-method">Enter your own planned prices. This calculator does not choose an entry, stop or target.</p>
      <div className="review-fields"><label>Direction<select value={direction} onChange={e => setDirection(e.target.value)}><option value="buy">Buy</option><option value="sell">Sell</option></select></label>{[["Entry", entry, setEntry], ["Stop", stop, setStop], ["Target", target, setTarget]].map(([label, value, update]) => <label key={label}>{label}<input type="number" min="0.01" step="any" value={value} onChange={e => update(e.target.value)} /></label>)}</div>
      <p role="status">{ratio ? `Risk : reward = 1 : ${ratio.ratio.toFixed(2)} before costs` : "Enter prices with the stop on the risk side and the target on the reward side."}</p>
    </details>
  </section>;
}
