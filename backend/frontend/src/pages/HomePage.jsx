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

  const twoYear =
    dashboardData?.rates?.twoYear?.value ?? "--";

  const yieldCurve =
    dashboardData?.rates?.yieldCurveSpread?.value ?? "--";

  const fiveYearBreakeven =
    dashboardData?.inflation?.fiveYearBreakeven?.value ?? "--";

  const corePce =
    dashboardData?.inflation?.corePce?.value ?? "--";

  const ppi =
    dashboardData?.inflation?.ppi?.value ?? "--";

  const highYieldSpread =
    dashboardData?.risk?.highYieldSpread?.value ?? "--";

  const financialStress =
    dashboardData?.risk?.financialStress?.value ?? "--";

  const nonfarmPayrolls =
    dashboardData?.labour?.nonfarmPayrolls?.value ?? "--";

  const adpEmployment =
    dashboardData?.labour?.adpEmployment?.value ?? "--";

  const initialClaims =
    dashboardData?.consumerHousing?.initialClaims?.value ?? "--";

  const reverseRepo =
    dashboardData?.liquidity?.reverseRepo?.value ?? "--";

  const treasuryGeneralAccount =
    dashboardData?.liquidity?.treasuryGeneralAccount?.value ?? "--";

  const strongestBullish =
    dashboardData?.gold?.topBullishDrivers?.[0];

  const strongestBearish =
    dashboardData?.gold?.topBearishDrivers?.[0];

  const movementClass =
    goldChange > 0
      ? "movement-up"
      : goldChange < 0
        ? "movement-down"
        : "movement-flat";

  const directionalPoints =
    score
      ? score.bullishPoints + score.bearishPoints
      : 0;

  const bullishShare =
    directionalPoints > 0
      ? (score.bullishPoints / directionalPoints) * 100
      : 50;

  return (
    <>
      <PageHeader
        title="Gold Terminal"
        subtitle="Live gold, macro and risk command centre"
        currentTime={currentTime}
      />

      {/* PRIMARY COMMAND CENTRE */}

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

          <div
            className={`home-price-change ${movementClass}`}
          >
            {goldChange >= 0 ? "+" : ""}
            {goldChange.toFixed(2)}

            <span>
              {goldChangePercent >= 0 ? "+" : ""}
              {goldChangePercent.toFixed(2)}%
            </span>
          </div>

          <p className="home-live-caption">
            Change since previous live update
          </p>

          <div className="home-session-strip">
            <HomeStat
              label="Observed High"
              value={
                sessionHigh !== null
                  ? sessionHigh.toFixed(2)
                  : "--"
              }
            />

            <HomeStat
              label="Observed Low"
              value={
                sessionLow !== null
                  ? sessionLow.toFixed(2)
                  : "--"
              }
            />

            <HomeStat
              label="Observed Range"
              value={
                sessionRange !== null
                  ? sessionRange.toFixed(2)
                  : "--"
              }
            />
          </div>
        </div>

        <div className="home-score-hero">
          <div className="home-score-header">
            <div>
              <span className="section-label">
                Gold Score
              </span>

              <h2>
                {formatSignedScore(goldScore)}
              </h2>
            </div>

            <span className={getBiasClass(bias)}>
              {bias}
            </span>
          </div>

          <p>{goldSummary}</p>

          <div className="home-score-stats">
            <HomeStat
              label="Confidence"
              value={
                confidence === "--"
                  ? "--"
                  : `${confidence}%`
              }
            />

            <HomeStat
              label="Lean"
              value={lean}
            />

            <HomeStat
              label="Bullish"
              value={
                score
                  ? `+${score.bullishPoints}`
                  : "--"
              }
              className="positive-score"
            />

            <HomeStat
              label="Bearish"
              value={
                score
                  ? `-${score.bearishPoints}`
                  : "--"
              }
              className="negative-score"
            />
          </div>

          <div className="home-score-balance">
            <div className="home-balance-header">
              <span>Driver Balance</span>

              <strong>
                {score
                  ? `${score.bullishPoints} vs ${score.bearishPoints}`
                  : "--"}
              </strong>
            </div>

            <div className="home-balance-track">
              <div
                className="home-balance-bullish"
                style={{
                  width: `${bullishShare}%`,
                }}
              />
            </div>

            <div className="home-balance-labels">
              <span className="positive-score">
                Bullish
              </span>

              <span className="negative-score">
                Bearish
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE MARKET TAPE */}

      <section className="home-market-tape">
        <TapeItem
          label="2Y Treasury"
          value={twoYear}
        />

        <TapeItem
          label="10Y Treasury"
          value={tenYearYield}
        />

        <TapeItem
          label="10Y Real Yield"
          value={realYield}
          featured
        />

        <TapeItem
          label="Broad USD"
          value={dollarIndex}
        />

        <TapeItem
          label="VIX"
          value={vix}
        />

        <TapeItem
          label="HY Spread"
          value={highYieldSpread}
        />
      </section>

      {/* MACRO REGIME */}

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

      {/* THREE MACRO WATCH PANELS */}

      <section className="home-watch-grid">
        <WatchPanel
          label="Rates"
          title="Rates Watch"
          items={[
            {
              label: "Fed Funds",
              value: fedFunds,
            },
            {
              label: "2Y Treasury",
              value: twoYear,
            },
            {
              label: "10Y Treasury",
              value: tenYearYield,
            },
            {
              label: "Yield Curve",
              value: yieldCurve,
            },
          ]}
        />

        <WatchPanel
          label="Inflation"
          title="Inflation Watch"
          items={[
            {
              label: "5Y Breakeven",
              value: fiveYearBreakeven,
            },
            {
              label: "10Y Breakeven",
              value: inflation,
            },
            {
              label: "Core PCE",
              value: corePce,
            },
            {
              label: "PPI",
              value: ppi,
            },
          ]}
        />

        <WatchPanel
          label="Risk"
          title="Risk Watch"
          items={[
            {
              label: "VIX",
              value: vix,
            },
            {
              label: "HY Spread",
              value: highYieldSpread,
            },
            {
              label: "Financial Stress",
              value: financialStress,
            },
            {
              label: "Broad USD",
              value: dollarIndex,
            },
          ]}
        />
      </section>

      {/* MACRO PULSE */}

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

      {/* LABOUR + LIQUIDITY */}

      <section className="home-secondary-grid">
        <div className="home-secondary-panel">
          <div className="home-panel-heading">
            <div>
              <span className="section-label">
                Labour
              </span>

              <h2>Employment Pulse</h2>
            </div>
          </div>

          <div className="home-secondary-stats">
            <HomeStat
              label="Unemployment"
              value={unemployment}
            />

            <HomeStat
              label="Nonfarm Payrolls"
              value={nonfarmPayrolls}
            />

            <HomeStat
              label="ADP Employment"
              value={adpEmployment}
            />

            <HomeStat
              label="Initial Claims"
              value={initialClaims}
            />
          </div>
        </div>

        <div className="home-secondary-panel">
          <div className="home-panel-heading">
            <div>
              <span className="section-label">
                Liquidity
              </span>

              <h2>System Liquidity</h2>
            </div>
          </div>

          <div className="home-secondary-stats">
            <HomeStat
              label="M2"
              value={m2}
            />

            <HomeStat
              label="Reverse Repo"
              value={reverseRepo}
            />

            <HomeStat
              label="Treasury Account"
              value={treasuryGeneralAccount}
            />

            <HomeStat
              label="Dollar"
              value={dollarIndex}
            />
          </div>
        </div>
      </section>
