import { getGoldSession } from "../lib/goldSession";
import { useEffect, useRef, useState } from "react";
import { candleWindow, mergeCandles, candlePriceBounds } from "../lib/candles";
import { requestHistory } from "../lib/historyRequest";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://gold-terminal-ufv4.onrender.com";
const EMPTY_LEVELS = [];
const stamp = time => new Date(time * 1000).toLocaleString("en-GB", {
  timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
});

export default function GoldCandleChart({ watchLevels = EMPTY_LEVELS, zones = EMPTY_LEVELS, interval: selectedInterval, onIntervalChange, onCandlesChange, onAuditChange }) {
  const [localInterval, setIntervalValue] = useState("5min");
  const interval = selectedInterval || localInterval;
  return (
    <section className="chart-panel candle-panel">
      <div className="chart-header candle-header">
        <div><span className="section-label">XAUUSD · Saved history</span><h3>Gold Candles</h3></div>
        <label className="candle-timeframe">Timeframe
          <select value={interval} onChange={event => (onIntervalChange || setIntervalValue)(event.target.value)}>
            <option value="5min">5 minutes</option><option value="1h">1 hour</option><option value="1day">1 day</option>
          </select>
        </label>
      </div>
      <CandleView key={interval} interval={interval} watchLevels={watchLevels} zones={zones} onCandlesChange={onCandlesChange} onAuditChange={onAuditChange} />
    </section>
  );
}

