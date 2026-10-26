import { useCallback, useEffect, useRef, useState } from "react";
import { requestHistory } from "../lib/historyRequest.js";
import { accountFetch } from "../lib/accountClient.js";
import { TIMEFRAMES } from "../lib/technicalAnalysis.js";
import { mergeCandles } from "../lib/candles.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://gold-terminal-ufv4.onrender.com";
const ANALYSIS_CANDLE_LIMIT = 1200;
const REFRESH_MS = { "5min": 5 * 60_000, "1h": 15 * 60_000, "1day": 60 * 60_000 };
const sameCandles = (left, right) => left.length === right.length && left.every((row, index) => {
  const other = right[index];
  return other && row.time === other.time && row.open === other.open && row.high === other.high
    && row.low === other.low && row.close === other.close;
});

export default function useIndependentTimeframeHistory(selectedInterval) {
  const [history, setHistory] = useState({});
  const [updates, setUpdates] = useState({});
  const [audits, setAudits] = useState({});
  const pending = useRef(new Map());
  const controllers = useRef(new Set());
  const lastSuccess = useRef(new Map());

  const refreshTimeframe = useCallback(async (interval, { force = false } = {}) => {
    if (!Object.hasOwn(TIMEFRAMES, interval)) return;
    if (pending.current.has(interval)) return pending.current.get(interval).promise;
    const lastUpdated = lastSuccess.current.get(interval);
    if (!force && lastUpdated && Date.now() - lastUpdated < REFRESH_MS[interval]) return;

    const controller = new AbortController();
    controllers.current.add(controller);
    setUpdates(previous => ({ ...previous, [interval]: { ...previous[interval], status: "loading", error: null } }));
    const entry = { promise: null };
    const task = (async () => {
      try {
        const url = `${API_BASE_URL}/api/market/gold/history?interval=${interval}${interval === "1h" ? "" : "&structureOnly=1"}`;
        const result = await requestHistory(url, { signal: controller.signal, fetchImpl: accountFetch });
        if (controller.signal.aborted) return;
        if (result.signalAudit) setAudits(previous => ({ ...previous, [interval]: result.signalAudit }));
        const candles = result.candles.slice(-ANALYSIS_CANDLE_LIMIT);
        const updatedAt = Date.now();
        lastSuccess.current.set(interval, updatedAt);
        setHistory(previous => {
          const merged = mergeCandles(previous[interval] || [], candles);
          return sameCandles(previous[interval] || [], merged) ? previous : { ...previous, [interval]: merged };
        });
        setUpdates(previous => ({ ...previous, [interval]: {
          status: candles.length ? "ready" : "empty", updatedAt, error: null,
        } }));
      } catch (error) {
        if (!controller.signal.aborted && error.name !== "AbortError") {
          setUpdates(previous => ({ ...previous, [interval]: {
            ...previous[interval], status: "error", error: "Could not update this timeframe.",
          } }));
        }
      } finally {
        controllers.current.delete(controller);
        if (pending.current.get(interval) === entry) pending.current.delete(interval);
      }
    })();
    entry.promise = task;
    pending.current.set(interval, entry);
    return task;
  }, []);

  const receiveChartCandles = useCallback((interval, rows) => {
    if (!Object.hasOwn(TIMEFRAMES, interval) || !Array.isArray(rows) || !rows.length) return;
    setHistory(previous => sameCandles(previous[interval] || [], rows) ? previous : { ...previous, [interval]: rows });
  }, []);

  const receiveChartStatus = useCallback((interval, update) => {
    if (update.updatedAt) lastSuccess.current.set(interval, update.updatedAt);
    setUpdates(previous => ({
      ...previous,
      [interval]: { ...previous[interval], ...update,
        updatedAt: update.updatedAt ?? previous[interval]?.updatedAt ?? null },
    }));
  }, []);

  const receiveAudit = useCallback((interval, audit) => {
    setAudits(previous => ({ ...previous, [interval]: audit }));
  }, []);

  useEffect(() => {
    const backgroundIntervals = Object.keys(TIMEFRAMES).filter(interval => interval !== selectedInterval);
    for (const interval of backgroundIntervals) void refreshTimeframe(interval);
    const timers = backgroundIntervals.map(interval => window.setInterval(
      () => void refreshTimeframe(interval), REFRESH_MS[interval],
    ));
    return () => {
      timers.forEach(window.clearInterval);
    };
  }, [selectedInterval, refreshTimeframe]);

  useEffect(() => () => {
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
    pending.current.clear();
  }, []);

  return { history, updates, audits, receiveChartCandles, receiveChartStatus, receiveAudit, refreshTimeframe };
}
