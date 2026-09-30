import { useCallback, useState } from "react";
import GoldCandleChart from "../components/GoldCandleChart";
import { analyseCandles, makeTechnicalPlan, TIMEFRAMES } from "../lib/technicalAnalysis";
import { getGoldSession } from "../lib/goldSession";
import SignalReview from "../components/SignalReview";
import { RULE_VERSION } from "../lib/zoneConfirmation";

const money = value => Number.isFinite(value) ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
const stamp = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString() : "Not available";

export default function TechnicalsPage({ dashboardData, currentTime, lastSuccessAt, dashboardError, goldPrice }) {
  const [interval, setInterval] = useState("1h");
  const [history, setHistory] = useState({});
  const [showWatchLevels, setShowWatchLevels] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [audits, setAudits] = useState({});
  const receiveAudit = useCallback((timeframe, audit) => setAudits(previous => ({ ...previous, [timeframe]: audit })), []);
  const receiveCandles = useCallback((timeframe, candles) => setHistory(previous => ({ ...previous, [timeframe]: candles })), []);
  const now = currentTime.getTime();
  const session = getGoldSession(now);
  const calculated = analyseCandles(history[interval], interval, now);
  const audit = audits[interval];
  const versionMismatch = audit?.status === "saved" && audit.ruleVersion !== RULE_VERSION;
  const recorded = audit?.status === "saved" && !versionMismatch ? audit.analysis : null;
  const analysis = recorded ? { ...recorded, stale: now / 1000 - (recorded.lastTime + TIMEFRAMES[interval].seconds) > Math.max(TIMEFRAMES[interval].seconds * 2, 900) } : calculated;
  const calculatedPlan = makeTechnicalPlan(analysis, { isOpen: session.isOpen });
  const plan = versionMismatch ? { ...calculatedPlan, signal: "Wait", reason: "The backend still has the previous retest rules. Wait for both deployments to finish before using the technical signal." } : calculatedPlan;
  return (
    <div className="technical-terminal">
      <header className="terminal-brand">
        <div><span className="gold-bar-icon" aria-hidden="true">▰</span><div><strong><span>Gold</span> Terminal</strong><small>DATA · INSIGHTS · DISCIPLINE</small></div></div>
        <div className="terminal-symbol"><span>XAUUSD</span><time dateTime={currentTime.toISOString()}>{currentTime.toLocaleString()}</time></div>
      </header>
      <div className="terminal-intro"><h1>Technical Analysis</h1><p>Analysis timeframe: <strong>{TIMEFRAMES[interval].label}</strong> · signals use completed candles.</p><p className="analysis-method">The price checks every 30 seconds; that does not create a new candle confirmation. WAIT is a status, not an order button.</p></div>
      <div className="terminal-live-price"><div><span>XAUUSD · {session.isOpen ? "Latest price" : "Last available price"}</span><strong>{goldPrice ?? "—"}<small>USD / oz</small></strong></div><p>{!session.isOpen ? "Market closed · price held" : dashboardError || !Number.isFinite(dashboardData?.market?.xauusd?.price) || dashboardData?.market?.xauusd?.stale ? "Waiting for a fresh quote" : "Live price · checked every 30 seconds"}</p></div>
      <div className={`session-notice ${session.isOpen ? "" : "session-closed"}`} role="status">
        <span className="session-dot" /> <strong>{session.label}</strong>
        <span>{session.isOpen ? "Scheduled hours · New York time" : "Price readings paused · last available prices shown"}</span>
      </div>
      {dashboardData?.market?.xauusd?.priceSource === "saved_candle" && <p className="analysis-method">Saved candle reference · not a live quote or an official session close. Candle ended {new Date(dashboardData.market.xauusd.receivedAt).toLocaleString()}. Provider data can include out-of-session timestamps.</p>}
      <div className="data-receipts" aria-label="Data timestamps"><span>Quote received: <strong>{stamp(dashboardData?.market?.xauusd?.receivedAt)}</strong></span><span>Dashboard last received: <strong>{stamp(lastSuccessAt)}</strong></span><span>Analysed candle closed: <strong>{analysis.lastTime ? stamp((analysis.lastTime + TIMEFRAMES[interval].seconds) * 1000) : "Not available"}</strong></span></div>
      {dashboardData?.market?.xauusd?.fallback && <p className="coverage-status">Quote fallback active · showing the last available price, not a fresh live quote.</p>}
      <section className="terminal-summary technical-only-summary" aria-label="Signal summary">
        <article className="terminal-card summary-card tone-neutral"><span className="terminal-eyebrow">↗ &nbsp; Technical State</span><h2>{analysis.state}</h2><p>{TIMEFRAMES[interval].label} · completed candles</p><p>{analysis.state === "Between zones" ? "No confirmation yet" : analysis.stale ? "Delayed candle data" : "Break clearance >0.10%"}</p></article>
        <article className={`terminal-card summary-card tone-${plan.signal === "Sell Watch" ? "down" : plan.signal === "Buy Watch" ? "up" : "neutral"}`}><span className="terminal-eyebrow">◎ &nbsp; Technical Signal</span><h2 className="technical-signal">{plan.signal.toUpperCase()}</h2><p>{plan.reason}</p></article>
      </section>
      <section className="terminal-card read-panel">
        <div className="terminal-panel-title"><h2><span aria-hidden="true">▤</span> How to Read This</h2><span>DISCIPLINE WINS</span></div>
        <ol><li><strong>{analysis.state}</strong><span>{analysis.ready ? "A price break alone is not confirmation; a later completed candle must retest the frozen zone." : "Load this timeframe to calculate its levels."}</span></li><li><strong>Action</strong><span>{plan.reason}</span></li></ol>
      </section>
      <div className="terminal-chart-wrap">
        <label className="watch-toggle"><input type="checkbox" checked={showWatchLevels} onChange={event => setShowWatchLevels(event.target.checked)} />Show Buy / Sell Watch triggers</label>
        <label className="watch-toggle"><input type="checkbox" checked={showZones} onChange={event => setShowZones(event.target.checked)} />Show support / resistance zones</label>
        <GoldCandleChart zones={showZones ? analysis.zones : []} interval={interval} onIntervalChange={setInterval} onCandlesChange={receiveCandles} onAuditChange={receiveAudit} watchLevels={showWatchLevels ? analysis.levels : []} />
      </div>
      <section className="terminal-card timeframe-panel">
        <div className="terminal-panel-title"><h2>Timeframe Analysis</h2><span>COMPLETED CANDLES ONLY</span></div>
        <div className="timeframe-tabs" aria-label="Analysis timeframe">{Object.entries(TIMEFRAMES).map(([key, value]) => <button key={key} aria-pressed={interval === key} onClick={() => setInterval(key)}>{value.label}</button>)}</div>
        <p className="technical-confirmation"><strong>Technical confirmation:</strong> {analysis.stale ? "Delayed data — historical confirmation only" : analysis.confirmation === "None" ? "Not confirmed" : analysis.confirmation} · independent of macro bias</p>
        <p className="technical-confirmation"><strong>{plan.signal === "Wait" ? "Why WAIT?" : "Why this watch?"}</strong> {plan.reason}</p>
        <p className="analysis-method">Selected timeframe: {TIMEFRAMES[interval].label}. A retest can develop across several completed candles. There are separate limits of 10 bars to first touch, 10 bars from that touch to recovery, and 10 bars from confirmation. Repeated touches do not reset the clock. A close through the far zone edge still invalidates the setup; the zone boundary is not a recommended broker stop loss.</p>
        {analysis.setup && <div className="technical-confirmation"><strong>{analysis.state}</strong> · {analysis.setup.barsRemaining} completed-bar step(s) until this phase expires.<br />Break candle opened: {stamp(analysis.setup.breakTime * 1000)}<br />First retest touch: {analysis.setup.touchedAt ? stamp((analysis.setup.touchedAt + TIMEFRAMES[interval].seconds) * 1000) : "Still waiting"}<br />Confirmation: {analysis.setup.confirmedAt ? stamp((analysis.setup.confirmedAt + TIMEFRAMES[interval].seconds) * 1000) : "Not confirmed"}<br /><small>Local times. The countdown is not a guaranteed entry window; invalidation can happen on the next completed candle.</small></div>}
        {analysis.ready && !recorded && <p className="analysis-method">Provisional calculation · no verified saved decision is available for this response.</p>}
        <div className="zone-readout">{analysis.zones.map(zone => <span key={zone.label} style={{ color: zone.color }}>{zone.label}: {money(zone.low)}–{money(zone.high)}</span>)}</div>
        <div className="analysis-metrics"><div><span>Last completed close</span><strong>{money(analysis.close)}</strong></div><div><span>Window momentum</span><strong>{Number.isFinite(analysis.move) ? `${analysis.move > 0 ? "+" : ""}${analysis.move.toFixed(3)}%` : "—"}</strong></div><div><span>Support lower edge</span><strong>{money(analysis.support)}</strong></div><div><span>Resistance upper edge</span><strong>{money(analysis.resistance)}</strong></div></div>
        <p className="analysis-method">Zones use the previous 20 completed candles’ high and low, with bands based on a quarter of their average range (minimum 0.05% of price, capped to prevent overlap). A completed close must clear the outer edge by more than 0.10%. Zones and triggers freeze at the break. After a later candle touches the zone, that candle or a subsequent candle can confirm by closing beyond the same trigger. A confirmed watch pauses if a completed close falls back inside the trigger. Forming candles never confirm. These revised timing rules have not been validated for profitability.</p>
        {analysis.lastTime && <p className="analysis-method">Last analysed candle opened: {new Date(analysis.lastTime * 1000).toUTCString()}</p>}
      </section>
      <section className="terminal-card trading-plan">
        <div className="terminal-panel-title"><h2><span aria-hidden="true">▣</span> Technical Setup</h2><span>PLAN › CONFIRM › REVIEW</span></div>
        <dl><div><dt>Setup Direction</dt><dd>{plan.preferred}</dd></div><div><dt>Confirmation</dt><dd>{plan.confirmation}</dd></div><div><dt>Invalidation</dt><dd>{plan.invalidation}</dd></div><div><dt>Current Decision</dt><dd><strong className="decision-pill">{plan.signal.toUpperCase()}</strong></dd></div></dl>
        <p className="analysis-method">Buy Watch requires a breakout and successful retest; Sell Watch requires a support break and failed retest. These are watch conditions, not automatic entries or stop-loss instructions.</p>
      </section>
      <SignalReview key={interval} audit={audit} rows={history[interval]} interval={interval} now={now} />
      <section className="terminal-card upcoming-coverage" aria-labelledby="upcoming-coverage-title">
        <div className="terminal-panel-title"><h2 id="upcoming-coverage-title">News &amp; Market Context</h2><span>COMING NEXT</span></div>
        <p className="coverage-status"><strong>News risk: not assessed</strong> · Live coverage is not connected yet.</p>
        <div className="coverage-grid">
          <article><h3>Economic calendar</h3><p>Upcoming major releases, scheduled times and alerts for events relevant to gold.</p></article>
          <article><h3>DXY coverage</h3><p>Dedicated US Dollar Index prices and direction alongside gold. Separate from the broad dollar macro indicator.</p></article>
          <article><h3>Geopolitical news</h3><p>Time-stamped headlines with source links for developing events that may affect gold.</p></article>
        </div>
        <p className="analysis-method">Planned coverage, pending a suitable data provider. No alerts are being sent. News coverage will remain separate from technical signals.</p>
      </section>
      <footer className="terminal-card terminal-footer"><span aria-hidden="true">◇</span><em>Technical signals use price action only.</em><small>MACRO IS SEPARATE</small></footer>
      <p className="session-footnote">Session estimate: Sunday 18:00–Friday 17:00, with a daily 17:00–18:00 break in New York. Daylight saving is applied automatically. Broker and holiday closures may differ.</p>
    </div>
  );
}