function CandleView({ interval, watchLevels, zones, onCandlesChange, onAuditChange }) {
  const [magnify, setMagnify] = useState(false);
  const [candles, setCandles] = useState([]);
  const [status, setStatus] = useState("Loading saved candles…");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [count, setCount] = useState(80);
  const [endTime, setEndTime] = useState(null);
  const [hover, setHover] = useState(null);
  const [width, setWidth] = useState(800);
  const chartRef = useRef(null);
  const dragRef = useRef(null);
  const olderRequest = useRef(null);
  const retryRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { onCandlesChange?.(interval, candles); }, [interval, candles, onCandlesChange]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let busy = false;
    let loadedClosed = false;
    let failures = 0;
    let followups = 0;
    let retryTimer;
    async function refresh(manual = false) {
      if (busy || (!manual && document.hidden)) return;
      const open = getGoldSession().isOpen;
      if (!open && loadedClosed && !manual) return;
      busy = true;
      clearTimeout(retryTimer);
      if (manual) { failures = 0; followups = 0; }
      setRefreshing(true);
      try {
        const data = await requestHistory(
          API_BASE_URL + "/api/market/gold/history?interval=" + interval,
          { signal: controller.signal },
        );
        if (active) {
          onAuditChange?.(interval, data.signalAudit ?? null);
          loadedClosed = !getGoldSession().isOpen;
          failures = 0;
          setCandles(previous => mergeCandles(previous, data.candles));
          setStatus(data.warning || (data.refreshing
            ? "Showing saved candles while newer prices refresh in the background."
            : data.candles.length ? "History saved in Atlas. Updates checked every 5 minutes."
              : "No candles available for this timeframe."));
          if (open && data.refreshing && followups < 10) {
            followups++;
            retryTimer = window.setTimeout(() => refresh(), 3000);
          } else { followups = 0; }
        }
      } catch (error) {
        if (active && error.name !== "AbortError") {
          failures++;
          const willRetry = getGoldSession().isOpen && failures <= 3;
          setStatus(error.message + (willRetry
            ? " Retrying automatically in 15 seconds. Any candles already loaded remain visible."
            : " Use Retry history to try again. Any candles already loaded remain visible."));
          if (willRetry) retryTimer = window.setTimeout(() => refresh(), 15000);
        }
      } finally {
        busy = false;
        if (active) setRefreshing(false);
      }
    }
    retryRef.current = () => refresh(true);
    const onVisible = () => { if (!document.hidden) refresh(); };
    // Schedule initial work after the effect is installed, just like subsequent retries.
    const initialTimer = window.setTimeout(() => refresh(), 0);
    const timer = window.setInterval(() => refresh(), 300000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      retryRef.current = null;
      controller.abort();
      olderRequest.current?.abort();
      window.clearTimeout(initialTimer);
      window.clearTimeout(retryTimer);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [interval, onAuditChange]);

  useEffect(() => {
    const element = chartRef.current;
    const observer = new ResizeObserver(entries => setWidth(Math.max(280, entries[0].contentRect.width)));
    observer.observe(element);
    function wheel(event) {
      event.preventDefault();
      setCount(value => Math.max(15, Math.min(250, Math.round(value * (event.deltaY > 0 ? 1.15 : 0.85)))));
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => { observer.disconnect(); element.removeEventListener("wheel", wheel); };
  }, []);

  async function loadOlder() {
    if (!candles.length || olderRequest.current) return;
    const before = candles[0].time;
    const controller = new AbortController();
    olderRequest.current = controller;
    setLoadingOlder(true);
    try {
      const data = await requestHistory(`${API_BASE_URL}/api/market/gold/history?interval=${interval}&before=${before}`, { signal: controller.signal });
      setCandles(previous => mergeCandles(data.candles, previous));
      setHasMore(data.candles.length > 0);
      if (data.candles.length) setEndTime(before);
      setStatus(data.warning || (data.candles.length ? "Older candles loaded and saved." : "No earlier candles are available from your data provider."));
    } catch (error) {
      if (error.name !== "AbortError") setStatus(error.message);
    } finally {
      if (!controller.signal.aborted) setLoadingOlder(false);
      olderRequest.current = null;
    }
  }

  const visible = candleWindow(candles, count, endTime);
  const selected = visible[hover] || visible[visible.length - 1];
  const plotWidth = width - 78;
  const plotHeight = 278;
  const bottom = 304;
  const lows = visible.map(candle => candle.low);
  const highs = visible.map(candle => candle.high);
  const low = visible.length ? Math.min(...lows) : 0;
  const high = visible.length ? Math.max(...highs) : 1;
  const { min, max, quiet } = candlePriceBounds(low, high, magnify);
  const y = price => bottom - ((price - min) / (max - min)) * plotHeight;
  const step = plotWidth / Math.max(1, visible.length);
  const x = index => 8 + (index + 0.5) * step;
  const levels = watchLevels.filter(level => Number.isFinite(level.price) && level.price > 0);

  function moveBy(amount) {
    if (!candles.length) return;
    const current = endTime === null ? candles.length - 1 : candles.findLastIndex(candle => candle.time <= endTime);
    const target = Math.max(Math.min(count, candles.length) - 1, Math.min(candles.length - 1, current + amount));
    setEndTime(target === candles.length - 1 ? null : candles[target].time);
    setHover(null);
  }
  function pointerMove(event) {
    const rect = chartRef.current.getBoundingClientRect();
    const position = (event.clientX - rect.left) * width / rect.width;
    setHover(Math.max(0, Math.min(visible.length - 1, Math.floor((position - 8) / step))));
    if (dragRef.current) {
      const delta = Math.trunc((event.clientX - dragRef.current.x) / step);
      if (delta) { moveBy(-delta); dragRef.current.x = event.clientX; }
    }
  }

  return (
    <>
      <div className="candle-toolbar" aria-label="Chart controls">
        <button type="button" onClick={() => retryRef.current?.()} disabled={refreshing}>{refreshing ? "Checking history…" : "Retry history"}</button>
        <button type="button" onClick={loadOlder} disabled={!candles.length || loadingOlder || !hasMore}>{loadingOlder ? "Loading…" : "Load older history"}</button>
        <button type="button" aria-label="Pan to earlier candles" onClick={() => moveBy(-Math.round(count / 2))} disabled={!candles.length}>← Earlier</button>
        <button type="button" aria-label="Pan to later candles" onClick={() => moveBy(Math.round(count / 2))} disabled={endTime === null}>Later →</button>
        <button type="button" aria-label="Zoom in" onClick={() => setCount(value => Math.max(15, Math.round(value / 1.4)))}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => setCount(value => Math.min(250, Math.round(value * 1.4)))}>−</button>
        <button type="button" onClick={() => { setEndTime(null); setCount(80); setHover(null); }}>Latest</button>
      </div>
      <div className="candle-ohlc" aria-live="off">
        {selected ? <><span>{stamp(selected.time)} UTC</span><span>O {selected.open.toFixed(2)}</span><span>H {selected.high.toFixed(2)}</span><span>L {selected.low.toFixed(2)}</span><span>C {selected.close.toFixed(2)}</span></> : "Waiting for historical prices…"}
      </div>
      <label className="watch-toggle"><input type="checkbox" checked={magnify} onChange={event => setMagnify(event.target.checked)} />Magnify small price moves</label>
      {visible.length > 0 && quiet && <p className="candle-hint">Narrow visible range: ${(high - low).toFixed(2)}. {magnify ? "Small movements are magnified." : "Scale kept at a minimum 0.10% range to avoid exaggerating tiny moves."}</p>}
      <div ref={chartRef} className="candle-surface" tabIndex={0} role="group" aria-label="Gold candlestick chart. Use arrow keys to pan and plus or minus to zoom."
        onKeyDown={event => {
          if (["ArrowLeft", "ArrowRight", "+", "=", "-"].includes(event.key)) event.preventDefault();
          if (event.key === "ArrowLeft") moveBy(-10);
          if (event.key === "ArrowRight") moveBy(10);
          if (event.key === "+" || event.key === "=") setCount(value => Math.max(15, value - 10));
          if (event.key === "-") setCount(value => Math.min(250, value + 10));
        }}>
        <svg width="100%" height="340" viewBox={`0 0 ${width} 340`} role="img" aria-label={`${visible.length} ${interval} gold candles`}
          onPointerDown={event => { dragRef.current = { x: event.clientX }; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={pointerMove} onPointerUp={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }} onPointerLeave={() => { if (!dragRef.current) setHover(null); }}>
          {Array.from({ length: 5 }, (_, index) => {
            const price = min + (max - min) * index / 4;
            return <g key={index}><line x1="8" x2={plotWidth + 8} y1={y(price)} y2={y(price)} stroke="#292929" /><text x={plotWidth + 15} y={y(price) + 4} fill="#999" fontSize="11">{price.toFixed(2)}</text></g>;
          })}
          {zones.filter(zone => Number.isFinite(zone.low) && Number.isFinite(zone.high) && zone.high >= min && zone.low <= max).map(zone => <g key={zone.label}>
            <rect x="8" y={y(Math.min(max, zone.high))} width={plotWidth} height={Math.max(1, y(Math.max(min, zone.low)) - y(Math.min(max, zone.high)))} fill={zone.color} fillOpacity="0.12" stroke={zone.color} strokeOpacity="0.4" />
            <text x="12" y={Math.min(bottom - 4, y(Math.min(max, zone.high)) + 13)} fill={zone.color} fontSize="11">{zone.label}</text>
          </g>)}
          {visible.map((candle, index) => {
            const color = candle.close >= candle.open ? "#70d69c" : "#ef7b7b";
            return <g key={candle.time}><line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)} stroke={color} /><rect x={x(index) - Math.max(1, step * 0.65) / 2} y={Math.min(y(candle.open), y(candle.close))} width={Math.max(1, step * 0.65)} height={Math.max(1, Math.abs(y(candle.open) - y(candle.close)))} fill={color} /></g>;
          })}
          {levels.filter(level => level.price >= min && level.price <= max).map(level => <g key={level.label}>
            <line x1="8" x2={plotWidth + 8} y1={y(level.price)} y2={y(level.price)} stroke={level.color} strokeDasharray="6 5" />
            <text x="12" y={Math.max(14, y(level.price) - 5)} fill={level.color} stroke="#141414" strokeWidth="3" paintOrder="stroke" fontSize="12">{level.label} {level.price.toFixed(2)}</text>
          </g>)}
          {hover !== null && visible[hover] && <g><line x1={x(hover)} x2={x(hover)} y1="26" y2={bottom} stroke="#888" strokeDasharray="3 4" /><line x1="8" x2={plotWidth + 8} y1={y(visible[hover].close)} y2={y(visible[hover].close)} stroke="#888" strokeDasharray="3 4" /></g>}
          {visible.length > 0 && <><text x="8" y="330" fill="#999" fontSize="11">{stamp(visible[0].time)}</text><text x={plotWidth + 8} y="330" textAnchor="end" fill="#999" fontSize="11">{stamp(visible[visible.length - 1].time)}</text></>}
        </svg>
      </div>
      <p className="candle-status" role="status">{status}</p>
      <p className="candle-hint">{candles.length} candles loaded · UTC · Drag to pan, scroll to zoom. Analysis uses completed candles. The newest candle may still be forming.</p>
      {zones.length > 0 && <div className="candle-levels">{zones.map(zone => <span key={zone.label} style={{ color: zone.color }}>{zone.label}: {zone.low.toFixed(2)}–{zone.high.toFixed(2)}{zone.high < min || zone.low > max ? " (outside view)" : ""}</span>)}</div>}
      {levels.length > 0 && <div className="candle-levels">{levels.map(level => <span key={level.label} style={{ color: level.color }}>{level.label}: {level.price.toFixed(2)}{level.price < min || level.price > max ? " (outside view)" : ""}</span>)}</div>}
    </>
  );
}
