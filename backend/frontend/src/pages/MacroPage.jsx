import { formatMacroValue } from "../lib/macroFormat.mjs";
import PageHeader from "../components/PageHeader";
import DashboardSection from "../components/DashboardSection";

const sections = [
  ['Rates', 'Interest Rates', [['2Y Treasury', 'rates.twoYear'], ['10Y Treasury', 'rates.tenYear'], ['10Y Real Yield', 'realYields.tenYearRealYield']]],
  ['Inflation', 'Inflation Conditions', [['5Y Breakeven', 'inflation.fiveYearBreakeven'], ['10Y Breakeven', 'inflation.tenYearBreakeven'], ['Core PCE', 'inflation.corePce'], ['PPI · All commodities', 'inflation.ppi']]],
  ['Labour', 'Labour Market', [['Unemployment', 'labour.unemploymentRate'], ['Nonfarm Payrolls', 'labour.nonfarmPayrolls'], ['ADP Employment', 'labour.adpEmployment'], ['Initial Claims', 'consumerHousing.initialClaims'], ['Average Hourly Earnings', 'wages.averageHourlyEarnings']]],
  ['Growth', 'Economic Growth', [['Real GDP', 'growth.realGdp'], ['Industrial Production', 'growth.industrialProduction'], ['Retail Sales', 'growth.retailSales'], ['Consumer Sentiment', 'consumerHousing.consumerSentiment']]],
  ['Liquidity', 'System Liquidity', [['M2 Money Supply', 'liquidity.m2MoneySupply'], ['Reverse Repo', 'liquidity.reverseRepo'], ['Treasury General Account', 'liquidity.treasuryGeneralAccount'], ['Housing Starts', 'consumerHousing.housingStarts']]],
  ['Risk', 'Financial Conditions', [['VIX', 'risk.vix'], ['Financial Stress', 'risk.financialStress'], ['High-Yield Spread', 'risk.highYieldSpread'], ['Dollar', 'currency.dollarIndex']]]
];

function londonTimestamp(timestamp) {
  if (!timestamp) return 'Not available';
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime())
    ? `${date.toLocaleString('en-GB', { timeZone: 'Europe/London' })} London time`
    : 'Not available';
}

function MacroMetric({ label, observation }) {
  const display = observation?.display;
  return <div className="card macro-metric">
    <span>{label}</span>
    <h2>{display ? formatMacroValue(display.value, display) : 'Unavailable'}</h2>
    <p>{display?.description ?? 'Waiting for economic data with verified units.'}</p>
    {display && <>
      <p>Observation period: <strong>{observation.date}</strong></p>
      <p>Previous: {formatMacroValue(display.previousValue, display)}{display.previousDate ? ` (${display.previousDate})` : ''}</p>
      {label === 'Nonfarm Payrolls' && <p>PAYEMS is an employment level; this value is its month-on-month difference, in thousands of jobs.</p>}
      {label === 'Nonfarm Payrolls' && <p>Interpret the report against consensus forecasts. A verified consensus feed is not connected, so no surprise is calculated.</p>}
      {label === 'ADP Employment' && <p>Private-sector estimate only; excludes government payrolls and does not guarantee NFP.</p>}
      {label === 'ADP Employment' && <p>The existing Gold Score contribution is a weighted input, not a standalone USD signal or forecast-surprise comparison.</p>}
      {label === 'Unemployment' && <p>Household survey measure; a rising rate does not by itself mean payroll employment fell.</p>}
      {label === 'Initial Claims' && <p>Lower claims can mean fewer new benefit applications; they do not necessarily mean stronger hiring.</p>}
      {label === 'Average Hourly Earnings' && <p>Wage growth may affect inflation concerns and expected Fed policy; the effect is conditional.</p>}
      <small>{display.stale ? 'Cached after a failed FRED refresh.' : display.status}. Figures can be revised.</small>
      <small>Data freshness: {display.freshness ?? 'Not verified'}</small>
      <p><a href={display.sourceUrl} target="_blank" rel="noreferrer">FRED · {display.seriesId}</a></p>
      <small>Source checked: {londonTimestamp(display.checkedAt)}</small>
      <small>Official release time: Not available</small>
    </>}
  </div>;
}

