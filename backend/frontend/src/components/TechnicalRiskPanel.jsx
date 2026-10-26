import { useState } from "react";
import { estimatePositionSize } from "../lib/technicalRisk.js";

const price = value => Number.isFinite(value) ? value.toFixed(2) : "—";

export default function TechnicalRiskPanel({ risk }) {
  const [balance, setBalance] = useState("");
  const [riskPercent, setRiskPercent] = useState("");
  const size = risk?.stop && risk?.entry
    ? estimatePositionSize({ balance: Number(balance), riskPercent: Number(riskPercent), stopDistance: Math.abs(risk.entry - risk.stop) })
    : null;
  return <section className="terminal-card technical-risk-panel">
    <div className="terminal-panel-title"><h2>Risk Assessment</h2><span>STRUCTURE · VOLATILITY · SIZE</span></div>
    {risk ? <>
      <p className={`risk-result ${risk.qualified ? "risk-qualified" : "risk-rejected"}`} role="status">{risk.reason}</p>
      <div className="risk-metrics">
        <div><span>Proposed entry area</span><strong>{risk.entryArea ? `${price(risk.entryArea.low)} – ${price(risk.entryArea.high)}` : "—"}</strong></div>
        <div><span>Structural stop reference</span><strong>{price(risk.stop)}</strong></div>
        <div><span>Next structure target</span><strong>{price(risk.target)}</strong></div>
        <div><span>Reward : risk</span><strong>{Number.isFinite(risk.rewardRisk) ? `${risk.rewardRisk.toFixed(2)} : 1` : "Unavailable"}</strong></div>
        <div><span>ATR · volatility</span><strong>{price(risk.atr)} ({Number.isFinite(risk.atrPercent) ? `${risk.atrPercent.toFixed(2)}%` : "—"})</strong></div>
      </div>
      <details className="position-size-details">
        <summary>Estimate position size</summary>
        <p>Enter your own account figures. The estimate uses the stop distance in USD per ounce; verify your broker’s contract and lot units before using it.</p>
        <div className="review-fields">
          <label>Account balance (USD)<input type="number" min="0.01" step="any" value={balance} onChange={event => setBalance(event.target.value)} /></label>
          <label>Maximum account risk (%)<input type="number" min="0.01" max="100" step="0.01" value={riskPercent} onChange={event => setRiskPercent(event.target.value)} /></label>
        </div>
        {size && <p role="status">Risk budget: ${size.riskBudget.toFixed(2)} · Estimated size: {size.estimatedOunces.toFixed(3)} oz.</p>}
      </details>
    </> : <p className="analysis-method">A completed technical pattern must form before its entry area, structural stop and next-zone target can be assessed. Setups below {"1.5 : 1"} reward to risk remain WAIT.</p>}
    <p className="risk-disclaimer">Illustrative technical levels only. Stops can be slipped or exceeded; this estimate does not place an order or guarantee an outcome.</p>
  </section>;
}
