import { useCallback, useState } from "react";
import GoldCandleChart from "../components/GoldCandleChart";
import { analyseCandles, makeTradingPlan, TIMEFRAMES } from "../lib/technicalAnalysis";
import { getGoldSession } from "../lib/goldSession";

const money = value => Number.isFinite(value) ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

export default function TechnicalsPage({ dashboardData, currentTime, lastSuccessAt, dashboardError, goldPrice }) {
  const [interval, setInterval] = useState("5min");
  const [history, setHistory] = useState({});
  const [showWatchLevels, setShowWatchLevels] = useState(true);
  const receiveCandles = useCallback((timeframe, candles) => setHistory(previous => ({ ...previous, [timeframe]: candles })), []);
  const now = currentTime.getTime();
  const session = getGoldSession(now);
  const score = dashboardData?.gold?.score;
  const macro = score?.bias || "Unavailable";
  const macroFresh = Boolean(score && lastSuccessAt && now - lastSuccessAt <= 90000 && !dashboardError);
  const analysis = analyseCandles(history[interval], interval, now);
  const plan = makeTradingPlan(macro, analysis, { isOpen: session.isOpen, macroFresh });
  const macroTone = macro === "Bearish" ? "down" : macro === "Bullish" ? "up" : "neutral";
  const directionText = macro === "Bearish" ? "Background pressure favours lower prices."
    : macro === "Bullish" ? "Background conditions favour higher prices." : "The macro picture does not provide a clear directional bias.";
  return (
    <div className="technical-terminal">
      <header className="terminal-brand">
        <div><span className="gold-bar-icon" aria-hidden="true">▰</span><div><strong><span>Gold</span> Terminal</strong><small>DATA · INSIGHTS · DISCIPLINE</small></div></div>
        <div className="terminal-symbol"><span>XAUUSD</span><time dateTime={currentTime.toISOString()}>{currentTime.toLocaleString()}</time></div>
      </header>
      <div className="terminal-intro"><h1>Macro + Technical Signal</h1><p>Combine the bigger picture with completed-candle confirmation.</p></div>
      <div className="terminal-live-price"><div><span>XAUUSD · {session.isOpen ? "Latest price" : "Last available price"}</span><strong>{goldPrice ?? "—"}<small>USD / oz</small></strong></div><p>{!session.isOpen ? "Market closed · price held" : dashboardError || !Number.isFinite(dashboardData?.market?.xauusd?.price) || dashboardData?.market?.xauusd?.stale ? "Waiting for a fresh quote" : "Live price · checked every 30 seconds"}</p></div>
      <div className={`session-notice ${session.isOpen ? "" : "session-closed"}`} role="status">
        <span className="session-dot" /> <strong>{session.label}</strong>
        <span>{session.isOpen ? "Scheduled hours · New York time" : "Price readings paused · last available prices shown"}</span>
      </div>
      {dashboardData?.market?.xauusd?.priceSource === "saved_candle" && <p className="analysis-method">Saved candle reference · not a live quote or an official session close. Candle ended {new Date(dashboardData.market.xauusd.receivedAt).toLocaleString()}. Provider data can include out-of-session timestamps.</p>}
      <section className="terminal-summary" aria-label="Signal summary">
        <article className={`terminal-card summary-card tone-${macroTone}`}><span className="terminal-eyebrow">▥ &nbsp; Macro Bias</span><h2>{macro}</h2><strong className="macro-total">{Number.isFinite(score?.totalScore) ? `${score.totalScore > 0 ? "+" : ""}${score.totalScore}` : "—"}<small> / {score?.maxScore ?? 20}</small></strong>{!macroFresh && <p>Awaiting a current macro update</p>}</article>
        <article className="terminal-card summary-card tone-neutral"><span className="terminal-eyebrow">↗ &nbsp; Technical State</span><h2>{analysis.state}</h2><p>{TIMEFRAMES[interval].label} · completed candles</p><p>{analysis.state === "Between Levels" ? "No confirmation yet" : analysis.stale ? "Delayed candle data" : "Noise filter ±0.10%"}</p></article>
        <article className={`terminal-card summary-card tone-${plan.signal === "Sell Watch" ? "down" : plan.signal === "Buy Watch" ? "up" : "neutral"}`}><span className="terminal-eyebrow">◎ &nbsp; Combined Signal</span><h2 className="combined-signal">{plan.signal.toUpperCase()}</h2><p>{plan.reason}</p></article>
      </section>
      <section className="terminal-card read-panel">
        <div className="terminal-panel-title"><h2><span aria-hidden="true">▤</span> How to Read This</h2><span>DISCIPLINE WINS</span></div>
        <ol><li><strong className={`text-${macroTone}`}>{macro} macro</strong><span>{directionText}</span></li><li><strong>{analysis.state}</strong><span>{analysis.ready ? "Compare the last completed close with the watch levels." : "Load this timeframe to calculate its levels."}</span></li><li><strong>Action</strong><span>{plan.reason}</span></li></ol>
      </section>
      <div className="terminal-chart-wrap">
        <label className="watch-toggle"><input type="checkbox" checked={showWatchLevels} onChange={event => setShowWatchLevels(event.target.checked)} />Show Buy / Sell Watch lines</label>
        <GoldCandleChart interval={interval} onIntervalChange={setInterval} onCandlesChange={receiveCandles} watchLevels={showWatchLevels ? analysis.levels : []} />
      </div>
      <section className="terminal-card timeframe-panel">
        <div className="terminal-panel-title"><h2>Timeframe Analysis</h2><span>COMPLETED CANDLES ONLY</span></div>
        <div className="timeframe-tabs" aria-label="Analysis timeframe">{Object.entries(TIMEFRAMES).map(([key, value]) => <button key={key} aria-pressed={interval === key} onClick={() => setInterval(key)}>{value.label}</button>)}</div>
        <div className="analysis-metrics"><div><span>Last completed close</span><strong>{money(analysis.close)}</strong></div><div><span>Window momentum</span><strong>{Number.isFinite(analysis.move) ? `${analysis.move > 0 ? "+" : ""}${analysis.move.toFixed(3)}%` : "—"}</strong></div><div><span>Window low / support</span><strong>{money(analysis.support)}</strong></div><div><span>Window high / resistance</span><strong>{money(analysis.resistance)}</strong></div></div>
        <p className="analysis-method">{analysis.count} of up to 20 completed {TIMEFRAMES[interval].label.toLowerCase()} candles. Watch levels are ±0.10% from the first close in this window; the exact boundaries remain neutral. Levels roll as candles complete. Highs and lows are reference levels, not guaranteed support or resistance.</p>
        {analysis.lastTime && <p className="analysis-method">Last analysed candle opened: {new Date(analysis.lastTime * 1000).toUTCString()}</p>}
      </section>
      <section className="terminal-card trading-plan">
        <div className="terminal-panel-title"><h2><span aria-hidden="true">▣</span> Trading Plan</h2><span>PLAN › CONFIRM › REVIEW</span></div>
        <dl><div><dt>Preferred Direction</dt><dd className={`text-${macroTone}`}>{plan.preferred}</dd></div><div><dt>Confirmation</dt><dd>{plan.confirmation}</dd></div><div><dt>Invalidation</dt><dd>{plan.invalidation}</dd></div><div><dt>Current Decision</dt><dd><strong className="decision-pill">{plan.signal.toUpperCase()}</strong></dd></div></dl>
        <p className="analysis-method">Confirmation uses the selected timeframe’s completed close. These are watch conditions, not automatic entries or stop-loss instructions.</p>
      </section>
      <footer className="terminal-card terminal-footer"><span aria-hidden="true">◇</span><em>Macro gives bias. Technicals give timing.</em><small>WAIT FOR ALIGNMENT</small></footer>
      <p className="session-footnote">Session estimate: Sunday 18:00–Friday 17:00, with a daily 17:00–18:00 break in New York. Daylight saving is applied automatically. Broker and holiday closures may differ.</p>
    </div>
  );
}