function PolicyRateCard({ policy }) {
  const lower = policy?.targetLower;
  const upper = policy?.targetUpper;
  const effective = policy?.effectiveRate;
  const line = (name, item) => <p>{name}: <strong>{item?.display ? formatMacroValue(item.display.value, item.display) : 'Unavailable'}</strong>
    {item?.date ? ` · observation ${item.date}` : ''}
    {item?.display?.previousDate ? ` · previous ${formatMacroValue(item.display.previousValue, item.display)} (${item.display.previousDate})` : ''}
    {item && <small className="macro-policy-meta">FRED · <a href={`https://fred.stlouisfed.org/series/${item.display?.seriesId ?? ''}`} target="_blank" rel="noreferrer">{item.display?.seriesId}</a> · checked {londonTimestamp(item.display?.checkedAt)} · official release time: Not available</small>}
  </p>;
  return <DashboardSection label="Rates" title="Federal Reserve Policy Rate">
    <div className="card macro-policy-card">
      <h2>Federal Reserve Policy Rate</h2>
      <p>Target range: <strong>{lower?.display && upper?.display
        ? `${formatMacroValue(lower.display.value, lower.display)} – ${formatMacroValue(upper.display.value, upper.display)}`
        : 'Unavailable'}</strong></p>
      {line('Lower bound', lower)}
      {line('Upper bound', upper)}
      {line('Effective rate', effective)}
      <details>
        <summary>Why these rates differ</summary>
        <p>The Federal Reserve sets a target range. The effective federal funds rate measures actual overnight federal funds transactions and may differ from the target range’s upper bound. It is not assumed to equal the range midpoint.</p>
      </details>
    </div>
  </DashboardSection>;
}

function MacroPage({ dashboardData, currentTime }) {
  return <>
    <PageHeader title="Macro" subtitle="US macroeconomic conditions" currentTime={currentTime} />
    <div className="card">
      <p>Latest available economic readings. YoY means year-on-year; MoM means month-on-month. Payrolls show jobs added or lost, not total employment.</p>
      <p>Observation period is the period represented by the data, not its release date. “Source checked” is when this application fetched the series from FRED. Official release times are shown only when verified; none are currently connected. FRED responses are cached for 10 minutes and may include later revisions.</p>
    </div>
    <PolicyRateCard policy={dashboardData?.rates?.fedPolicy} />
    {sections.map(([label, title, metrics]) => <DashboardSection key={label} label={label} title={title}>
      <div className="card-grid">
        {metrics.map(([name, path]) => <MacroMetric key={path} label={name}
          observation={path.split('.').reduce((data, key) => data?.[key], dashboardData)} />)}
      </div>
    </DashboardSection>)}
    <DashboardSection label="Context" title="How US data may affect EUR/USD">
      <div className="card macro-context-card">
        <p>Stronger-than-expected US employment, wages, or inflation can support the US dollar if markets expect tighter Federal Reserve policy, which may pressure EUR/USD lower. Weaker-than-expected data can have the opposite effect.</p>
        <p>These relationships are conditional, can be outweighed by euro-area news or risk sentiment, and do not create a buy or sell signal by themselves. Current consensus forecasts are not connected.</p>
      </div>
    </DashboardSection>
    <DashboardSection label="Calendar" title="Scheduled economic releases">
      <div className="card macro-context-card">
        <p>Economic release calendar and forecasts are not connected. FRED provides historical observations, not a complete live forecast calendar. Scheduled times, forecasts, and actual release values are therefore not shown until a verified calendar provider is configured.</p>
      </div>
    </DashboardSection>
  </>;
}
export default MacroPage;
