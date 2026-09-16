import { getDashboardStatus } from "../lib/dashboardStatus";

export default function DashboardDataStatus({ lastSuccessAt, busy, error, now, onRetry }) {
  const status = getDashboardStatus({ lastSuccessAt, busy, error, now });
  const timestamp = lastSuccessAt === null ? null : new Date(lastSuccessAt);
  return (
    <section className={`dashboard-data-status data-status-${status.tone}`} aria-label="Dashboard data status">
      <div className="data-status-content">
        <strong role="status">{status.label}</strong>
        <span>
          Last successful update: {timestamp ? (
            <time dateTime={timestamp.toISOString()}>{timestamp.toLocaleString()}</time>
          ) : "Not yet received"}
        </span>
        <small>Time received by this browser. Economic indicators follow their own release schedules and may be cached. Candle history updates separately.</small>
        {error && <p role="alert">{error} {timestamp ? "Displayed values are from the last successful update; do not treat them as current signals." : "Saved candles can still be opened under Technicals."}</p>}
        {!error && status.tone === "warning" && <p>The last successful update was more than 90 seconds ago. Displayed values may be out of date.</p>}
      </div>
      {(error || status.tone === "warning") && (
        <div className="candle-toolbar">
          <button disabled={busy} onClick={onRetry}>{busy ? "Retrying…" : "Retry dashboard"}</button>
        </div>
      )}
    </section>
  );
}
