import { getGoldSession } from "../lib/goldSession";
import { useEffect, useMemo, useRef, useState } from "react";
import { candleWindow, mergeCandles, candlePriceBounds, sessionCandles } from "../lib/candles";
import { requestHistory } from "../lib/historyRequest";
import { accountFetch } from '../lib/accountClient';
import { clampCount, panWindow, olderPage } from "../lib/chartNavigation";
import { historicalSupports, historicalResistances, latestResistanceTest } from "../lib/historicalSupport";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://gold-terminal-ufv4.onrender.com";
const EMPTY_LEVELS = [];
const stamp = time => new Date(time * 1000).toLocaleString("en-GB", {
  timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
});

export default function GoldCandleChart({ watchLevels = EMPTY_LEVELS, zones = EMPTY_LEVELS, interval: selectedInterval, onIntervalChange, onCandlesChange, onAuditChange, initialCandles = EMPTY_LEVELS, initialLoadPending = false, onHistoryStatus, now = 0 }) {
  const [localInterval, setIntervalValue] = useState("5min");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = event => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [expanded]);
  const interval = selectedInterval || localInterval;
  return (
    <section className={`chart-panel candle-panel${expanded ? " candle-panel-expanded" : ""}`}>
      <div className="chart-header candle-header">
        <div><span className="section-label">XAUUSD · Price history</span><h3>Gold Candles</h3></div>
        <button className="candle-expand" type="button" aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Close full screen" : "Full screen chart"}</button>
        <label className="candle-timeframe">Timeframe
          <select value={interval} onChange={event => (onIntervalChange || setIntervalValue)(event.target.value)}>
            <option value="5min">5 minutes</option><option value="1h">1 hour</option><option value="1day">1 day</option>
          </select>
        </label>
      </div>
      <CandleView key={interval} interval={interval} expanded={expanded} watchLevels={watchLevels} zones={zones} onCandlesChange={onCandlesChange} onAuditChange={onAuditChange} initialCandles={initialCandles} initialLoadPending={initialLoadPending} onHistoryStatus={onHistoryStatus} now={now} />
    </section>
  );
}

