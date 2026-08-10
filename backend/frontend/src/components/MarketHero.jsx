function MarketHero({
  goldPrice,
  goldMovement,
  goldChange,
  goldChangePercent,
  sessionHigh,
  sessionLow,
  sessionRange,
}) {
  const movementClass =
    goldChange > 0
      ? "movement-up"
      : goldChange < 0
        ? "movement-down"
        : "movement-flat";

  return (
    <section className="market-hero">
      <div className="market-hero-main">
        <span className="section-label">XAUUSD</span>

        <div className="market-price-row">
          <h2>{goldPrice}</h2>

          <span className={`market-direction ${movementClass}`}>
            {goldMovement}
          </span>
        </div>

        <p>Live gold spot market</p>

        <div className={`market-change ${movementClass}`}>
          {goldChange >= 0 ? "+" : ""}
          {goldChange.toFixed(2)}

          <span>
            {goldChangePercent >= 0 ? "+" : ""}
            {goldChangePercent.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="market-session-grid">
        <div className="market-session-stat">
          <span>Observed High</span>
          <strong>
            {sessionHigh !== null ? sessionHigh.toFixed(2) : "--"}
          </strong>
          <small>Since terminal opened</small>
        </div>

        <div className="market-session-stat">
          <span>Observed Low</span>
          <strong>
            {sessionLow !== null ? sessionLow.toFixed(2) : "--"}
          </strong>
          <small>Since terminal opened</small>
        </div>

        <div className="market-session-stat">
          <span>Observed Range</span>
          <strong>
            {sessionRange !== null ? sessionRange.toFixed(2) : "--"}
          </strong>
          <small>High minus low</small>
        </div>
      </div>
    </section>
  );
}

export default MarketHero;