import { getGoldSession } from "../lib/goldSession";
import { useEffect, useRef, useState } from "react";
import { candleWindow, mergeCandles, candlePriceBounds } from "../lib/candles";
import { requestHistory } from "../lib/historyRequest";
import { clampCount, panWindow, olderPage } from "../lib/chartNavigation";

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
  const [magnify, setMagnify] = useState(true);
  const [fitLevels, setFitLevels] = useState(false);
  const [candles, setCandles] = useState([]);
  const [status, setStatus] = useState("Loading saved candles…");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [count, setCount] = useState(() => typeof window !== "undefined" && window.innerWidth < 600 ? 40 : 80);
  const [endTime, setEndTime] = useState(null);
  const [hover, setHover] = useState(null);
  const [width, setWidth] = useState(800);
  const chartRef = useRef(null);
  const dragRef = useRef(null);
  const pointers = useRef(new Map());
  const pinchRef = useRef(null);
  const automaticPage = useRef(null);
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
      if (manual) { failures = 0; followups = 0; setHasMore(true); automaticPage.current = null; }
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
          if (open && data.refreshing && followups < 2) {
            followups++;
            retryTimer = window.setTimeout(() => refresh(), 15000);
          } else { followups = 0; }
        }
      } catch (error) {
        if (active && error.name !== "AbortError") {
          failures++;
          const willRetry = getGoldSession().isOpen && failures <= 2;
          setStatus(error.message + (willRetry
            ? " History connection retry in 60 seconds. Any candles already loaded remain visible."
            : " Use Retry history to try again. Any candles already loaded remain visible."));
          if (willRetry) retryTimer = window.setTimeout(() => refresh(), 60000);
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
    const observer = new ResizeObserver(entries => setWidth(Math.max(180, entries[0].contentRect.width)));
    observer.observe(element);
    function wheel(event) {
      event.preventDefault();
      setCount(value => clampCount(value * (event.deltaY > 0 ? 1.15 : 0.85)));
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => { observer.disconnect(); element.removeEventListener("wheel", wheel); };
  }, []);

  async function loadOlder(automatic = false) {
    if (!candles.length || olderRequest.current || !hasMore) return;
    const before = candles[0].time;
    // One automatic attempt per boundary; failures need an explicit retry.
    if (automatic && automaticPage.current === before) return;
    automaticPage.current = before;
    const controller = new AbortController();
    olderRequest.current = controller;
    setLoadingOlder(true);
    try {
      const data = await requestHistory(`${API_BASE_URL}/api/market/gold/history?interval=${interval}&before=${before}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const older = olderPage(candles, data.candles, before);
      setCandles(previous => mergeCandles(older, previous));
      setHasMore(older.length > 0 && data.hasMore !== false);
      if (older.length && !automatic) setEndTime(before);
      setStatus(data.warning || (older.length ? "Older candles loaded. Keep dragging right to explore earlier history." : "Reached the end of available history for this timeframe."));
    } catch (error) {
      if (error.name !== "AbortError") setStatus(error.message);
    } finally {
      if (!controller.signal.aborted) setLoadingOlder(false);
      olderRequest.current = null;
    }
  }

  const visible = candleWindow(candles, count, endTime);
  const selected = visible[hover?.index] || visible.at(-1);
  const levels = watchLevels.filter(level => Number.isFinite(level.price) && level.price > 0);
  const bands = zones.filter(zone => Number.isFinite(zone.low) && Number.isFinite(zone.high));
  const lows = visible.map(candle => candle.low);
  const highs = visible.map(candle => candle.high);
  if (fitLevels) {
    lows.push(...levels.map(level => level.price), ...bands.map(zone => zone.low));
    highs.push(...levels.map(level => level.price), ...bands.map(zone => zone.high));
  }
  const low = lows.length ? Math.min(...lows) : 0;
  const high = highs.length ? Math.max(...highs) : 1;
  const { min, max, quiet } = candlePriceBounds(low, high, magnify);
  const axisWidth = Math.max(90, Math.max(min.toFixed(2).length, max.toFixed(2).length) * 7.5 + 24);
  const plotWidth = Math.max(60, width - axisWidth - 16);
  const height = width < 560 ? 380 : 440;
  const top = 24, bottom = height - 38;
  const plotHeight = bottom - top;
  const y = price => bottom - ((price - min) / (max - min)) * plotHeight;
  const step = plotWidth / Math.max(1, visible.length);
  const x = index => 8 + (index + 0.5) * step;
  const crossPrice = hover ? Math.max(min, Math.min(max, hover.price)) : null;

  function moveBy(amount) {
    const next = panWindow(candles, count, endTime, amount);
    setEndTime(next.endTime);
    setHover(null);
    if (next.needsOlder) void loadOlder(true);
  }
  function selectAt(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) * width / rect.width;
    const py = (event.clientY - rect.top) * height / rect.height;
    if (!visible.length || px > plotWidth + 8) return;
    setHover({ index: Math.max(0, Math.min(visible.length - 1, Math.floor((px - 8) / step))),
      price: max - (Math.max(top, Math.min(bottom, py)) - top) / plotHeight * (max - min) });
  }
  function pointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), count };
      dragRef.current = null;
    } else { dragRef.current = { x: event.clientX }; selectAt(event); }
  }
  function pointerMove(event) {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      setCount(clampCount(pinchRef.current.count * pinchRef.current.distance / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))));
      setHover(null);
      return;
    }
    selectAt(event);
    if (dragRef.current) {
      const rect = event.currentTarget.getBoundingClientRect();
      const pixelsPerCandle = step * rect.width / width;
      const delta = Math.trunc((event.clientX - dragRef.current.x) / pixelsPerCandle);
      if (delta) { moveBy(-delta); dragRef.current.x += delta * pixelsPerCandle; }
    }
  }
  function pointerEnd(event) {
    pointers.current.delete(event.pointerId);
    pinchRef.current = null;
    const remaining = [...pointers.current.values()][0];
    dragRef.current = remaining ? { x: remaining.x } : null;
  }
  function resetView() {
    setEndTime(null); setCount(width < 560 ? 40 : 80); setHover(null); setMagnify(true); setFitLevels(false);
  }

  return (
    <>
      <div className="candle-toolbar" aria-label="Chart controls">
        <button type="button" onClick={() => retryRef.current?.()} disabled={refreshing}>{refreshing ? "Checking history…" : "Refresh history"}</button>
        <button type="button" onClick={() => loadOlder(false)} disabled={!candles.length || loadingOlder || !hasMore}>{loadingOlder ? "Loading older…" : "Load older"}</button>
        <button type="button" aria-label="Pan to earlier candles and load more history at the edge" onClick={() => moveBy(-Math.round(count / 2))} disabled={!candles.length}>← Earlier</button>
        <button type="button" aria-label="Pan to later candles" onClick={() => moveBy(Math.round(count / 2))} disabled={endTime === null}>Later →</button>
        <button type="button" aria-label="Zoom in" onClick={() => setCount(value => clampCount(value / 1.4))}>＋</button>
        <button type="button" aria-label="Zoom out" onClick={() => setCount(value => clampCount(value * 1.4))}>−</button>
        <button type="button" onClick={resetView}>Latest / reset</button>
      </div>
      <div className="candle-scale-controls">
        <label><input type="checkbox" checked={magnify} onChange={event => setMagnify(event.target.checked)} />Auto-fit visible prices</label>
        {(levels.length > 0 || bands.length > 0) && <label><input type="checkbox" checked={fitLevels} onChange={event => setFitLevels(event.target.checked)} />Include watch levels &amp; zones</label>}
      </div>
      <div className="candle-ohlc" aria-live="off">
        {selected ? <><time>{stamp(selected.time)} UTC</time><span>Open <strong>{selected.open.toFixed(2)}</strong></span><span>High <strong>{selected.high.toFixed(2)}</strong></span><span>Low <strong>{selected.low.toFixed(2)}</strong></span><span>Close <strong>{selected.close.toFixed(2)}</strong></span></> : "Waiting for historical prices…"}
      </div>
      <div ref={chartRef} className="candle-surface" tabIndex={0} role="group" aria-label="Gold candlestick chart. Drag to pan, pinch or scroll to zoom. Arrow keys pan; plus and minus zoom."
        onKeyDown={event => {
          if (["ArrowLeft", "ArrowRight", "+", "=", "-", "Home"].includes(event.key)) event.preventDefault();
          if (event.key === "ArrowLeft") moveBy(-10);
          if (event.key === "ArrowRight") moveBy(10);
          if (event.key === "+" || event.key === "=") setCount(value => clampCount(value / 1.2));
          if (event.key === "-") setCount(value => clampCount(value * 1.2));
          if (event.key === "Home") resetView();
        }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${visible.length} ${interval} gold candles with price scale in US dollars`}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
          onLostPointerCapture={pointerEnd} onPointerLeave={event => { if (!dragRef.current && event.pointerType !== "touch") setHover(null); }}>
          <rect x={plotWidth + 9} y="0" width={axisWidth + 7} height={height} fill="#111" />
          {Array.from({ length: 6 }, (_, index) => {
            const price = min + (max - min) * index / 5;
            return <g key={index}><line x1="8" x2={plotWidth + 8} y1={y(price)} y2={y(price)} stroke="#292929" /><text x={width - 8} y={y(price) + 4} textAnchor="end" fill="#bcbcbc" fontSize="12">{price.toFixed(2)}</text></g>;
          })}
          {bands.filter(zone => zone.high >= min && zone.low <= max).map(zone => <g key={zone.label}>
            <rect x="8" y={y(Math.min(max, zone.high))} width={plotWidth} height={Math.max(1, y(Math.max(min, zone.low)) - y(Math.min(max, zone.high)))} fill={zone.color} fillOpacity="0.12" stroke={zone.color} strokeOpacity="0.4" />
            <text x="12" y={Math.min(bottom - 5, y(Math.min(max, zone.high)) + 13)} fill={zone.color} stroke="#111" strokeWidth="3" paintOrder="stroke" fontSize={width < 420 ? "10" : "12"}>{zone.label}</text>
          </g>)}
          {visible.map((candle, index) => {
            const color = candle.close >= candle.open ? "#70d69c" : "#ef7b7b";
            const body = Math.max(0.7, step * 0.7);
            return <g key={candle.time}><line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)} stroke={color} /><rect x={x(index) - body / 2} y={Math.min(y(candle.open), y(candle.close))} width={body} height={Math.max(1, Math.abs(y(candle.open) - y(candle.close)))} fill={color} /></g>;
          })}
          {levels.filter(level => level.price >= min && level.price <= max).map(level => <g key={level.label}><line x1="8" x2={plotWidth + 8} y1={y(level.price)} y2={y(level.price)} stroke={level.color} strokeDasharray="6 5" /><text x="12" y={Math.max(14, y(level.price) - 5)} fill={level.color} stroke="#111" strokeWidth="3" paintOrder="stroke" fontSize={width < 420 ? "10" : "12"}>{level.label}: {level.price.toFixed(2)}</text></g>)}
          {visible.length > 0 && <g>
            <line x1="8" x2={plotWidth + 8} y1={y(visible.at(-1).close)} y2={y(visible.at(-1).close)} stroke="#b6a164" strokeDasharray="2 4" />
            <rect x={plotWidth + 10} y={y(visible.at(-1).close) - 10} width={width - plotWidth - 12} height="20" rx="3" fill="#665322" />
            <text x={width - 8} y={y(visible.at(-1).close) + 4} textAnchor="end" fill="#fff" fontSize="12">{visible.at(-1).close.toFixed(2)}</text>
          </g>}
          {hover !== null && visible[hover.index] && <g>
            <line x1={x(hover.index)} x2={x(hover.index)} y1={top} y2={bottom} stroke="#bbb" strokeDasharray="3 4" />
            <line x1="8" x2={plotWidth + 8} y1={y(crossPrice)} y2={y(crossPrice)} stroke="#bbb" strokeDasharray="3 4" />
            <rect x={plotWidth + 10} y={y(crossPrice) - 10} width={width - plotWidth - 12} height="20" rx="3" fill="#ddd" />
            <text x={width - 8} y={y(crossPrice) + 4} textAnchor="end" fill="#111" fontSize="12">{crossPrice.toFixed(2)}</text>
          </g>}
          {visible.length > 0 && <>
            <text x="8" y={height - (width < 420 ? 21 : 12)} fill="#bbb" fontSize="11">{stamp(visible[0].time)}</text>
            <text x={width - 8} y={height - (width < 420 ? 5 : 12)} textAnchor="end" fill="#bbb" fontSize="11">{stamp(visible.at(-1).time)}</text>
          </>}
        </svg>
      </div>
      <p className="candle-status" role="status">{status}</p>
      <p className="candle-hint">{visible.length} shown / {candles.length} loaded · UTC · Drag right for older history; more loads at the edge. Pinch or scroll to zoom. Tap a candle for its numbers. Scroll the page outside the chart.</p>
      {visible.length > 0 && quiet && <p className="candle-hint">The visible prices cover a narrow range. Auto-fit enlarges that range; it does not change saved prices.</p>}
      <p className="candle-hint">Gold price badge = last visible candle close. Analysis uses completed candles; the newest candle may still be forming. Older history depends on saved data and your provider’s coverage.</p>
      {bands.length > 0 && <div className="candle-levels">{bands.map(zone => <span key={zone.label} style={{ color: zone.color }}>{zone.label}: {zone.low.toFixed(2)}–{zone.high.toFixed(2)}{zone.high < min || zone.low > max ? " (outside view)" : ""}</span>)}</div>}
      {levels.length > 0 && <div className="candle-levels">{levels.map(level => <span key={level.label} style={{ color: level.color }}>{level.label}: {level.price.toFixed(2)}{level.price < min || level.price > max ? " (outside view)" : ""}</span>)}</div>}
    </>
  );
}