function CandleView({ interval, expanded, watchLevels, zones, onCandlesChange, onAuditChange, initialCandles, initialLoadPending, onHistoryStatus, now }) {
  const [magnify, setMagnify] = useState(true);
  const [fitLevels, setFitLevels] = useState(false);
  const [showPastSupport, setShowPastSupport] = useState(false);
  const [showPastResistance, setShowPastResistance] = useState(false);
  const [candles, setCandles] = useState(initialCandles);
  const [status, setStatus] = useState(initialCandles.length ? "Showing saved candles." : "Loading saved candles…");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [count, setCount] = useState(() => typeof window !== "undefined" && window.innerWidth < 600 ? 40 : 80);
  const [endTime, setEndTime] = useState(null);
  const [hover, setHover] = useState(null);
  const [width, setWidth] = useState(800);
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === "undefined" ? 700 : window.innerHeight);
  const chartRef = useRef(null);
  const dragRef = useRef(null);
  const pointers = useRef(new Map());
  const pinchRef = useRef(null);
  const automaticPage = useRef(null);
  const olderRequest = useRef(null);
  const retryRef = useRef(null);
  const skipInitialFetch = useRef(initialCandles.length > 0 || initialLoadPending);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => { onCandlesChange?.(interval, candles); }, [interval, candles, onCandlesChange]);

  useEffect(() => {
    if (!initialCandles.length) return;
    // The parent owns the independent timeframe cache; reconcile updates without resetting chart navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCandles(previous => {
      const merged = mergeCandles(previous, initialCandles);
      if (merged.length === previous.length && merged.every((row, index) => {
        const old = previous[index];
        return old && old.time === row.time && old.open === row.open && old.high === row.high && old.low === row.low && old.close === row.close;
      })) return previous;
      return merged;
    });
  }, [initialCandles]);

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
      onHistoryStatus?.(interval, { status: "loading", error: null });
      setRefreshing(true);
      try {
        const data = await requestHistory(
          API_BASE_URL + "/api/market/gold/history?interval=" + interval,
          { signal: controller.signal, fetchImpl: accountFetch },
        );
        if (active) {
          onAuditChange?.(interval, data.signalAudit ?? null);
          onHistoryStatus?.(interval, { status: data.candles.length ? "ready" : "empty", updatedAt: Date.now(), error: null });
          loadedClosed = !getGoldSession().isOpen;
          failures = 0;
          setCandles(previous => mergeCandles(previous, data.candles));
          setStatus(data.warning || (data.refreshing
            ? "Showing available candles while the latest prices update."
            : data.candles.length ? "Price history is up to date."
              : "No candles available for this timeframe."));
          if (open && data.refreshing && followups < 2) {
            followups++;
            retryTimer = window.setTimeout(() => refresh(), 15000);
          } else { followups = 0; }
        }
      } catch (error) {
        if (active && error.name !== "AbortError") {
          onHistoryStatus?.(interval, { status: "error", error: "Could not update this timeframe." });
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
    const initialTimer = skipInitialFetch.current ? null : window.setTimeout(() => refresh(), 0);
    const refreshEvery = interval === "1day" ? 3600000 : 300000;
    const timer = window.setInterval(() => refresh(), refreshEvery);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      retryRef.current = null;
      controller.abort();
      olderRequest.current?.abort();
      if (initialTimer !== null) window.clearTimeout(initialTimer);
      window.clearTimeout(retryTimer);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [interval, onAuditChange, onHistoryStatus]);

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
      const data = await requestHistory(`${API_BASE_URL}/api/market/gold/history?interval=${interval}&before=${before}`, { signal: controller.signal, fetchImpl: accountFetch });
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

  const chartCandles = useMemo(() => sessionCandles(candles, interval), [candles, interval]);
  const hiddenClosed = candles.length - chartCandles.length;
  const visible = useMemo(() => candleWindow(chartCandles, count, endTime), [chartCandles, count, endTime]);
  const visibleStart = visible[0]?.time;
  const visibleEnd = visible.at(-1)?.time;
  const intervalSeconds = interval === "5min" ? 300 : interval === "1day" ? 86400 : 3600;
  const completedAsOf = visibleEnd === undefined ? 0 : Math.min(visibleEnd,
    Math.floor(now / 1000 / intervalSeconds) * intervalSeconds - intervalSeconds);
  // The final saved candle may still be forming; historical markers use older rows.
  const pastSupports = useMemo(() => {
    if (visibleStart === undefined || visibleEnd === undefined) return [];
    const first = chartCandles.findIndex(row => row.time >= visibleStart);
    const last = chartCandles.findLastIndex(row => row.time <= visibleEnd);
    const contextStart = Math.max(0, first - 40);
    const contextEnd = Math.min(chartCandles.length - 1, last + 3);
    return historicalSupports(chartCandles.slice(contextStart, contextEnd), 3, completedAsOf);
  }, [chartCandles, visibleStart, visibleEnd, completedAsOf]);
  const pastResistances = useMemo(() => {
    if (visibleStart === undefined || visibleEnd === undefined) return [];
    const first = chartCandles.findIndex(row => row.time >= visibleStart);
    const last = chartCandles.findLastIndex(row => row.time <= visibleEnd);
    const contextStart = Math.max(0, first - 40);
    const contextEnd = Math.min(chartCandles.length - 1, last + 3);
    return historicalResistances(chartCandles.slice(contextStart, contextEnd), 3, completedAsOf);
  }, [chartCandles, visibleStart, visibleEnd, completedAsOf]);
  const developingResistances = useMemo(() => {
    if (visibleStart === undefined || visibleEnd === undefined) return [];
    const first = chartCandles.findIndex(row => row.time >= visibleStart);
    const last = chartCandles.findLastIndex(row => row.time <= visibleEnd);
    const contextStart = Math.max(0, first - 40);
    const contextEnd = Math.min(chartCandles.length - 1, last + 3);
    return historicalResistances(chartCandles.slice(contextStart, contextEnd), 1, completedAsOf, true);
  }, [chartCandles, visibleStart, visibleEnd, completedAsOf]);
  const recentResistanceTest = useMemo(() => latestResistanceTest(chartCandles, completedAsOf), [chartCandles, completedAsOf]);
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
  const visiblePastSupports = showPastSupport && visible.length ? pastSupports.filter(zone => zone.lastTime >= visibleStart && zone.firstTime <= visibleEnd
    && zone.high >= min && zone.low <= max && !bands.some(band => band.active !== false && Math.abs((band.low + band.high - zone.low - zone.high) / 2) <= Math.max(band.high - band.low, zone.high - zone.low)))
    .sort((a, b) => Math.abs((a.low + a.high) / 2 - (visible.at(-1)?.close ?? 0)) - Math.abs((b.low + b.high) / 2 - (visible.at(-1)?.close ?? 0)) || b.lastTime - a.lastTime).slice(0, 1) : [];
  const visiblePastResistances = showPastResistance && visible.length ? pastResistances.filter(zone => zone.lastTime >= visibleStart && zone.firstTime <= visibleEnd
    && zone.high >= min && zone.low <= max && !bands.some(band => band.active !== false && Math.abs((band.low + band.high - zone.low - zone.high) / 2) <= Math.max(band.high - band.low, zone.high - zone.low)))
    .sort((a, b) => Math.abs((a.low + a.high) / 2 - (visible.at(-1)?.close ?? 0)) - Math.abs((b.low + b.high) / 2 - (visible.at(-1)?.close ?? 0)) || b.lastTime - a.lastTime).slice(0, 1) : [];
  const developingResistance = visible.length ? developingResistances
    .filter(zone => zone.status === "forming" && zone.lastTime >= visibleStart && zone.lastTime <= visibleEnd
      && zone.high >= min && zone.low <= max
      && !bands.some(band => band.active !== false && Math.abs((band.low + band.high - zone.low - zone.high) / 2) <= Math.max(band.high - band.low, zone.high - zone.low)))
    .sort((a, b) => b.lastTime - a.lastTime)[0] : null;
  const latestResistance = [developingResistance, recentResistanceTest]
    .filter(zone => zone && zone.lastTime >= visibleStart && zone.lastTime <= visibleEnd
      && zone.high >= min && zone.low <= max
      && !bands.some(band => band.active !== false && Math.abs((band.low + band.high - zone.low - zone.high) / 2) <= Math.max(band.high - band.low, zone.high - zone.low)))
    .sort((a, b) => b.lastTime - a.lastTime)[0] || null;
  const axisWidth = Math.max(90, Math.max(min.toFixed(2).length, max.toFixed(2).length) * 7.5 + 24);
  const plotWidth = Math.max(60, width - axisWidth - 16);
  const height = expanded ? Math.max(440, Math.round(viewportHeight * 0.68)) : width < 560 ? 380 : 440;
  const top = 24, bottom = height - 38;
  const plotHeight = bottom - top;
  const y = price => bottom - ((price - min) / (max - min)) * plotHeight;
  const step = plotWidth / Math.max(1, visible.length);
  const x = index => 8 + (index + 0.5) * step;
  const historicalAnnotations = [...visiblePastSupports.map(zone => ({ ...zone, chartRole: "support" })), ...visiblePastResistances.map(zone => ({ ...zone, chartRole: "resistance" })),
    ...(latestResistance ? [{ ...latestResistance, chartRole: "resistance", developing: true }] : [])]
    .map(zone => ({ zone, desiredY: y((zone.low + zone.high) / 2) }))
    .sort((a, b) => a.desiredY - b.desiredY);
  const labelGap = 23;
  const positionedHistoricalAnnotations = historicalAnnotations.reduce((placed, item) => {
    const previousY = placed.at(-1)?.labelY ?? top + 14 - labelGap;
    return [...placed, { ...item, labelY: Math.max(item.desiredY, previousY + labelGap) }];
  }, []);
  const labelOverflow = Math.max(0, (positionedHistoricalAnnotations.at(-1)?.labelY ?? bottom - 20) - (bottom - 20));
  const crossPrice = hover ? Math.max(min, Math.min(max, hover.price)) : null;

  function moveBy(amount) {
    const next = panWindow(chartCandles, count, endTime, amount);
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
        <label><input type="checkbox" checked={showPastSupport} onChange={event => setShowPastSupport(event.target.checked)} />Past support reactions</label>
        <label><input type="checkbox" checked={showPastResistance} onChange={event => setShowPastResistance(event.target.checked)} />Past resistance reactions</label>
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
          {bands.filter(zone => zone.high >= min && zone.low <= max).map(zone => <g key={zone.id || zone.label}>
            <rect x="8" y={y(Math.min(max, zone.high))} width={plotWidth} height={Math.max(1, y(Math.max(min, zone.low)) - y(Math.min(max, zone.high)))} fill={zone.color} fillOpacity={zone.active === false ? "0.035" : "0.12"} stroke={zone.color} strokeOpacity={zone.active === false ? "0.3" : "0.55"} strokeDasharray={zone.active === false ? "4 5" : undefined} />
            <text x="12" y={Math.min(bottom - 5, y(Math.min(max, zone.high)) + 13)} fill={zone.color} stroke="#111" strokeWidth="3" paintOrder="stroke" fontSize={width < 420 ? "10" : "12"}>{zone.displayLabel || zone.label}</text>
          </g>)}
          {positionedHistoricalAnnotations.map(({ zone, desiredY, labelY: rawLabelY }) => {
            const labelY = rawLabelY - labelOverflow;
            const first = Math.max(0, visible.findIndex(row => row.time >= zone.firstTime));
            const last = visible.findLastIndex(row => row.time <= zone.lastTime);
            const start = Math.max(8, x(first) - step / 2);
            const end = Math.min(plotWidth + 8, x(Math.min(visible.length - 1, last + 4)) + step / 2);
            const statusLabel = zone.status === "role-reversed" ? "role reversed"
              : zone.status === "broken" ? "broken · retest pending"
                : zone.status === "invalidated" ? "reversal invalid" : zone.status;
            const reversalLabel = zone.reversal?.state === "confirmed"
              ? `${zone.chartRole === "resistance" ? "Resistance → Support" : "Support → Resistance"} (Confirmed)`
              : zone.reversal?.state === "pending" ? `Role Reversal Pending · ${zone.chartRole === "resistance" ? "Resistance → Support" : "Support → Resistance"}`
                : zone.reversal?.state === "invalidated" ? `Role Reversal Invalidated · ${zone.chartRole === "resistance" ? "Resistance → Support" : "Support → Resistance"}` : null;
            const fullLabel = zone.status === "testing" ? "Potential resistance · testing"
              : zone.developing ? `Potential resistance · ${zone.touches} reaction`
              : reversalLabel ? `${reversalLabel} · ${zone.touches} reactions`
                : `${zone.chartRole === "support" ? "Past support" : "Past resistance"} · ${zone.touches} reactions · ${statusLabel}`;
            const maxCharacters = Math.max(12, Math.floor((plotWidth - 20) / 5.2));
            const label = fullLabel.length > maxCharacters ? `${fullLabel.slice(0, maxCharacters - 1)}…` : fullLabel;
            const labelWidth = Math.min(plotWidth - 12, label.length * 5.2 + 10);
            const color = zone.developing ? "#ef7b7b" : zone.reversal?.state === "confirmed"
              ? zone.chartRole === "resistance" ? "#477f60" : "#8a4e4e"
              : zone.chartRole === "support" ? zone.active ? "#70d69c" : "#477f60" : zone.active ? "#ef7b7b" : "#8a4e4e";
            return <g key={zone.id}>
              <rect x={start} y={y(Math.min(max, zone.high))} width={Math.max(1, (zone.developing ? plotWidth + 8 : end) - start)} height={Math.max(1, y(Math.max(min, zone.low)) - y(Math.min(max, zone.high)))} fill={color} fillOpacity={zone.developing ? "0.035" : "0.07"} stroke={color} strokeOpacity={zone.developing ? "0.75" : "0.5"} strokeDasharray={zone.developing ? "5 4" : "3 4"} />
              {zone.reversal && <line x1={Math.max(start, end - 120)} x2={end} y1={desiredY} y2={desiredY} stroke={color} strokeOpacity="0.45" strokeDasharray="2 3" />}
              <rect x={Math.max(10, plotWidth - labelWidth)} y={labelY - 12} width={labelWidth} height="17" rx="3" fill="#111" fillOpacity="0.92" />
              <text x={Math.max(14, plotWidth - labelWidth + 4)} y={labelY} fill={color} fontSize="9">{label}</text>
              <title>{zone.developing ? `${fullLabel} · forming` : fullLabel}</title>
            </g>;
          })}
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
      <p className="candle-hint">{visible.length} candles shown · UTC · Drag to pan; pinch or scroll to zoom. Select a candle to inspect its prices.</p>
      <details className="chart-notes">
        <summary>Chart and data notes</summary>
        {(showPastSupport || showPastResistance) && <p className="candle-hint">Past reaction zones use completed candles. Broken zones only become the opposite role after a completed retest holds; pending or invalidated reversals remain historical references, not trade signals.</p>}
        {hiddenClosed > 0 && <p className="candle-hint">{hiddenClosed} candle{hiddenClosed === 1 ? "" : "s"} from scheduled closed hours are hidden in this intraday view.</p>}
        {visible.length > 0 && quiet && <p className="candle-hint">Prices cover a narrow range. Auto-fit enlarges the view without changing any prices.</p>}
        <p className="candle-hint">Analysis uses completed candles; the newest candle may still be forming. Older history depends on provider coverage.</p>
      </details>
      {bands.length > 0 && <div className="candle-levels">{bands.map(zone => <span key={zone.id || zone.label} style={{ color: zone.color }}>{zone.displayLabel || zone.label}: {zone.low.toFixed(2)}–{zone.high.toFixed(2)}{Number.isFinite(zone.touches) ? ` · ${zone.touches} reactions` : ""}{zone.high < min || zone.low > max ? " (outside view)" : ""}</span>)}</div>}
      {levels.length > 0 && <div className="candle-levels">{levels.map(level => <span key={level.label} style={{ color: level.color }}>{level.label}: {level.price.toFixed(2)}{level.price < min || level.price > max ? " (outside view)" : ""}</span>)}</div>}
    </>
  );
}
