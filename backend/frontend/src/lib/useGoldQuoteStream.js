import { useEffect, useState } from "react";
import { accountFetch, API } from "./accountClient";

const UI_UPDATE_MS = 1000;

export function useGoldQuoteStream() {
  const [quote, setQuote] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let disposed = false;
    let controller;
    let retryTimer;
    let retryDelay = 5000;
    let lastUiUpdate = 0;
    let pendingQuote = null;
    let uiTimer;
    let stopForAuth = false;

    const publishQuote = value => {
      if (!Number.isFinite(value?.price) || value.price <= 0 || value.priceSource !== "websocket") return;
      pendingQuote = value;
      const wait = Math.max(0, UI_UPDATE_MS - (Date.now() - lastUiUpdate));
      if (wait === 0) {
        lastUiUpdate = Date.now();
        setQuote(pendingQuote);
        pendingQuote = null;
      } else if (!uiTimer) {
        uiTimer = setTimeout(() => {
          uiTimer = null;
          if (!disposed && pendingQuote) {
            lastUiUpdate = Date.now();
            setQuote(pendingQuote);
            pendingQuote = null;
          }
        }, wait);
      }
    };

    const consume = block => {
      const lines = block.split(/\r?\n/);
      const eventName = lines.find(line => line.startsWith("event:"))?.slice(6).trim();
      const data = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
      if (!data) return;
      try {
        const message = JSON.parse(data);
        if (eventName === "status") setConnected(Boolean(message.connected));
        if (eventName === "quote") publishQuote(message);
      } catch { /* Ignore a malformed stream event and keep reading. */ }
    };

    async function connect() {
      if (disposed || stopForAuth) return;
      controller = new AbortController();
      let retry = true;
      try {
        const response = await accountFetch(`${API}/api/market/gold/stream`, {
          signal: controller.signal,
          headers: { Accept: "text/event-stream" },
        });
        if (response.status === 401 || response.status === 403) {
          stopForAuth = true;
          setConnected(false);
          return;
        }
        if (!response.ok || !response.body) throw new Error("Live quote stream unavailable");

        retryDelay = 5000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!disposed) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
          let boundary;
          while ((boundary = buffer.indexOf("\n\n")) >= 0) {
            consume(buffer.slice(0, boundary));
            buffer = buffer.slice(boundary + 2);
          }
        }
      } catch {
        if (!disposed && !controller.signal.aborted) setConnected(false);
      } finally {
        if (!disposed) setConnected(false);
        if (!disposed && retry && !stopForAuth) {
          const delay = retryDelay;
          retryDelay = Math.min(retryDelay * 2, 60000);
          retryTimer = setTimeout(connect, delay);
        }
      }
    }

    connect();
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(retryTimer);
      clearTimeout(uiTimer);
    };
  }, []);

  return { quote, connected };
}
