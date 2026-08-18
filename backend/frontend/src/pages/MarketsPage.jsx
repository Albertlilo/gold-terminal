import PageHeader from "../components/PageHeader";
import GoldPriceChart from "../components/GoldPriceChart";

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
  const score = dashboardData?.gold?.score;

  const twoYear =
    dashboardData?.rates?.twoYear?.value ?? "--";

  const tenYear =
    dashboardData?.rates?.tenYear?.value ?? "--";

  const vix =
    dashboardData?.risk?.vix?.value ?? "--";

  const highYieldSpread =
    dashboardData?.risk?.highYieldSpread?.value ?? "--";

  const financialStress =
    dashboardData?.risk?.financialStress?.value ?? "--";

  const movementClass =
    goldChange > 0
      ? "movement-up"
      : goldChange < 0
        ? "movement-down"
        : "movement-flat";

  return (
    <>
      <PageHeader
        title="Markets"
        subtitle="Live price action and cross-market confirmation"
        currentTime={currentTime}
      />

      {/* MARKET COMMAND CENTRE */}

      <section className="markets-command-grid">
        <div className="markets-price-panel">
          <div className="markets-price-header">
            <div>
              <span className="section-label">
                Precious Metals
              </span>
              <h2>XAUUSD</h2>
            </div>

            <span
              className={`markets-live-direction ${movementClass}`}
            >
              {goldMovement}
            </span>
          </div>

          <div className="markets-live-price">
            {goldPrice}
          </div>

          <div
            className={`markets-live-change ${movementClass}`}
          >
            {goldChange >= 0 ? "+" : ""}
            {goldChange.toFixed(2)}

            <span>
              {goldChangePercent >= 0 ? "+" : ""}
              {goldChangePercent.toFixed(2)}%
            </span>
          </div>

          <p className="markets-price-caption">
            Change since previous live update
          </p>

          <div className="markets-session-bar">
            <MarketStat
              label="Observed High"
              value={
                sessionHigh !== null
                  ? sessionHigh.toFixed(2)
                  : "--"
              }
            />

            <MarketStat
              label="Observed Low"
              value={
                sessionLow !== null
                  ? sessionLow.toFixed(2)
                  : "--"
              }
            />

            <MarketStat
              label="Observed Range"
              value={
                sessionRange !== null
                  ? sessionRange.toFixed(2)
                  : "--"
              }
            />
          </div>
        </div>

        {/* GOLD MODEL */}

        <div className="markets-model-panel">
          <div className="markets-panel-heading">
            <div>
              <span className="section-label">
                Gold Model
              </span>

              <h2>Market Bias</h2>
            </div>

            <span className={getBiasClass(score?.bias)}>
              {score?.bias ?? "--"}
            </span>
          </div>

          <div className="markets-score-value">
            {formatSignedScore(score?.totalScore)}
          </div>

          <p>
            {dashboardData?.gold?.summary ??
              "Waiting for macro signals..."}
          </p>

          <div className="markets-model-grid">
            <MarketStat
              label="Confidence"
              value={
                score
                  ? `${score.confidence}%`
                  : "--"
              }
            />

            <MarketStat
              label="Lean"
              value={score?.lean ?? "--"}
            />

            <MarketStat
              label="Bullish"
              value={
                score
                  ? `+${score.bullishPoints}`
                  : "--"
              }
              className="positive-score"
            />

            <MarketStat
              label="Bearish"
              value={
                score
                  ? `-${score.bearishPoints}`
                  : "--"
              }
              className="negative-score"
            />
          </div>
        </div>
      </section>

      {/* LIVE CHART */}

      <GoldPriceChart history={goldHistory} />

      {/* CROSS-MARKET CONFIRMATION */}

      <section className="markets-confirmation-section">
        <div className="markets-section-heading">
          <div>
            <span className="section-label">
              Cross-Market Signals
            </span>

            <h2>Gold Confirmation Matrix</h2>
          </div>

          <span className="markets-section-note">
            Live macro confirmation
          </span>
        </div>

        <div className="markets-confirmation-grid">
          <ConfirmationCard
            label="2Y Treasury"
            value={twoYear}
            category="Rates"
            description="Front-end policy expectations"
          />

          <ConfirmationCard
            label="10Y Treasury"
            value={tenYear}
            category="Rates"
            description="Long-duration yield pressure"
          />

          <ConfirmationCard
            label="10Y Real Yield"
            value={realYield}
            category="Gold Driver"
            description="Core opportunity-cost signal"
            featured
          />

          <ConfirmationCard
            label="Broad USD"
            value={dollarIndex}
            category="Currency"
            description="Trade-weighted dollar pressure"
          />

          <ConfirmationCard
            label="VIX"
            value={vix}
            category="Risk"
            description="Equity volatility"
          />

          <ConfirmationCard
            label="High-Yield Spread"
            value={highYieldSpread}
            category="Credit"
            description="Corporate credit stress"
          />

          <ConfirmationCard
            label="Financial Stress"
            value={financialStress}
            category="System Risk"
            description="Broad financial conditions"
          />

          <ConfirmationCard
            label="DXY"
            value="--"
            category="Currency"
            description="Dedicated live feed not connected"
            unavailable
          />
        </div>
      </section>

      {/* MARKET STORY */}

      <section className="markets-story-grid">
        <div className="markets-story-card">
          <span className="section-label">
            Rates
          </span>

          <h3>Treasury Pressure</h3>

          <div className="markets-story-values">
            <div>
              <span>2Y</span>
              <strong>{twoYear}</strong>
            </div>

            <div>
              <span>10Y</span>
              <strong>{tenYear}</strong>
            </div>

            <div>
              <span>Real</span>
              <strong>{realYield}</strong>
            </div>
          </div>

          <p>
            Real yields remain one of the most important
            cross-market signals for gold because they
            represent the inflation-adjusted return available
            on competing safe assets.
          </p>
        </div>

        <div className="markets-story-card">
          <span className="section-label">
            Risk
          </span>

          <h3>Risk Environment</h3>

          <div className="markets-story-values">
            <div>
              <span>VIX</span>
              <strong>{vix}</strong>
            </div>

            <div>
              <span>HY Spread</span>
              <strong>{highYieldSpread}</strong>
            </div>

            <div>
              <span>Stress</span>
              <strong>{financialStress}</strong>
            </div>
          </div>

          <p>
            Volatility, credit spreads and financial stress
            help show whether safe-haven demand is building
            across markets.
          </p>
        </div>

        <div className="markets-story-card markets-story-highlight">
          <span className="section-label">
            Terminal View
          </span>

          <h3>
            {dashboardData?.gold?.summary ??
              "Waiting for signals"}
          </h3>

          <p>
            {buildMarketInsight(
              score,
              goldMovement,
              goldChange
            )}
          </p>
        </div>
      </section>
    </>
  );
}

