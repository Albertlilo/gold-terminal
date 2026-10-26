export const MIN_REWARD_RISK = 1.5;

function nearestZone(zones, direction, entry) {
  const candidates = (zones || []).filter(zone => zone.status !== "broken" && zone.status !== "invalidated");
  const relevant = direction === "buy"
    ? candidates.filter(zone => zone.role === "resistance" && zone.low > entry).sort((a, b) => a.low - b.low)
    : candidates.filter(zone => zone.role === "support" && zone.high < entry).sort((a, b) => b.high - a.high);
  return relevant[0] ?? null;
}

export function assessTechnicalRisk({ setup, zones, entry, atr, breakBuffer, minRewardRisk = MIN_REWARD_RISK }) {
  const direction = setup?.direction;
  if (!Number.isFinite(entry) || !Number.isFinite(atr) || atr <= 0 || !["buy", "sell"].includes(direction)) {
    return { qualified: false, reason: "Insufficient completed-candle data to assess risk." };
  }
  const support = zones?.support;
  const resistance = zones?.resistance;
  const reference = setup.type === "support-bounce" ? support
    : setup.type === "resistance-rejection" ? resistance
      : direction === "buy" ? resistance : support;
  if (!reference) return { qualified: false, reason: "The setup has no confirmed structural invalidation zone." };

  const buffer = Math.max(Number.isFinite(breakBuffer) ? breakBuffer : 0, atr * 0.15);
  const stop = direction === "buy"
    ? (setup.type === "support-bounce" ? support.low : reference.low) - buffer
    : (setup.type === "resistance-rejection" ? resistance.high : reference.high) + buffer;
  const entryPadding = atr * 0.05;
  const executableEntry = direction === "buy" ? entry + entryPadding : entry - entryPadding;
  // The target list is built from intact, confirmed structures. Do not fall
  // back to a displayed active band when a closer target exists but fails the
  // R:R filter; that would silently bypass the structural target check.
  const targetZone = nearestZone(zones?.targets, direction, executableEntry);
  const target = !targetZone ? null : direction === "buy" ? targetZone.low : targetZone.high;
  const riskPerUnit = direction === "buy" ? executableEntry - stop : stop - executableEntry;
  const rewardPerUnit = target === null ? null : direction === "buy" ? target - executableEntry : executableEntry - target;
  const rewardRisk = rewardPerUnit > 0 && riskPerUnit > 0 ? rewardPerUnit / riskPerUnit : null;
  const qualified = rewardRisk !== null && rewardRisk >= minRewardRisk;
  const entryArea = direction === "buy"
    ? { low: entry, high: entry + entryPadding }
    : { low: entry - entryPadding, high: entry };
  const reason = !targetZone ? "No intact opposing zone is available as a structural target."
    : rewardRisk === null ? "The proposed entry, stop and target do not form a valid risk/reward plan."
      : !qualified ? `Structural reward is below the ${minRewardRisk.toFixed(1)}R minimum.`
        : "Structural target meets the minimum reward/risk filter.";
  return { qualified, reason, direction, entryArea, entry: executableEntry, stop, target,
    targetZone: targetZone ? { label: targetZone.label, low: targetZone.low, high: targetZone.high } : null,
    riskPerUnit, rewardPerUnit, rewardRisk, minRewardRisk, atr,
    atrPercent: entry > 0 ? atr / entry * 100 : null, buffer };
}

export function estimatePositionSize({ balance, riskPercent, stopDistance }) {
  if (![balance, riskPercent, stopDistance].every(Number.isFinite) || balance <= 0 || riskPercent <= 0 || riskPercent > 100 || stopDistance <= 0) return null;
  const riskBudget = balance * riskPercent / 100;
  return { riskBudget, estimatedOunces: riskBudget / stopDistance };
}
