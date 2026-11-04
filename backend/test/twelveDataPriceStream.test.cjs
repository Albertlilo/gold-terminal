const test = require("node:test");
const assert = require("node:assert/strict");
const { createTwelveDataPriceStream } = require("../src/services/twelveDataPriceStream");
const { createMarketSnapshotService } = require("../src/services/marketSnapshotService");

class FakeWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    this.sent = [];
    this.readyState = 0;
    FakeWebSocket.instances.push(this);
  }
  addEventListener(name, handler) {
    const list = this.listeners.get(name) ?? [];
    list.push(handler);
    this.listeners.set(name, list);
  }
  emit(name, data = {}) {
    for (const handler of this.listeners.get(name) ?? []) handler(data);
  }
  send(payload) { this.sent.push(JSON.parse(payload)); }
  open() { this.readyState = 1; this.emit("open"); }
  message(payload) { this.emit("message", { data: JSON.stringify(payload) }); }
  close() { this.readyState = 3; this.emit("close", { code: 1000 }); }
}

function makeStream(overrides = {}) {
  FakeWebSocket.instances = [];
  const intervals = [];
  const timeouts = [];
  const stream = createTwelveDataPriceStream({
    WebSocketImpl: FakeWebSocket,
    apiKey: () => "test-key",
    now: () => Date.parse("2026-11-04T12:00:00Z"),
    session: () => ({ isOpen: true }),
    setIntervalFn: callback => { const item = { callback, cleared: false, unref() {} }; intervals.push(item); return item; },
    clearIntervalFn: item => { item.cleared = true; },
    setTimeoutFn: (callback, delay) => { const item = { callback, delay, unref() {} }; timeouts.push(item); return item; },
    clearTimeoutFn: item => { item.cleared = true; },
    random: () => 0.5,
    logger: { warn() {} },
    ...overrides,
  });
  return { stream, intervals, timeouts };
}

test("opens one Twelve Data socket, subscribes once, heartbeats, and exposes fresh gold ticks", () => {
  const { stream, intervals } = makeStream();
  stream.start();
  assert.equal(FakeWebSocket.instances.length, 1);
  const socket = FakeWebSocket.instances[0];
  assert.equal(new URL(socket.url).hostname, "ws.twelvedata.com");
  assert.equal(new URL(socket.url).searchParams.get("apikey"), "test-key");

  socket.open();
  assert.deepEqual(socket.sent[0], { action: "subscribe", params: { symbols: "XAU/USD" } });
  assert.equal(intervals.length, 1);
  intervals[0].callback();
  assert.deepEqual(socket.sent[1], { action: "heartbeat" });

  socket.message({ event: "subscribe-status", status: "ok", success: [{ symbol: "XAU/USD" }] });
  assert.equal(stream.status().state, "subscribed");
  socket.message({ event: "price", symbol: "XAU/USD", timestamp: 1793793600, price: "4012.45" });
  assert.equal(stream.readLatest().price, 4012.45);
  assert.equal(stream.readLatest().priceSource, "websocket");
  stream.stop();
  assert.equal(stream.status().state, "stopped");
});

test("ignores invalid, stale, unrelated, duplicate, and closed-session ticks", () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  let open = true;
  const { stream } = makeStream({ now: () => now, session: () => ({ isOpen: open }) });
  stream.start();
  const socket = FakeWebSocket.instances[0];
  socket.open();
  socket.message({ event: "price", symbol: "EUR/USD", timestamp: now / 1000, price: 1.1 });
  socket.message({ event: "price", symbol: "XAU/USD", timestamp: now / 1000 - 600, price: 4000 });
  socket.message({ event: "price", symbol: "XAU/USD", timestamp: now / 1000, price: -1 });
  assert.equal(stream.readLatest(), null);

  socket.message({ event: "price", symbol: "XAU/USD", timestamp: now / 1000, price: 4010 });
  socket.message({ event: "price", symbol: "XAU/USD", timestamp: now / 1000, price: 4010 });
  assert.equal(stream.readLatest().price, 4010);
  open = false;
  assert.equal(stream.readLatest(), null);
  stream.stop();
});

test("does not attempt a connection without a key and retries a closed connection with backoff", () => {
  const noKey = makeStream({ apiKey: () => "" });
  noKey.stream.start();
  assert.equal(FakeWebSocket.instances.length, 0);
  assert.equal(noKey.stream.status().state, "disabled");
  noKey.stream.stop();

  const retry = makeStream();
  retry.stream.start();
  const first = FakeWebSocket.instances[0];
  first.close();
  assert.equal(retry.timeouts.length, 1);
  assert.equal(retry.timeouts[0].delay, 1000);
  retry.timeouts[0].callback();
  assert.equal(FakeWebSocket.instances.length, 2);
  retry.stream.stop();
});

test("uses the WebSocket quote without polling REST, then falls back when the stream is stale", async () => {
  let now = Date.parse("2026-11-04T12:00:00Z");
  let live = { price: 4012, receivedAt: new Date(now).toISOString() };
  let restCalls = 0;
  const get = createMarketSnapshotService({
    now: () => now,
    session: () => ({ isOpen: true, label: "Open" }),
    readStreamPrice: () => live,
    fetchPrice: async () => { restCalls += 1; return 4000; },
    readSavedPrice: async () => null,
  });

  const first = await get();
  assert.equal(first.xauusd.price, 4012);
  assert.equal(first.xauusd.priceSource, "websocket");
  assert.equal(restCalls, 0);

  now += 100000;
  live = null;
  const fallback = await get();
  assert.equal(fallback.xauusd.price, 4000);
  assert.equal(fallback.xauusd.priceSource, "quote");
  assert.equal(restCalls, 1);
});
