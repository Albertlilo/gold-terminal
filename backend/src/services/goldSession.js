// Standard spot-gold session estimate, not a broker holiday calendar.
const nyClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", weekday: "short", hour: "2-digit", hourCycle: "h23",
});

function getGoldSession(now = Date.now()) {
  const parts = Object.fromEntries(nyClock.formatToParts(new Date(now)).map(part => [part.type, part.value]));
  const hour = Number(parts.hour);
  const weekend = parts.weekday === "Sat" || (parts.weekday === "Fri" && hour >= 17) || (parts.weekday === "Sun" && hour < 18);
  const maintenance = !weekend && hour === 17;
  return { isOpen: !weekend && !maintenance, label: weekend ? "Weekend closure" : maintenance ? "Daily maintenance break" : "Scheduled session open" };
}

module.exports = { getGoldSession };

