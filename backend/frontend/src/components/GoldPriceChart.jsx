function GoldPriceChart({ history }) {
  if (!history || history.length < 2) {
    return (
      <div className="chart-panel">
        <h3>XAUUSD Live History</h3>
        <p>Collecting price data...</p>
      </div>
    );
  }

  const prices = history.map((item) => item.price);

  const min = Math.min(...prices);
  const max = Math.max(...prices);
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

      <div className="chart-container">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="gold-chart"
        >
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="chart-range">
        <span>{min.toFixed(2)}</span>
        <span>{max.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default GoldPriceChart;