import PageHeader from "../components/PageHeader";
import DashboardSection from "../components/DashboardSection";
import MetricCard from "../components/MetricCard";

function MacroPage({ dashboardData, currentTime }) {
  return (
    <>
      <PageHeader
        title="Macro"
        subtitle="US macroeconomic conditions"
        currentTime={currentTime}
      />

      <DashboardSection label="Rates" title="Interest Rates">
        <div className="card-grid">
          <MetricCard
            label="Fed Funds"
            value={dashboardData?.rates?.fedFunds?.value ?? "--"}
            description="Federal funds rate"
          />

          <MetricCard
            label="2Y Treasury"
            value={dashboardData?.rates?.twoYear?.value ?? "--"}
            description="2-year Treasury yield"
          />

          <MetricCard
            label="10Y Treasury"
            value={dashboardData?.rates?.tenYear?.value ?? "--"}
            description="10-year Treasury yield"
          />

          <MetricCard
            label="10Y Real Yield"
            value={
              dashboardData?.realYields?.tenYearRealYield?.value ?? "--"
            }
            description="Inflation-adjusted yield"
          />
        </div>
      </DashboardSection>

      <DashboardSection label="Inflation" title="Inflation Conditions">
        <div className="card-grid">
          <MetricCard
            label="5Y Breakeven"
            value={
              dashboardData?.inflation?.fiveYearBreakeven?.value ?? "--"
            }
            description="5-year inflation expectations"
          />

          <MetricCard
            label="10Y Breakeven"
            value={
              dashboardData?.inflation?.tenYearBreakeven?.value ?? "--"
            }
            description="10-year inflation expectations"
          />

          <MetricCard
            label="Core PCE"
            value={dashboardData?.inflation?.corePce?.value ?? "--"}
            description="Core inflation"
          />

          <MetricCard
            label="PPI"
            value={dashboardData?.inflation?.ppi?.value ?? "--"}
            description="Producer prices"
          />
        </div>
      </DashboardSection>

      <DashboardSection label="Labour" title="Labour Market">
        <div className="card-grid">
          <MetricCard
            label="Unemployment"
            value={
              dashboardData?.labour?.unemploymentRate?.value ?? "--"
            }
            description="Unemployment rate"
          />

          <MetricCard
            label="Nonfarm Payrolls"
            value={
              dashboardData?.labour?.nonfarmPayrolls?.value ?? "--"
            }
            description="US payroll employment"
          />

          <MetricCard
            label="ADP Employment"
            value={
              dashboardData?.labour?.adpEmployment?.value ?? "--"
            }
            description="Private employment"
          />

          <MetricCard
            label="Initial Claims"
            value={
              dashboardData?.consumerHousing?.initialClaims?.value ?? "--"
            }
            description="Weekly jobless claims"
          />
        </div>
      </DashboardSection>

      <DashboardSection label="Growth" title="Economic Growth">
        <div className="card-grid">
          <MetricCard
            label="Real GDP"
            value={dashboardData?.growth?.realGdp?.value ?? "--"}
            description="Real economic output"
          />

          <MetricCard
            label="Industrial Production"
            value={
              dashboardData?.growth?.industrialProduction?.value ?? "--"
            }
            description="Industrial activity"
          />

          <MetricCard
            label="Retail Sales"
            value={dashboardData?.growth?.retailSales?.value ?? "--"}
            description="Consumer spending"
          />

          <MetricCard
            label="Consumer Sentiment"
            value={
              dashboardData?.consumerHousing?.consumerSentiment?.value ??
              "--"
            }
            description="Consumer confidence"
          />
        </div>
      </DashboardSection>

      <DashboardSection label="Liquidity" title="System Liquidity">
        <div className="card-grid">
          <MetricCard
            label="M2 Money Supply"
            value={
              dashboardData?.liquidity?.m2MoneySupply?.value ?? "--"
            }
            description="Broad money supply"
          />

          <MetricCard
            label="Reverse Repo"
            value={
              dashboardData?.liquidity?.reverseRepo?.value ?? "--"
            }
            description="Fed reverse repo facility"
          />

          <MetricCard
            label="Treasury General Account"
            value={
              dashboardData?.liquidity?.treasuryGeneralAccount?.value ??
              "--"
            }
            description="US Treasury cash balance"
          />

          <MetricCard
            label="Housing Starts"
            value={
              dashboardData?.consumerHousing?.housingStarts?.value ?? "--"
            }
            description="Residential construction"
          />
        </div>
      </DashboardSection>

      <DashboardSection label="Risk" title="Financial Conditions">
        <div className="card-grid">
          <MetricCard
            label="VIX"
            value={dashboardData?.risk?.vix?.value ?? "--"}
            description="Market volatility"
          />

          <MetricCard
            label="Financial Stress"
            value={
              dashboardData?.risk?.financialStress?.value ?? "--"
            }
            description="Financial stress index"
          />

          <MetricCard
            label="High-Yield Spread"
            value={
              dashboardData?.risk?.highYieldSpread?.value ?? "--"
            }
            description="Credit risk spread"
          />

          <MetricCard
            label="Dollar"
            value={
              dashboardData?.currency?.dollarIndex?.value ?? "--"
            }
            description="Broad US dollar index"
          />
        </div>
      </DashboardSection>
    </>
  );
}

export default MacroPage;