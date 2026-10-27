import { useMemo, useState } from "react";
import GoldCandleChart from "../components/GoldCandleChart";
import { analyseCandles, getSetupStage, makeTechnicalPlan, TIMEFRAMES } from "../lib/technicalAnalysis";
import { getGoldSession } from "../lib/goldSession";
import SignalReview from "../components/SignalReview";
import { RULE_VERSION } from "../lib/zoneConfirmation";
import PushNotifications from "../components/PushNotifications";
import TechnicalRiskPanel from "../components/TechnicalRiskPanel";
import TechnicalChartBoundary from "../components/TechnicalChartBoundary";
import useIndependentTimeframeHistory from "../hooks/useIndependentTimeframeHistory";

const money = value => Number.isFinite(value) ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
const stamp = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString() : "Not available";
const MAX_ANALYSIS_CANDLES = 1200;
const PRIMARY_ANALYSIS_INTERVAL = "1h";

function safeAnalyseCandles(rows, interval, now) {
  try {
    return analyseCandles(Array.isArray(rows) ? rows.slice(-MAX_ANALYSIS_CANDLES) : [], interval, now);
  } catch (error) {
    console.error(`Technical analysis failed for ${interval}:`, error);
    return { count: 0, interval, lastTime: null, ready: false, state: "Analysis unavailable", levels: [], zones: [],
      previousZones: [], confirmation: "None", move: null, risk: null, setup: null,
      error: true, marketStructure: { trend: "Unavailable", event: "No structure read", eventAt: null } };
  }
}

