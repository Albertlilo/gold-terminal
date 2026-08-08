function GoldScorePanel({ gold }) {
  const score = gold?.score;

  if (!score) {
    return (
      <section className="gold-score-panel">
        <p>Loading Gold Score...</p>
      </section>
    );
  }

  const scoreEntries = Object.entries(score.scores || {});

  return (
    <section className="gold-score-panel">
      <div className="gold-score-header">
        <div>
          <span className="section-label">Gold Score</span>
          <h2>{score.totalScore}</h2>
          <p>{gold.summary}</p>
        </div>

        <div className="gold-score-bias">
          <span>Bias</span>
          <strong>{score.bias}</strong>
        </div>
      </div>

      <div className="score-stats">
        <div className="score-stat">
          <span>Bullish Points</span>
          <strong>{score.bullishPoints}</strong>
        </div>

        <div className="score-stat">
          <span>Bearish Points</span>
          <strong>{score.bearishPoints}</strong>
        </div>

        <div className="score-stat">
          <span>Lean</span>
          <strong>{score.lean}</strong>
        </div>

        <div className="score-stat">
          <span>Confidence</span>
          <strong>{score.confidence}%</strong>
        </div>
      </div>

      <div className="score-breakdown">
        <div className="score-breakdown-header">
          <div>
            <span className="section-label">Macro Drivers</span>
            <h3>Score Breakdown</h3>
          </div>

          <span className="driver-count">
            {scoreEntries.length} indicators
          </span>
        </div>

        <div className="score-driver-list">
          {scoreEntries.map(([indicator, points]) => (
            <div className="score-driver-row" key={indicator}>
              <div className="score-driver-name">
                <span>{formatIndicatorName(indicator)}</span>
              </div>

              <div className="score-driver-impact">
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatIndicatorName(name) {
  const labels = {
    realYield: "10Y Real Yield",
    dollar: "US Dollar",
    inflationExpectations: "10Y Inflation Expectations",
    corePce: "Core PCE Inflation",
    ppi: "Producer Prices",
    financialStress: "Financial Stress",
    vix: "Market Volatility",
    highYieldSpread: "High-Yield Credit Spread",
    adpEmployment: "ADP Employment",
    nonfarmPayrolls: "Nonfarm Payrolls",
  };

  return labels[name] || name;
}

export default GoldScorePanel;