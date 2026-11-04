const HEARTBEAT_MS = 10000;
const MAX_RECONNECT_MS = 30000;
const MAX_TICK_AGE_MS = 5 * 60 * 1000;
const MAX_LIVE_AGE_MS = 90000;

function createTwelveDataPriceStream({
  WebSocketImpl = globalThis.WebSocket,
  apiKey = () => process.env.TWELVE_DATA_API_KEY,
  enabled = () => true,
  now = Date.now,
  session,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  random = Math.random,
  logger = console,
} = {}) {
  let socket = null;
  let running = false;
  let state = "stopped";
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let reconnectAttempt = 0;
  let latest = null;
  const subscribers = new Set();

  function publish(event) {
    for (const subscriber of subscribers) {
      try { subscriber(event); } catch { /* One client must not interrupt the feed. */ }
    }
  }

  function setState(next) {
    if (state === next) return;
    state = next;
    publish({ type: "status", state });
  }

  function isOpen() {
    return typeof session !== "function" || session(now()).isOpen;
  }

  function clearSocketTimers() {
    if (heartbeatTimer) clearIntervalFn(heartbeatTimer);
    heartbeatTimer = null;
  }

  function scheduleReconnect() {
    if (!running || reconnectTimer) return;
    const base = Math.min(1000 * (2 ** Math.min(reconnectAttempt, 5)), MAX_RECONNECT_MS);
    const delay = Math.round(base * (0.8 + random() * 0.4));
    reconnectAttempt += 1;
    reconnectTimer = setTimeoutFn(() => {
      reconnectTimer = null;
      connect();
    }, delay);
    reconnectTimer.unref?.();
  }

  function onMessage(event) {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }

    if (message.event === "subscribe-status") {
      const accepted = Array.isArray(message.success)
        && message.success.some(item => item?.symbol?.toUpperCase() === "XAU/USD");
      if (accepted) {
        reconnectAttempt = 0;
        setState("subscribed");
      } else {
        setState("unavailable");
        logger.warn("Twelve Data WebSocket did not accept XAU/USD; REST quote fallback remains enabled.");
      }
      return;
    }

    if (message.event !== "price" || message.symbol?.toUpperCase() !== "XAU/USD") return;
    const price = Number(message.price);
    const timestamp = Number(message.timestamp);
    const sourceTime = timestamp * 1000;
    const receivedAtMs = now();
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(sourceTime)
      || sourceTime <= 0 || sourceTime - receivedAtMs > 30000
      || receivedAtMs - sourceTime > MAX_TICK_AGE_MS || !isOpen()) return;
    if (latest && (sourceTime < latest.sourceTimeMs
      || (sourceTime === latest.sourceTimeMs && price === latest.price))) return;

    latest = {
      price,
      sourceTimeMs: sourceTime,
      sourceTimestamp: new Date(sourceTime).toISOString(),
      receivedAt: new Date(receivedAtMs).toISOString(),
      priceSource: "websocket",
    };
    publish({ type: "quote", quote: { ...latest, sourceTimeMs: undefined } });
  }

  function connect() {
    if (!running || socket) return;
    if (!enabled()) {
      setState("disabled");
      return;
    }
    const key = typeof apiKey === "function" ? apiKey() : apiKey;
    if (!key) {
      setState("disabled");
      return;
    }
    if (typeof WebSocketImpl !== "function") {
      setState("unsupported");
      logger.warn("Node WebSocket is unavailable; REST quote fallback remains enabled.");
      return;
    }

    let connection;
    try {
      const url = new URL("wss://ws.twelvedata.com/v1/quotes/price");
      url.searchParams.set("apikey", key);
      connection = new WebSocketImpl(url.toString());
    } catch {
      setState("unavailable");
      scheduleReconnect();
      return;
    }
    socket = connection;
    setState("connecting");

    connection.addEventListener("open", () => {
      if (socket !== connection || !running) return;
      setState("connected");
      try {
        connection.send(JSON.stringify({ action: "subscribe", params: { symbols: "XAU/USD" } }));
      } catch {
        try { connection.close(); } catch { /* The close handler retries. */ }
      }
      heartbeatTimer = setIntervalFn(() => {
        if (socket !== connection || connection.readyState !== 1) return;
        try { connection.send(JSON.stringify({ action: "heartbeat" })); } catch { /* Close will trigger retry. */ }
      }, HEARTBEAT_MS);
      heartbeatTimer.unref?.();
    });
    connection.addEventListener("message", onMessage);
    connection.addEventListener("error", () => {
      if (socket === connection) setState("unavailable");
    });
    connection.addEventListener("close", () => {
      if (socket !== connection) return;
      socket = null;
      clearSocketTimers();
      if (running) {
        setState("reconnecting");
        scheduleReconnect();
      } else setState("stopped");
    });
  }

  function start() {
    if (running) return;
    running = true;
    connect();
  }

  function stop() {
    running = false;
    if (reconnectTimer) clearTimeoutFn(reconnectTimer);
    reconnectTimer = null;
    clearSocketTimers();
    const current = socket;
    socket = null;
    if (current) {
      current.addEventListener("close", () => setState("stopped"), { once: true });
      try { current.close(1000, "Service stopping"); } catch { setState("stopped"); }
    } else setState("stopped");
  }

  function readLatest() {
    if (!latest || !isOpen() || now() - latest.sourceTimeMs > MAX_LIVE_AGE_MS) return null;
    const { sourceTimeMs, ...quote } = latest;
    return { ...quote };
  }

  return {
    start,
    stop,
    readLatest,
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    status() { return { state, connected: state === "connected" || state === "subscribed" }; },
  };
}

module.exports = { createTwelveDataPriceStream, HEARTBEAT_MS, MAX_LIVE_AGE_MS };