export default function TechnicalsPage({ dashboardData, currentTime, lastSuccessAt, dashboardError, goldPrice }) {
  const [chartInterval, setChartInterval] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('interval');
    return Object.hasOwn(TIMEFRAMES, requested) ? requested : '1h';
  });
  const [showWatchLevels, setShowWatchLevels] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showPreviousZones, setShowPreviousZones] = useState(false);
  const [chartRetry, setChartRetry] = useState(0);
  const { history, updates, audits, receiveChartCandles, receiveChartStatus, receiveAudit, refreshTimeframe } = useIndependentTimeframeHistory(chartInterval);
  const now = currentTime.getTime();
  const session = getGoldSession(now);
  const calculated = useMemo(() => safeAnalyseCandles(history[PRIMARY_ANALYSIS_INTERVAL], PRIMARY_ANALYSIS_INTERVAL, currentTime.getTime()), [history, currentTime]);
  const structureTimeframes = useMemo(() => Object.entries(TIMEFRAMES).map(([key]) => ({
    key,
    analysis: key === PRIMARY_ANALYSIS_INTERVAL ? calculated : history[key] ? safeAnalyseCandles(history[key], key, currentTime.getTime()) : null,
  })), [history, currentTime, calculated]);
  const audit = audits[PRIMARY_ANALYSIS_INTERVAL];
  const chartAnalysis = structureTimeframes.find(({ key }) => key === chartInterval)?.analysis;
  const versionMismatch = chartInterval === PRIMARY_ANALYSIS_INTERVAL && audit?.status === "saved" && audit.ruleVersion !== RULE_VERSION;
  const recorded = chartInterval === PRIMARY_ANALYSIS_INTERVAL && audit?.status === "saved" && !versionMismatch ? audit.analysis : null;
  const analysis = recorded ? { ...recorded, stale: now / 1000 - (recorded.lastTime + TIMEFRAMES[chartInterval].seconds) > Math.max(TIMEFRAMES[chartInterval].seconds * 2, 900) }
    : chartAnalysis || { count: 0, interval: chartInterval, lastTime: null, ready: false,
      state: updates[chartInterval]?.status === "error" ? "Analysis unavailable" : updates[chartInterval]?.status === "loading" ? "Loading timeframe…" : "No candles loaded",
      levels: [], zones: [], previousZones: [], confirmation: "None", move: null, risk: null, setup: null,
      marketStructure: { trend: "Not loaded", event: "Waiting for candle history", eventAt: null } };
  const chartZones = Array.isArray(chartAnalysis?.zones) ? chartAnalysis.zones : [];
  const chartPreviousZones = (chartAnalysis?.previousZones || []).slice(-2);
  const activeZones = Array.isArray(analysis.zones) ? analysis.zones : [];
  const previousZones = ["support", "resistance"].map(role => {
    const retired = (analysis.previousZones || []).filter(zone => zone.role === role);
    return retired.at(-1);
  }).filter(zone => zone && !activeZones.some(active => active.label === `${zone.role === "support" ? "Support" : "Resistance"} zone`
    && Math.abs((active.low + active.high) / 2 - (zone.low + zone.high) / 2) <= Math.max(active.high - active.low, zone.high - zone.low)));
  const hasSupport = activeZones.some(zone => zone.label === "Support zone" && zone.status === "active");
  const hasResistance = activeZones.some(zone => zone.label === "Resistance zone" && zone.status === "active");
  const calculatedPlan = makeTechnicalPlan(analysis, { isOpen: session.isOpen });
  const plan = versionMismatch ? { ...calculatedPlan, signal: "Wait", reason: "The backend still has the previous technical rules. Wait for both deployments to finish before using the technical signal." } : calculatedPlan;
  const setupStage = getSetupStage(analysis);
  const selectTimeframe = interval => {
    if (!Object.hasOwn(TIMEFRAMES, interval)) return;
    setChartInterval(interval);
    const refreshAfterMs = { "5min": 5 * 60_000, "1h": 15 * 60_000, "1day": 60 * 60_000 }[interval];
    const lastUpdated = updates[interval]?.updatedAt;
    if (!history[interval]?.length || updates[interval]?.status === "error" || !lastUpdated || now - lastUpdated >= refreshAfterMs) {
      void refreshTimeframe(interval, { force: true });
    }
  };
  const conciseReason = !session.isOpen ? "Market closed."
    : updates[chartInterval]?.status === "error" && !history[chartInterval]?.length ? "Could not load this timeframe. Use Retry timeframe."
      : updates[chartInterval]?.status === "loading" && !history[chartInterval]?.length ? "Loading this timeframe’s candles."
        : !analysis.ready ? "Waiting for completed candles."
      : analysis.stale ? "Candle data is delayed."
        : analysis.state === "Pullback developing" ? "Retest in progress; wait for a confirming close."
          : analysis.state?.includes("awaiting retest") ? "Break recorded; waiting for a later retest."
            : analysis.state === "Setup expired" ? "Setup expired; wait for a new break."
              : analysis.state === "Retest invalidated" ? "Retest invalidated by a completed close."
                : analysis.state?.startsWith("Risk filter") ? "Pattern rejected by the risk filter."
                  : plan.signal !== "Wait" ? "Closed-candle setup confirmed; macro stays separate."
                    : "No confirmed setup on this timeframe.";
  return (
    <div className="technical-terminal">
      <header className="terminal-brand">
        <div><span className="gold-bar-icon" aria-hidden="true">▰</span><div><strong><span>Trendline</span> Insight</strong><small>DATA · INSIGHTS · DISCIPLINE</small></div></div>
        <div className="terminal-symbol"><span>XAUUSD</span><time dateTime={currentTime.toISOString()}>{currentTime.toLocaleString()}</time></div>
      </header>
      <div className="terminal-intro"><h1>Technical Analysis</h1><p>Independent Daily, 1H, and 5M technical analysis. Macro stays separate.</p><p className="analysis-method">The selected timeframe controls the technical summary, chart, levels, and risk readout.</p></div>
      <div className="terminal-live-price"><div><span>XAUUSD · {session.isOpen ? "Latest price" : "Last available price"}</span><strong>{goldPrice ?? "—"}<small>USD / oz</small></strong></div><p>{!session.isOpen ? "Market closed · price held" : dashboardError || !Number.isFinite(dashboardData?.market?.xauusd?.price) || dashboardData?.market?.xauusd?.stale ? "Waiting for a fresh quote" : "Live price · checked every 30 seconds"}</p></div>
      <div className={`session-notice ${session.isOpen ? "" : "session-closed"}`} role="status">
        <span className="session-dot" /> <strong>{session.label}</strong>
        <span>{session.isOpen ? "Scheduled hours · New York time" : "Price readings paused · last available prices shown"}</span>
      </div>
      {dashboardData?.market?.xauusd?.priceSource === "saved_candle" && <p className="analysis-method">Saved candle reference · not a live quote or an official session close. Candle ended {new Date(dashboardData.market.xauusd.receivedAt).toLocaleString()}. Provider data can include out-of-session timestamps.</p>}
      <div className="data-receipts" aria-label="Data timestamps"><span>Quote received: <strong>{stamp(dashboardData?.market?.xauusd?.receivedAt)}</strong></span><span>Dashboard last received: <strong>{stamp(lastSuccessAt)}</strong></span><span>{TIMEFRAMES[chartInterval].label} candle analysed: <strong>{analysis.lastTime ? stamp((analysis.lastTime + TIMEFRAMES[chartInterval].seconds) * 1000) : "Not available"}</strong></span></div>
      {dashboardData?.market?.xauusd?.fallback && <p className="coverage-status">Quote fallback active · showing the last available price, not a fresh live quote.</p>}
      <section className="terminal-summary technical-only-summary" aria-label="Signal summary">
        <article className="terminal-card summary-card tone-neutral"><span className="terminal-eyebrow">↗ &nbsp; Technical State</span><h2>{analysis.state}</h2><p>{TIMEFRAMES[chartInterval].label} · selected analysis · completed candles</p><p>{analysis.state === "Between zones" ? "No confirmation yet" : analysis.stale ? "Delayed candle data" : "Volatility-adjusted break clearance"}</p></article>
        <article className={`terminal-card summary-card tone-${setupStage.tone}`}><span className="terminal-eyebrow">◉ &nbsp; Setup Stage</span><h2>{setupStage.label}</h2><p>{setupStage.detail}</p>{(analysis.stale || !session.isOpen || versionMismatch) && <p>Historical or unavailable for a fresh signal right now.</p>}</article>
        <article className={`terminal-card summary-card tone-${["Sell Watch", "Resistance Rejection"].includes(plan.signal) ? "down" : ["Buy Watch", "Support Bounce"].includes(plan.signal) ? "up" : "neutral"}`}><span className="terminal-eyebrow">◎ &nbsp; Technical Signal</span><h2 className="technical-signal">{plan.signal.toUpperCase()}</h2><p>{conciseReason}</p></article>
      </section>
      <section className="terminal-card read-panel">
        <div className="terminal-panel-title"><h2><span aria-hidden="true">▤</span> How to Read This</h2><span>DISCIPLINE WINS</span></div>
        <p>Wait for a completed-candle setup. Macro does not change technical signals.</p>
      </section>
      <section className="terminal-card market-structure-panel">
        <div className="terminal-panel-title"><h2>Market Structure</h2><span>INDEPENDENT TIMEFRAMES</span></div>
        <div className="structure-timeframe-grid">
          {structureTimeframes.map(({ key, analysis: context }) => <article key={key} className={key === chartInterval ? "structure-timeframe structure-selected" : "structure-timeframe"}>
            <span>{key === "1day" ? "Daily · Overall trend" : key === "1h" ? "1H · Primary setup" : "5M · Entry timing"}</span>
            <strong>{context?.marketStructure?.trend ?? (updates[key]?.status === "error" ? "Unavailable" : updates[key]?.status === "loading" ? "Loading…" : updates[key]?.status === "empty" ? "No candles" : "Not loaded")}</strong>
            <small>{context?.marketStructure?.event ?? (updates[key]?.status === "error" ? updates[key].error : updates[key]?.status === "loading" ? "Updating candles." : updates[key]?.status === "empty" ? "No saved candles are available for this timeframe." : "Waiting for candles.")}</small>
            {context?.marketStructure?.eventAt && <small>Break confirmed: {stamp(context.marketStructure.eventAt * 1000)}</small>}
            {updates[key]?.updatedAt && <small>Updated: {stamp(updates[key].updatedAt)}</small>}
            {updates[key]?.status === "error" && context && <small>Update failed; showing last good read.</small>}
            <button type="button" className="structure-load" aria-pressed={key === chartInterval} onClick={() => selectTimeframe(key)}>
              {key === chartInterval ? "Chart shown" : context ? "View timeframe" : updates[key]?.status === "loading" ? "Loading…" : "Retry timeframe"}
            </button>
          </article>)}
        </div>
      </section>
      <div className="terminal-chart-wrap">
        <label className="watch-toggle"><input type="checkbox" checked={showWatchLevels} onChange={event => setShowWatchLevels(event.target.checked)} />Show Buy / Sell Watch triggers</label>
        <label className="watch-toggle"><input type="checkbox" checked={showZones} onChange={event => setShowZones(event.target.checked)} />Show support / resistance zones</label>
        {chartPreviousZones.length > 0 && <label className="watch-toggle"><input type="checkbox" checked={showPreviousZones} onChange={event => setShowPreviousZones(event.target.checked)} />Show previous zones (inactive)</label>}
        <TechnicalChartBoundary key={`${chartInterval}-${chartRetry}`} onRetry={() => setChartRetry(value => value + 1)}>
          <GoldCandleChart zones={showZones ? [...chartZones, ...(showPreviousZones ? chartPreviousZones.map(zone => ({ ...zone, label: `${zone.label} · inactive` })) : [])] : []} interval={chartInterval} initialCandles={history[chartInterval] || []} initialLoadPending={updates[chartInterval]?.status === "loading"} onIntervalChange={selectTimeframe} onCandlesChange={receiveChartCandles} onHistoryStatus={receiveChartStatus} onAuditChange={receiveAudit} watchLevels={showWatchLevels ? chartAnalysis?.levels || [] : []} now={now} />
        </TechnicalChartBoundary>
      </div>
      <TechnicalRiskPanel risk={analysis.risk} />
      <section className="terminal-card timeframe-panel">
        <div className="terminal-panel-title"><h2>Timeframe Analysis</h2><span>COMPLETED CANDLES ONLY</span></div>
        <div className="timeframe-tabs" aria-label="Visible chart timeframe">{Object.entries(TIMEFRAMES).map(([key, value]) => <button key={key} aria-pressed={chartInterval === key} onClick={() => selectTimeframe(key)}>{value.label}</button>)}</div>
        <p className="technical-confirmation"><strong>Technical confirmation:</strong> {analysis.stale ? "Delayed data — historical confirmation only" : analysis.confirmation === "None" ? "Not confirmed" : analysis.confirmation} · independent of macro bias</p>
        <p className="technical-confirmation"><strong>{plan.signal === "Wait" ? "Why WAIT?" : "Why this watch?"}</strong> {plan.reason}</p>
        <p className="analysis-method">{TIMEFRAMES[chartInterval].label} analysis. Setups expire after 10 completed bars per stage; a closing candle can invalidate sooner.</p>
        {analysis.setup && <div className="technical-confirmation"><strong>{analysis.state}</strong> · {analysis.setup.barsRemaining} completed-bar step(s) until this phase expires.<br />{analysis.setup.type === "support-bounce" ? "Support approach candle opened" : analysis.setup.type === "resistance-rejection" ? "Resistance approach candle opened" : "Break candle opened"}: {stamp((analysis.setup.startTime ?? analysis.setup.breakTime) * 1000)}<br />{analysis.setup.type === "support-bounce" ? "Support touch" : analysis.setup.type === "resistance-rejection" ? "Resistance touch" : "First retest touch"}: {analysis.setup.touchedAt ? stamp((analysis.setup.touchedAt + TIMEFRAMES[chartInterval].seconds) * 1000) : "Still waiting"}<br />Confirmation: {analysis.setup.confirmedAt ? stamp((analysis.setup.confirmedAt + TIMEFRAMES[chartInterval].seconds) * 1000) : "Not confirmed"}<br /><small>Local times. The countdown is not a guaranteed entry window; invalidation can happen on the next completed candle.</small></div>}
        {analysis.ready && !recorded && <p className="analysis-method">{chartInterval === PRIMARY_ANALYSIS_INTERVAL ? "Provisional calculation · no verified saved decision is available for this response." : `Live ${TIMEFRAMES[chartInterval].label} calculation · based on its own completed saved candles.`}</p>}
        <div className="zone-readout">{activeZones.map(zone => <span key={zone.id || zone.label} style={{ color: zone.color }}>{zone.displayLabel || zone.label}: {money(zone.low)}–{money(zone.high)} · {zone.status || "active"}{Number.isFinite(zone.touches) ? ` · ${zone.touches} reactions` : ""}</span>)}{showPreviousZones && previousZones.map(zone => <span key={zone.id || zone.label} style={{ color: zone.color }}>{zone.label} · {zone.status || "previous"}: {money(zone.low)}–{money(zone.high)}</span>)}</div>
        <details className="zone-history-details"><summary>Zone identification and status times</summary>
          {[...activeZones, ...(analysis.previousZones || []).slice(-6)].map(zone => <p key={`${zone.id || zone.label}-times`}><strong>{zone.displayLabel || zone.label}</strong> · {zone.status || "active"} · identified {zone.identifiedAt ? stamp(zone.identifiedAt * 1000) : "time unavailable"} · status changed {zone.statusAt ? stamp(zone.statusAt * 1000) : "not recorded"}{zone.statusReason ? ` · ${zone.statusReason}` : ""}</p>)}
        </details>
        {activeZones.some(zone => zone.source === "forming") && <p className="analysis-method">Dashed potential support is a developing reference only. Support Bounce and Sell Watch still need confirmed active support.</p>}
        <p className="analysis-method">Support: {hasSupport ? "active" : "not confirmed"}. Resistance: {hasResistance ? "active" : "not confirmed"}. Previous zones are references only.</p>
        <div className="analysis-metrics"><div><span>Last completed close</span><strong>{money(analysis.close)}</strong></div><div><span>Window momentum</span><strong>{Number.isFinite(analysis.move) ? `${analysis.move > 0 ? "+" : ""}${analysis.move.toFixed(3)}%` : "—"}</strong></div><div><span>Support lower edge</span><strong>{money(analysis.support)}</strong></div><div><span>Resistance upper edge</span><strong>{money(analysis.resistance)}</strong></div><div><span>Support reactions</span><strong>{analysis.structure?.supportTouches ?? "—"}</strong></div><div><span>Resistance reactions</span><strong>{analysis.structure?.resistanceTouches ?? "—"}</strong></div><div><span>ATR · 14 candles</span><strong>{money(analysis.structure?.atr)}</strong></div><div><span>Market structure</span><strong>{analysis.marketStructure?.trend ?? "—"}</strong></div><div><span>Latest structure break</span><strong>{analysis.marketStructure?.event ?? "—"}</strong></div></div>
        <details className="analysis-method-details"><summary>How the technical rules work</summary>
          <p className="analysis-method">Zones use confirmed swings and repeated reactions. Support can qualify after two separated reactions plus a bullish return; otherwise three are required. Breakout watches need a closed-candle break beyond an ATR buffer, then a later retest and recovery. Bounce and rejection are separate setups. Previous zones cannot trigger signals. A structural stop, intact target and minimum 1.5:1 reward-to-risk are required. Macro never changes technical signals. These rules do not guarantee profit.</p>
        </details>
        {analysis.lastTime && <p className="analysis-method">Last {TIMEFRAMES[chartInterval].label} candle analysed opened: {new Date(analysis.lastTime * 1000).toUTCString()}</p>}
      </section>
      <section className="terminal-card trading-plan">
        <div className="terminal-panel-title"><h2><span aria-hidden="true">▣</span> Technical Setup</h2><span>PLAN › CONFIRM › REVIEW</span></div>
        <dl><div><dt>Setup Direction</dt><dd>{plan.preferred}</dd></div><div><dt>Confirmation</dt><dd>{plan.confirmation}</dd></div><div><dt>Invalidation</dt><dd>{plan.invalidation}</dd></div><div><dt>Current Decision</dt><dd><strong className="decision-pill">{plan.signal.toUpperCase()}</strong></dd></div></dl>
        <details className="analysis-method-details"><summary>Setup definitions</summary><p className="analysis-method">Support Bounce: support touch + bullish close. Resistance Rejection: resistance touch + bearish close. Buy Watch: resistance break + successful retest. Sell Watch: support break + failed retest. Macro stays separate; signals do not place trades.</p></details>
      </section>
      <PushNotifications now={now} />
      <SignalReview key={PRIMARY_ANALYSIS_INTERVAL} audit={audit} rows={history[PRIMARY_ANALYSIS_INTERVAL]} interval={PRIMARY_ANALYSIS_INTERVAL} now={now} />
      <section className="terminal-card upcoming-coverage" aria-labelledby="upcoming-coverage-title">
        <div className="terminal-panel-title"><h2 id="upcoming-coverage-title">News &amp; Market Context</h2><span>COMING NEXT</span></div>
        <p className="coverage-status"><strong>News risk: not assessed</strong> · Live coverage is not connected yet.</p>
        <div className="coverage-grid">
          <article><h3>Economic calendar</h3><p>Upcoming major releases, scheduled times and alerts for events relevant to gold.</p></article>
          <article><h3>DXY coverage</h3><p>Dedicated US Dollar Index prices and direction alongside gold. Separate from the broad dollar macro indicator.</p></article>
          <article><h3>Geopolitical news</h3><p>Time-stamped headlines with source links for developing events that may affect gold.</p></article>
        </div>
        <p className="analysis-method">Planned coverage, pending a suitable data provider. No news alerts are being sent. News coverage will remain separate from technical signals.</p>
      </section>
      <footer className="terminal-card terminal-footer"><span aria-hidden="true">◇</span><em>Technical signals use price action only.</em><small>MACRO IS SEPARATE</small></footer>
      <p className="session-footnote">Session estimate: Sunday 18:00–Friday 17:00, with a daily 17:00–18:00 break in New York. Daylight saving is applied automatically. Broker and holiday closures may differ.</p>
    </div>
  );
}
