import { formatMacroValue } from "../lib/macroFormat.mjs";
import PageHeader from "../components/PageHeader";
import DashboardSection from "../components/DashboardSection";

const sections = [
  ['Rates', 'Interest Rates', [['Fed Funds', 'rates.fedFunds'], ['2Y Treasury', 'rates.twoYear'], ['10Y Treasury', 'rates.tenYear'], ['10Y Real Yield', 'realYields.tenYearRealYield']]],
  ['Inflation', 'Inflation Conditions', [['5Y Breakeven', 'inflation.fiveYearBreakeven'], ['10Y Breakeven', 'inflation.tenYearBreakeven'], ['Core PCE', 'inflation.corePce'], ['PPI · All commodities', 'inflation.ppi']]],
  ['Labour', 'Labour Market', [['Unemployment', 'labour.unemploymentRate'], ['Nonfarm Payrolls', 'labour.nonfarmPayrolls'], ['ADP Employment', 'labour.adpEmployment'], ['Initial Claims', 'consumerHousing.initialClaims']]],
  ['Growth', 'Economic Growth', [['Real GDP', 'growth.realGdp'], ['Industrial Production', 'growth.industrialProduction'], ['Retail Sales', 'growth.retailSales'], ['Consumer Sentiment', 'consumerHousing.consumerSentiment']]],
  ['Liquidity', 'System Liquidity', [['M2 Money Supply', 'liquidity.m2MoneySupply'], ['Reverse Repo', 'liquidity.reverseRepo'], ['Treasury General Account', 'liquidity.treasuryGeneralAccount'], ['Housing Starts', 'consumerHousing.housingStarts']]],
  ['Risk', 'Financial Conditions', [['VIX', 'risk.vix'], ['Financial Stress', 'risk.financialStress'], ['High-Yield Spread', 'risk.highYieldSpread'], ['Dollar', 'currency.dollarIndex']]]
];

function MacroMetric({ label, observation }) {
  const display = observation?.display;
  const checked = display?.checkedAt ? new Date(display.checkedAt) : null;
  return <div className="card macro-metric">
    <span>{label}</span>
    <h2>{display ? formatMacroValue(display.value, display) : 'Unavailable'}</h2>
    <p>{display?.description ?? 'Waiting for economic data with verified units.'}</p>
    {display && <>
      <p>Period: <strong>{observation.date}</strong></p>
      <p>Previous: {formatMacroValue(display.previousValue, display)}{display.previousDate ? ` (${display.previousDate})` : ''}</p>
      <small>{display.status}. Figures can be revised.</small>
      <p><a href={display.sourceUrl} target="_blank" rel="noreferrer">FRED · {display.seriesId}</a></p>
      <small>Source checked: {checked && Number.isFinite(checked.getTime()) ? checked.toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'unknown'}</small>
    </>}
  </div>;
}

function MacroPage({ dashboardData, currentTime }) {
  return <>
    <PageHeader title="Macro" subtitle="US macroeconomic conditions" currentTime={currentTime} />
    <div className="card">
      <p>Latest available economic readings. YoY means year-on-year; MoM means month-on-month. Payrolls show jobs added or lost, not total employment.</p>
      <p>Period is the observation date, not the release date (monthly and quarterly series use the period's first day). Previous uses the latest available revisions. FRED responses are cached for 10 minutes; source publication and dashboard refresh can add delay. This is not a live economic calendar or a consensus-forecast feed.</p>
    </div>
    {sections.map(([label, title, metrics]) => <DashboardSection key={label} label={label} title={title}>
      <div className="card-grid">
        {metrics.map(([name, path]) => <MacroMetric key={path} label={name}
          observation={path.split('.').reduce((data, key) => data?.[key], dashboardData)} />)}
      </div>
    </DashboardSection>)}
  </>;
}
export default MacroPage;
