import PageHeader from "../components/PageHeader";
import DashboardSection from "../components/DashboardSection";
import MetricCard from "../components/MetricCard";
import DriverList from "../components/DriverList";

function HomePage({
  dashboardData,
  currentTime,
  goldPrice,
  goldScore,
  goldSummary,
  dollarIndex,
  tenYearYield,
  realYield,
  inflation,
  fedFunds,
  unemployment,
  vix,
  m2,
  goldMovement,
  goldChange,
  goldChangePercent,
  sessionHigh,
  sessionLow,
  sessionRange,
}) {
  const score = dashboardData?.gold?.score;

  const bias = score?.bias ?? "--";
  const confidence = score?.confidence ?? "--";
  const lean = score?.lean ?? "--";

  const movementClass =
    goldChange > 0
      ? "movement-up"
      : goldChange < 0
        ? "movement-down"
        : "movement-flat";

  const strongestBullish =
    dashboardData?.gold?.topBullishDrivers?.[0];

  const strongestBearish =
    dashboardData?.gold?.topBearishDrivers?.[0];

  return (
    <>
      <PageHeader
        title="Gold Terminal"
        subtitle="Live gold, macro and risk command centre"
        currentTime={currentTime}
      />

      <section className="home-command-grid">
        <div className="home-gold-hero">
          <div className="home-hero-top">
            <div>
              <span className="section-label">
                Primary Market
              </span>

              <h2>XAUUSD</h2>
            </div>

            <span
              className={`home-market-status ${movementClass}`}
            >
              {goldMovement}
            </span>
          </div>

          <div className="home-price">
            {goldPrice}
          </div>

          <div className={`home-price-change ${movementClass}`}>
            {goldChange >= 0 ? "+" : ""}
            {goldChange.toFixed(2)}

            <span>
              {goldChangePercent >= 0 ? "+" : ""}
              {goldChangePercent.toFixed(2)}%
            </span>
          </div>

          <div className="home-session-strip">
            <div>
              <span>Observed High</span>
              <strong>
                {sessionHigh !== null
                  ? sessionHigh.toFixed(2)
                  : "--"}
              </strong>
            </div>

            <div>
              <span>Observed Low</span>
              <strong>
                {sessionLow !== null
                  ? sessionLow.toFixed(2)
                  : "--"}
              </strong>
            </div>

            <div>
              <span>Observed Range</span>
              <strong>
                {sessionRange !== null
                  ? sessionRange.toFixed(2)
                  : "--"}
              </strong>
            </div>
          </div>
        </div>

        <div className="home-score-hero">
          <div className="home-score-header">
            <div>
              <span className="section-label">
                Gold Score
              </span>

              <h2>{formatSignedScore(goldScore)}</h2>
            </div>

            <span className={getBiasClass(bias)}>
              {bias}
            </span>
          </div>

          <p>{goldSummary}</p>

          <div className="home-score-stats">
            <div>
              <span>Confidence</span>
              <strong>
                {confidence === "--"
                  ? "--"
                  : `${confidence}%`}
              </strong>
            </div>

            <div>
              <span>Lean</span>
              <strong>{lean}</strong>
            </div>

            <div>
              <span>Bullish</span>
              <strong className="positive-score">
                {score
                  ? `+${score.bullishPoints}`
                  : "--"}
              </strong>
            </div>

            <div>
              <span>Bearish</span>
              <strong className="negative-score">
                {score
                  ? `-${score.bearishPoints}`
                  : "--"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="home-regime-panel">
        <div className="home-regime-heading">
          <div>
            <span className="section-label">
              Current Environment
            </span>

            <h2>Macro Regime</h2>
          </div>

          <span className="regime-badge">
            {bias}
          </span>
        </div>

        <div className="regime-grid">
          <RegimeItem
            label="Real Yields"
            value={realYield}
            description="Major gold pressure"
          />

          <RegimeItem
            label="US Dollar"
            value={dollarIndex}
            description="Currency pressure"
          />

          <RegimeItem
            label="Inflation Expectations"
            value={inflation}
            description="10Y breakeven"
          />

          <RegimeItem
            label="Volatility"
            value={vix}
            description="VIX risk gauge"
          />
        </div>
      </section>

      <DashboardSection
        label="Macro Pulse"
        title="Key Conditions"
      >
        <div className="home-macro-grid">
          <MetricCard
            label="Fed Funds"
            value={fedFunds}
            description="Current policy rate"
          />

          <MetricCard
            label="10Y Treasury"
            value={tenYearYield}
            description="Nominal yield"
          />

          <MetricCard
            label="10Y Real Yield"
            value={realYield}
            description="Real-rate pressure"
          />

          <MetricCard
            label="10Y Inflation"
            value={inflation}
            description="Inflation expectations"
          />

          <MetricCard
            label="Unemployment"
            value={unemployment}
            description="US labour market"
          />

          <MetricCard
            label="VIX"
            value={vix}
            description="Market volatility"
          />

          <MetricCard
            label="M2 Money Supply"
            value={m2}
            description="System liquidity"
          />

          <MetricCard
            label="Broad USD"
            value={dollarIndex}
            description="Trade-weighted dollar"
          />
        </div>
      </DashboardSection>

      <section className="home-force-grid">
        <div className="home-force-card bullish-force">
          <span className="section-label">
            Strongest Support
          </span>

          <h3>
            {strongestBullish?.indicator ??
              "Waiting for signal"}
          </h3>

          <strong className="positive-score">
            {strongestBullish
              ? `+${strongestBullish.points}`
              : "--"}
          </strong>

          <p>
            Strongest bullish contribution currently
            detected by the Gold Score engine.
          </p>
        </div>

        <div className="home-force-card bearish-force">
          <span className="section-label">
            Strongest Pressure
          </span>

          <h3>
            {strongestBearish?.indicator ??
              "Waiting for signal"}
          </h3>

          <strong className="negative-score">
            {strongestBearish
              ? strongestBearish.points
              : "--"}
          </strong>

          <p>
            Strongest bearish contribution currently
            detected by the Gold Score engine.
          </p>
        </div>

        <div className="home-force-card insight-force">
          <span className="section-label">
            Terminal View
          </span>

          <h3>{goldSummary}</h3>

          <p>
            {buildTerminalInsight(
              bias,
              strongestBullish,
              strongestBearish
            )}
          </p>
        </div>
      </section>

      <section className="drivers-section">
        <DriverList
          title="Top Bullish Drivers"
          drivers={
            dashboardData?.gold?.topBullishDrivers
          }
        />

        <DriverList
          title="Top Bearish Drivers"
          drivers={
            dashboardData?.gold?.topBearishDrivers
          }
        />
      </section>
    </>
  );
}

function RegimeItem({
  label,
  value,
  description,
}) {
  return (
    <div className="regime-item">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>
  );
}

function formatSignedScore(value) {
  if (
    value === "--" ||
    value === null ||
    value === undefined
  ) {
    return "--";
  }

  return value > 0 ? `+${value}` : `${value}`;
}

function getBiasClass(bias) {
  if (bias === "Bullish") {
    return "home-bias positive-score";
  }

  if (bias === "Bearish") {
    return "home-bias negative-score";
  }

  return "home-bias neutral-score";
}

function buildTerminalInsight(
  bias,
  bullish,
  bearish
) {
  if (bias === "Neutral") {
    if (bullish && bearish) {
      return `${bullish.indicator} is supporting gold while ${bearish.indicator} is applying opposing pressure. The model currently sees balanced macro forces.`;
    }

    return "The macro model currently sees balanced forces with no dominant directional advantage.";
  }

  if (bias === "Bullish") {
    return bullish
      ? `${bullish.indicator} is currently the strongest positive force supporting the bullish gold regime.`
      : "The Gold Score model currently identifies a bullish macro regime.";
  }

  if (bias === "Bearish") {
    return bearish
      ? `${bearish.indicator} is currently the strongest negative force reinforcing the bearish gold regime.`
      : "The Gold Score model currently identifies a bearish macro regime.";
  }

  return "Waiting for the Gold Score engine to establish the current macro regime.";
}

export default HomePage;