function MarketStat({
  label,
  value,
  className = "",
}) {
  return (
    <div className="market-stat">
      <span>{label}</span>
      <strong className={className}>
        {value}
      </strong>
    </div>
  );
}

function ConfirmationCard({
  label,
  value,
  category,
  description,
  featured = false,
  unavailable = false,
}) {
  return (
    <div
      className={[
        "confirmation-card",
        featured ? "confirmation-featured" : "",
        unavailable ? "confirmation-unavailable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="confirmation-top">
        <span>{category}</span>

        {featured && (
          <span className="confirmation-tag">
            Key
          </span>
        )}
      </div>

      <h3>{label}</h3>

      <strong>{value}</strong>

      <p>{description}</p>
    </div>
  );
}

function formatSignedScore(value) {
  if (
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
    return "markets-bias positive-score";
  }

  if (bias === "Bearish") {
    return "markets-bias negative-score";
  }

  return "markets-bias neutral-score";
}

function buildMarketInsight(
  score,
  goldMovement,
  goldChange
) {
  if (!score) {
    return "Waiting for the Gold Score engine and live market data.";
  }

  const direction =
    goldChange > 0
      ? "rising"
      : goldChange < 0
        ? "falling"
        : "flat";

  if (score.bias === "Bullish") {
    return `The macro model is bullish while XAUUSD is currently ${direction}. This helps show whether live price action is confirming the underlying bullish macro setup.`;
  }

  if (score.bias === "Bearish") {
    return `The macro model is bearish while XAUUSD is currently ${direction}. Watch whether price action continues to confirm the macro pressure or begins to diverge from it.`;
  }

  return `The Gold Score is currently balanced while XAUUSD is ${direction}. With macro forces offsetting each other, live price action and cross-market confirmation become especially important.`;
}

export default MarketsPage;