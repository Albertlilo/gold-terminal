export function formatMacroValue(value, display) {
  if (!Number.isFinite(value)) return 'Unavailable';
  return `${value.toLocaleString('en-GB', {
    minimumFractionDigits: display.decimals, maximumFractionDigits: display.decimals,
    signDisplay: display.signed ? 'exceptZero' : 'auto'
  })} ${display.unit}`;
}

export function formatMacroObservation(observation) {
  return observation?.display ? formatMacroValue(observation.display.value, observation.display) : 'Unavailable';
}