<section className="home-geopolitical-panel">
  <div>
    <span className="section-label">
      Geopolitical Risk
    </span>

    <h2>Coming Soon</h2>

    <p>
      Future feed will track gold-relevant geopolitical risk:
      war risk, sanctions, oil shocks, central-bank tension,
      and major global instability headlines.
    </p>
  </div>

  <span className="geo-status-badge">
    Not Connected Yet
  </span>
</section>
      {/* STRONGEST FORCES */}

      <section className="home-force-grid">
        <div className="home-force-card bullish-force">
          <span className="section-label">
            Strongest Support
          </span>

          <h3>
            {formatDriverName(
              strongestBullish?.indicator
            )}
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
            {formatDriverName(
              strongestBearish?.indicator
            )}
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

      {/* TOP DRIVERS */}

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

function HomeStat({
  label,
  value,
  className = "",
}) {
  return (
    <div className="home-stat">
      <span>{label}</span>
      <strong className={className}>
        {value}
      </strong>
    </div>
  );
}

function TapeItem({
  label,
  value,
  featured = false,
}) {
  return (
    <div
      className={
        featured
          ? "home-tape-item home-tape-featured"
          : "home-tape-item"
      }
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

function WatchPanel({
  label,
  title,
  items,
}) {
  return (
    <div className="home-watch-panel">
      <span className="section-label">
        {label}
      </span>

      <h3>{title}</h3>

      <div className="home-watch-list">
        {items.map((item) => (
          <div
            className="home-watch-row"
            key={item.label}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
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

  return value > 0
    ? `+${value}`
    : `${value}`;
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

function formatDriverName(name) {
  if (!name) {
    return "Waiting for signal";
  }

  const labels = {
    "10Y real yield": "10Y Real Yield",
    "US dollar": "US Dollar",
    "10Y inflation expectations":
      "10Y Inflation Expectations",
    "Core PCE inflation":
      "Core PCE Inflation",
    "Producer prices":
      "Producer Prices",
    "Financial stress":
      "Financial Stress",
    "Market volatility":
      "Market Volatility",
    "High-yield spread":
      "High-Yield Spread",
    "ADP employment":
      "ADP Employment",
    "NFP hiring momentum":
      "Nonfarm Payrolls",
  };

  return labels[name] || name;
}

function buildTerminalInsight(
  bias,
  bullish,
  bearish
) {
  const bullishName =
    formatDriverName(bullish?.indicator);

  const bearishName =
    formatDriverName(bearish?.indicator);

  if (bias === "Neutral") {
    if (bullish && bearish) {
      return `${bullishName} is supporting gold while ${bearishName} is applying opposing pressure. The model currently sees balanced macro forces.`;
    }

    return "The macro model currently sees balanced forces with no dominant directional advantage.";
  }

  if (bias === "Bullish") {
    return bullish
      ? `${bullishName} is currently the strongest positive force supporting the bullish gold regime.`
      : "The Gold Score model currently identifies a bullish macro regime.";
  }

  if (bias === "Bearish") {
    return bearish
      ? `${bearishName} is currently the strongest negative force reinforcing the bearish gold regime.`
      : "The Gold Score model currently identifies a bearish macro regime.";
  }

  return "Waiting for the Gold Score engine to establish the current macro regime.";
}

export default HomePage;