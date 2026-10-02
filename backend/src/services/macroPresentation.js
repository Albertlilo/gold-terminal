// Display transformations only: retain original levels for scoring and other consumers.
const definitions = {
  DFF: ['%', 'Effective federal funds rate'],
  DGS2: ['%', '2-year Treasury yield'], DGS10: ['%', '10-year Treasury yield'],
  DFII10: ['%', 'Inflation-adjusted 10-year yield'],
  T5YIE: ['%', '5-year inflation expectations'], T10YIE: ['%', '10-year inflation expectations'],
  UNRATE: ['%', 'Unemployment rate · seasonally adjusted'],
  PCEPILFE: ['% YoY', 'Core PCE inflation · seasonally adjusted', 'year'],
  PPIACO: ['% YoY', 'All-commodities PPI · not seasonally adjusted', 'year'],
  PAYEMS: ['K jobs', 'Monthly payroll change · seasonally adjusted', 'jobs', 1],
  ADPMNUSNERSA: ['K jobs', 'Monthly private payroll change · seasonally adjusted', 'jobs', 0.001],
  GDPC1: ['% annualized', 'Real GDP · quarter-on-quarter annualized', 'quarter'],
  INDPRO: ['% MoM', 'Industrial production · seasonally adjusted', 'month'],
  RSAFS: ['% MoM', 'Retail sales · seasonally adjusted', 'month'],
  M2SL: ['USD trillion', 'Broad money supply · seasonally adjusted', 'level', 0.001],
  RRPONTSYD: ['USD billion', 'Overnight reverse repo balance'],
  WTREGEN: ['USD billion', 'Treasury General Account · weekly average', 'level', 0.001],
  HOUST: ['K homes', 'Housing starts · seasonally adjusted annual rate'],
  ICSA: ['K claims', 'Weekly initial jobless claims · seasonally adjusted', 'level', 0.001],
  UMCSENT: ['index', 'Consumer sentiment · index, not a percentage'],
  VIXCLS: ['index', 'VIX · volatility index'],
  STLFSI4: ['index', 'Financial stress · below zero is below-average stress'],
  BAMLH0A0HYM2: ['%', 'High-yield option-adjusted credit spread'],
  DTWEXBGS: ['index', 'Broad trade-weighted US dollar · not DXY']
};

const rawUnits = {
  PCEPILFE: 'Index 2017=100', PPIACO: 'Index 1982=100',
  PAYEMS: 'Thousands of persons', ADPMNUSNERSA: 'Persons',
  GDPC1: 'Billions of chained 2017 dollars', INDPRO: 'Index 2017=100',
  RSAFS: 'Millions of dollars', M2SL: 'Billions of dollars', RRPONTSYD: 'Billions of dollars',
  WTREGEN: 'Millions of dollars', HOUST: 'Thousands of units', ICSA: 'Persons',
  UMCSENT: 'Index 1966:Q1=100', VIXCLS: 'Index', STLFSI4: 'Index', DTWEXBGS: 'Index Jan 2006=100'
};

function cleanObservations(raw) {
  return [...new Map(raw.filter(item => item && typeof item.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(Date.parse(item.date))
    && item.value !== null && String(item.value).trim() !== '' && Number.isFinite(Number(item.value)))
    .map(item => [item.date, { date: item.date, value: Number(item.value) }])).values()]
    .sort((a, b) => b.date.localeCompare(a.date));
}

function macroPresentation(seriesId, observations, checkedAt) {
  const definition = definitions[seriesId];
  if (!definition) return null;
  const [unit, description, mode = 'level', scale = 1] = definition;
  const monthNumber = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  function at(index) {
    const point = observations[index];
    if (!point) return null;
    if (mode === 'level') return point.value * scale;
    const offset = mode === 'year' ? 12 : mode === 'quarter' ? 3 : 1;
    const base = observations.find(item => monthNumber(item.date) === monthNumber(point.date) - offset);
    if (!base) return null;
    if (mode === 'jobs') return (point.value - base.value) * scale;
    if (base.value <= 0 || point.value < 0) return null;
    const result = ((point.value / base.value) ** (mode === 'quarter' ? 4 : 1) - 1) * 100;
    return Number.isFinite(result) ? result : null;
  }
  return { value: at(0), previousValue: at(1), previousDate: observations[1]?.date ?? null,
    unit, description, seriesId, checkedAt, sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
    decimals: unit.startsWith('K ') ? 0 : 2,
    signed: ['jobs', 'month', 'quarter'].includes(mode),
    status: at(0) === null ? 'Insufficient comparable observations' : 'Latest available observation' };
}

module.exports = { macroPresentation, cleanObservations, rawUnits };
