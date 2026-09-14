function GoldPriceChart({ history, watchLevels = [] }) {
  if (!history || history.length < 2) {
    return (
      <div className="chart-panel">
        <h3>XAUUSD Live History</h3>
        <p>Collecting price data...</p>
      </div>
    );
  }

  const prices = history.map((item) => item.price);

  const levels = watchLevels.filter((level) => Number.isFinite(level.price) && level.price > 0);
  const scalePrices = [...prices, ...levels.map((level) => level.price)];
  const low = Math.min(...scalePrices);
  const high = Math.max(...scalePrices);
  const padding = levels.length ? (high - low || 1) * 0.15 : 0;
  const min = low - padding;
  const max = high + padding;
  const range = max - min || 1;

  const points = history
    .map((item, index) => {
      const x = (index / (history.length - 1)) * 100;
      const y = 100 - ((item.price - min) / range) * 100;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="chart-panel">
      <div className="chart-header">
        <div>
          <span className="section-label">XAUUSD</span>
          <h3>Live Price History</h3>
        </div>

        <span className="driver-count">
          {history.length} readings
        </span>
      </div>

      <div className="chart-container" style={{ position: "relative" }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="gold-chart"
        >
          {levels.map((level) => (
            <line
              key={level.label}
              x1="0" x2="100"
              y1={100 - ((level.price - min) / range) * 100}
              y2={100 - ((level.price - min) / range) * 100}
              stroke={level.color}
              strokeWidth="1.5"
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {levels.map((level) => (
          <span key={level.label} style={{
            position: "absolute", right: 0,
            top: ((max - level.price) / range) * 100 + "%",
            transform: "translateY(-100%)", color: level.color,
            background: "#141414", padding: "3px 6px", fontSize: 12,
            borderRadius: 4, pointerEvents: "none",
          }}>
            {level.label} {level.price.toFixed(2)}
          </span>
        ))}
      </div>

      <div className="chart-range">
        <span>{min.toFixed(2)}</span>
        <span>{max.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default GoldPriceChart;