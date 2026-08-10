function GoldScorePanel({ gold }) {
  const score = gold?.score;

  if (!score) {
    return (
      <section className="gold-score-loading">
        <p>Loading Gold Score...</p>
      </section>
    );
  }

  const scoreEntries = Object.entries(score.scores || {});

  const maxScore = 15;

  const scorePosition = Math.max(
    0,
    Math.min(100, ((score.totalScore + maxScore) / (maxScore * 2)) * 100)
  );

  const totalDirectionalPoints =
    score.bullishPoints + score.bearishPoints;

  const bullishShare =
    totalDirectionalPoints > 0
      ? (score.bullishPoints / totalDirectionalPoints) * 100
      : 0;

  const bearishShare =
    totalDirectionalPoints > 0
      ? (score.bearishPoints / totalDirectionalPoints) * 100
      : 0;

  const confidenceDegrees =
    Math.max(0, Math.min(100, score.confidence)) * 3.6;

  const strongestBullish = gold?.topBullishDrivers?.[0];
  const strongestBearish = gold?.topBearishDrivers?.[0];

  const insightText = buildInsight(
    score,
    strongestBullish,
    strongestBearish
  );

  return (
    <div className="gold-score-dashboard">

      {/* TOP SUMMARY */}

      <section className="gold-summary-grid">
        <div className="score-summary-card primary-score-card">
          <span className="summary-label">Total Score</span>

          <div className="total-score-layout">
            <div>
              <div className="total-score-value">
                {formatSignedScore(score.totalScore)}
                <span>/ {maxScore}</span>
              </div>

              <strong className={getBiasClass(score.bias)}>
                {score.bias}
              </strong>

              <p>{gold.summary}</p>
            </div>

            <div
              className="confidence-ring"
              style={{
                background: `conic-gradient(
                  #70d69c ${confidenceDegrees}deg,
                  #262626 ${confidenceDegrees}deg
                )`,
              }}
            >
              <div className="confidence-ring-inner">
                <strong>{score.confidence}%</strong>
                <span>Confidence</span>
              </div>
            </div>
          </div>
        </div>

        <div className="score-summary-card">
          <span className="summary-label">Bullish Points</span>

          <strong className="summary-big positive-score">
            +{score.bullishPoints}
          </strong>

          <p>
            {bullishShare.toFixed(0)}% of directional points
          </p>

          <div className="summary-symbol bullish-symbol">
            ↑
          </div>
        </div>

        <div className="score-summary-card">
          <span className="summary-label">Bearish Points</span>

          <strong className="summary-big negative-score">
            -{score.bearishPoints}
          </strong>

          <p>
            {bearishShare.toFixed(0)}% of directional points
          </p>

          <div className="summary-symbol bearish-symbol">
            ↓
          </div>
        </div>

        <div className="score-summary-card">
          <span className="summary-label">Lean</span>

          <strong className="summary-lean">
            {score.lean}
          </strong>

          <p>Current macro momentum</p>

          <div className="summary-symbol lean-symbol">
            ⚖
          </div>
        </div>
      </section>

      {/* MAIN BODY */}

      <section className="gold-score-main-grid">

        {/* DRIVER BREAKDOWN */}

        <div className="score-table-panel">
          <div className="score-panel-heading">
            <div>
              <span className="section-label">
                Macro Drivers
              </span>

              <h2>Drivers Breakdown</h2>
            </div>

            <span className="driver-count">
              {scoreEntries.length} indicators
            </span>
          </div>

          <div className="score-table-header">
            <span>Indicator</span>
            <span>Impact</span>
            <span>Points</span>
          </div>

          <div className="score-driver-list">
            {scoreEntries.map(([indicator, points]) => (
              <div
                className="score-driver-row polished-driver-row"
                key={indicator}
              >
                <div className="score-driver-name">
                  <span>
                    {formatIndicatorName(indicator)}
                  </span>
                </div>

                <div>
                  <span
                    className={
                      points > 0
                        ? "impact bullish-impact"
                        : points < 0
                          ? "impact bearish-impact"
                          : "impact neutral-impact"
                    }
                  >
                    {points > 0
                      ? "Bullish"
                      : points < 0
                        ? "Bearish"
                        : "Neutral"}
                  </span>
                </div>

                <strong
                  className={
                    points > 0
                      ? "positive-score"
                      : points < 0
                        ? "negative-score"
                        : ""
                  }
                >
                  {points > 0 ? `+${points}` : points}
                </strong>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE */}

        <div className="score-analysis-column">

          {/* SCORE DISTRIBUTION */}

          <div className="score-analysis-panel">
            <div className="score-panel-heading">
              <div>
                <span className="section-label">
                  Positioning
                </span>

                <h2>Score Distribution</h2>
              </div>
            </div>

            <div className="score-scale-wrapper">
              <div className="score-scale">
                <div
                  className="score-marker"
                  style={{
                    left: `${scorePosition}%`,
                  }}
                >
                  <span>
                    {formatSignedScore(score.totalScore)}
                  </span>
                </div>
              </div>

              <div className="score-scale-numbers">
                <span>-15</span>
                <span>0</span>
                <span>+15</span>
              </div>

              <div className="score-scale-labels">
                <span className="negative-score">
                  Bearish
                </span>

                <span>Neutral</span>

                <span className="positive-score">
                  Bullish
                </span>
              </div>
            </div>
          </div>

          {/* CONTRIBUTION */}

          <div className="score-analysis-panel">
            <div className="score-panel-heading">
              <div>
                <span className="section-label">
                  Contribution
                </span>

                <h2>Score Composition</h2>
              </div>
            </div>

            <div className="contribution-layout">
              <div
                className="contribution-ring"
                style={{
                  background: `conic-gradient(
                    #70d69c 0deg ${bullishShare * 3.6}deg,
                    #ef7b7b ${bullishShare * 3.6}deg 360deg
                  )`,
                }}
              >
                <div className="contribution-ring-inner">
                  <strong>
                    {score.bullishPoints +
                      score.bearishPoints}
                  </strong>
                  <span>Total</span>
                </div>
              </div>

              <div className="contribution-legend">
                <div>
                  <span className="legend-dot bullish-dot" />
                  <span>Bullish</span>

                  <strong className="positive-score">
                    +{score.bullishPoints}
                  </strong>
                </div>

                <div>
                  <span className="legend-dot bearish-dot" />
                  <span>Bearish</span>

                  <strong className="negative-score">
                    -{score.bearishPoints}
                  </strong>
                </div>

                <div>
                  <span className="legend-dot neutral-dot" />
                  <span>Net Score</span>

                  <strong>
                    {formatSignedScore(score.totalScore)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* FUTURE HISTORY */}

          <div className="score-analysis-panel score-history-placeholder">
            <div className="score-panel-heading">
              <div>
                <span className="section-label">
                  Historical Model
                </span>

                <h2>Gold Score Over Time</h2>
              </div>

              <span className="coming-soon-badge">
                Coming Soon
              </span>
            </div>

            <div className="history-placeholder-body">
              <div className="history-line-placeholder" />

              <p>
                Historical Gold Score storage will power
                this chart once the backend history layer
                is added.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* INSIGHT */}

      <section className="key-insight-panel">
        <div className="insight-icon">✦</div>

        <div>
          <span className="section-label">Key Insight</span>
          <p>{insightText}</p>
        </div>
      </section>
    </div>
  );
}

function formatSignedScore(value) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function getBiasClass(bias) {
  if (bias === "Bullish") {
    return "positive-score";
  }

  if (bias === "Bearish") {
    return "negative-score";
  }

  return "neutral-score";
}

function buildInsight(
  score,
  strongestBullish,
  strongestBearish
) {
  if (score.bias === "Neutral") {
    if (strongestBullish && strongestBearish) {
      return `Macro forces are balanced. ${strongestBullish.indicator} is providing the strongest bullish support while ${strongestBearish.indicator} is providing the strongest bearish pressure.`;
    }

    return "Macro forces are currently balanced with no dominant directional signal.";
  }

  if (score.bias === "Bullish") {
    return strongestBullish
      ? `The model is bullish for gold, led by ${strongestBullish.indicator}.`
      : "The current macro configuration is bullish for gold.";
  }

  return strongestBearish
    ? `The model is bearish for gold, led by ${strongestBearish.indicator}.`
    : "The current macro configuration is bearish for gold.";
}

function formatIndicatorName(name) {
  const labels = {
    realYield: "10Y Real Yield",
    dollar: "US Dollar",
    inflationExpectations:
      "10Y Inflation Expectations",
    corePce: "Core PCE Inflation",
    ppi: "Producer Prices",
    financialStress: "Financial Stress",
    vix: "Market Volatility",
    highYieldSpread:
      "High-Yield Credit Spread",
    adpEmployment: "ADP Employment",
    nonfarmPayrolls: "Nonfarm Payrolls",
  };

  return labels[name] || name;
}

export default GoldScorePanel;