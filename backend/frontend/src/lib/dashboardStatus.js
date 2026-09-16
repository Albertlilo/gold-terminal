export function getDashboardStatus({ lastSuccessAt, busy, error, now }) {
  if (error) return { label: lastSuccessAt === null ? "Data unavailable" : "Update failed", tone: "error" };
  if (lastSuccessAt !== null && now - lastSuccessAt > 90000) return { label: "Update delayed", tone: "warning" };
  if (busy) return { label: lastSuccessAt === null ? "Loading data" : "Updating", tone: "pending" };
  return lastSuccessAt === null
    ? { label: "Waiting for data", tone: "pending" }
    : { label: "Data received", tone: "success" };
}
