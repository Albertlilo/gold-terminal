export async function requestHistory(url, { signal, timeoutMs = 20000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timer;
  try {
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("The history request timed out. The server may be waking up; please retry."));
        controller.abort();
      }, timeoutMs);
    });
    const request = (async () => {
      const response = await fetchImpl(url, { signal: controller.signal });
      let data;
      try { data = await response.json(); }
      catch (error) { throw new Error("The history server did not return candle data. Please retry.", { cause: error }); }
      if (!response.ok || !Array.isArray(data.candles)) throw new Error(data.message || "Could not load candle history. Please retry.");
      return data;
    })();
    return await Promise.race([request, deadline]);
  } catch (error) {
    if (error.name === "TypeError") throw new Error("The history server could not be reached. Please retry.", { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
