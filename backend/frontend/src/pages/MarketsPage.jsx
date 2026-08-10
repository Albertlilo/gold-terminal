import PageHeader from "../components/PageHeader";
import DashboardSection from "../components/DashboardSection";
import MetricCard from "../components/MetricCard";
import GoldPriceChart from "../components/GoldPriceChart";
import MarketHero from "../components/MarketHero";

function MarketsPage({
  dashboardData,
  currentTime,
  goldPrice,
  goldMovement,
  goldChange,
  goldChangePercent,
  goldHistory,
  realYield,
  dollarIndex,
  sessionHigh,
  sessionLow,
  sessionRange,
}) {
  return (
    <>
      <PageHeader
        title="Markets"
        subtitle="Price action and market confirmation"
        currentTime={currentTime}
      />

      <MarketHero
        goldPrice={goldPrice}
        goldMovement={goldMovement}
        goldChange={goldChange}
        goldChangePercent={goldChangePercent}
        sessionHigh={sessionHigh}
        sessionLow={sessionLow}
        sessionRange={sessionRange}
      />

      <GoldPriceChart history={goldHistory} />

      <DashboardSection
        label="Rates Market"
        title="Treasury Confirmation"
      >
        <div className="card-grid">
          <MetricCard
            label="2Y Treasury"
            value={dashboardData?.rates?.twoYear?.value ?? "--"}
            description="Front-end yield"
          />

          <MetricCard
            label="10Y Treasury"
            value={dashboardData?.rates?.tenYear?.value ?? "--"}
            description="Long-term yield"
          />

          <MetricCard
            label="10Y Real Yield"
            value={realYield}
            description="Key gold pressure"
          />
        </div>
      </DashboardSection>

      <DashboardSection
        label="Risk Market"
        title="Risk Confirmation"
      >
        <div className="card-grid">
          <MetricCard
            label="VIX"
            value={dashboardData?.risk?.vix?.value ?? "--"}
            description="Equity volatility"
          />

          <MetricCard
            label="High-Yield Spread"
            value={
              dashboardData?.risk?.highYieldSpread?.value ?? "--"
            }
            description="Credit stress"
          />

          <MetricCard
            label="Financial Stress"
            value={
              dashboardData?.risk?.financialStress?.value ?? "--"
            }
            description="System stress"
          />
        </div>
      </DashboardSection>

      <DashboardSection label="Currency" title="Dollar Confirmation">
        <div className="card-grid">
          <MetricCard
            label="Broad USD Index"
            value={dollarIndex}
            description="FRED trade-weighted dollar"
          />

          <MetricCard
            label="DXY"
            value="--"
            description="Live DXY feed not connected yet"
          />
        </div>
      </DashboardSection>
    </>
  );
}

export default MarketsPage;