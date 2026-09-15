import { useState } from "react";
import PageHeader from "../components/PageHeader";
import GoldCandleChart from "../components/GoldCandleChart";

const NOISE_THRESHOLD_PERCENT = 0.1;
const MIN_READINGS = 3;

function TechnicalsPage({
  dashboardData,
  currentTime,
  goldHistory,
  goldPrice,
}) {
  const [showWatchLevels, setShowWatchLevels] = useState(true);
  const score = dashboardData?.gold?.score;
  const macroBias = score?.bias ?? "--";

  const history = Array.isArray(goldHistory) ? goldHistory : [];
  const validHistory = history.filter(
    (item) => Number.isFinite(item?.price) && item.price > 0,
  );
  const hasInvalidPrices = validHistory.length !== history.length;
  const firstPrice = validHistory[0]?.price;
  const latestPrice = validHistory[validHistory.length - 1]?.price;
  const windowMovePercent = validHistory.length >= 2
    ? ((latestPrice - firstPrice) / firstPrice) * 100
    : null;
  const technicalBias = getTechnicalBias(windowMovePercent, validHistory.length, hasInvalidPrices);
  const tradeSignal = getTradeSignal(macroBias, technicalBias);
  const watchLevels = showWatchLevels && !hasInvalidPrices && validHistory.length >= MIN_READINGS
    ? [
        { label: "Buy Watch", price: firstPrice * (1 + NOISE_THRESHOLD_PERCENT / 100), color: "#70d69c" },
        { label: "Sell Watch", price: firstPrice * (1 - NOISE_THRESHOLD_PERCENT / 100), color: "#ef7b7b" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Technicals"
        subtitle="Live price-action signal layered against the macro bias"
        currentTime={currentTime}
      />

      <section className="technicals-hero-grid">
        <div className="technical-signal-card">
          <span className="section-label">Technical Signal</span>
          <h2>{tradeSignal.signal}</h2>
          <strong className={tradeSignal.className}>
            {tradeSignal.bias}
          </strong>
          <p>{tradeSignal.message}</p>
        </div>

        <div className="technical-price-card">
          <span className="section-label">XAUUSD</span>
          <h2>{goldPrice}</h2>
          <strong>{technicalBias}</strong>
          <p>
            Rolling history move: {Number.isFinite(windowMovePercent) && !hasInvalidPrices
              ? formatPercent(windowMovePercent)
              : "--"}
          </p>
          <p>Noise band: ±{NOISE_THRESHOLD_PERCENT.toFixed(2)}%</p>
        </div>

        <div className="technical-macro-card">
          <span className="section-label">Macro Filter</span>
          <h2>{macroBias}</h2>
          <strong>{formatSignedScore(score?.totalScore)} / {score?.maxScore ?? "--"}</strong>
          <p>
            The technical signal is stronger when it agrees with the Gold Score macro bias.
          </p>
        </div>
      </section>

      <p className="technical-window-note">
        Signal compares the first and latest of {validHistory.length} valid readings
        in the live signal window (up to 20 readings), separate from the saved candle chart.
        At least {MIN_READINGS} valid readings are required. The chart rescales to its price range,
        so small moves can still look steep.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
        <input type="checkbox" checked={showWatchLevels}
          onChange={(event) => setShowWatchLevels(event.target.checked)} />
        Show Buy / Sell Watch lines
      </label>
      {showWatchLevels && (
        <p className="technical-window-note">
          Green: Buy Watch above +{NOISE_THRESHOLD_PERCENT.toFixed(2)}% with bullish macro.
          Red: Sell Watch below -{NOISE_THRESHOLD_PERCENT.toFixed(2)}% with bearish macro.
          Between the lines: Wait. These are threshold levels, not confirmed entries.
          Levels update as the oldest reading in the rolling history changes;
          they appear after {MIN_READINGS} valid readings.
        </p>
      )}
      <GoldCandleChart watchLevels={watchLevels} />

      <section className="technical-rules-panel">
        <span className="section-label">Trading Logic</span>
        <h2>How to read this page</h2>

        <div className="technical-rules-grid">
          <RuleCard
            title="Sell Watch"
            text={`Bearish macro and a rolling move below -${NOISE_THRESHOLD_PERCENT.toFixed(2)}%. Watch for rejection or breakdown confirmation before considering an entry.`}
          />

          <RuleCard
            title="Buy Watch"
            text={`Bullish macro and a rolling move above +${NOISE_THRESHOLD_PERCENT.toFixed(2)}%. Watch for support or breakout confirmation before considering an entry.`}
          />

          <RuleCard
            title="Wait"
            text={`Wait when the move is within ±${NOISE_THRESHOLD_PERCENT.toFixed(2)}% (including the boundary), macro is neutral or unavailable, the signals disagree, or price data is insufficient or invalid.`}
          />
        </div>
      </section>
    </>
  );
}

function getTechnicalBias(movePercent, count, invalid) {
  if (invalid) return "Invalid Price Data";
  if (count < MIN_READINGS || !Number.isFinite(movePercent)) return "Collecting Data";
  // Ignore floating-point error at the inclusive noise-band boundary.
  if (Math.abs(movePercent) <= NOISE_THRESHOLD_PERCENT + 1e-10) return "Price Noise";
  return movePercent > 0 ? "Bullish Momentum" : "Bearish Momentum";
}

function formatPercent(value) {
  return new Intl.NumberFormat("en", {
    style: "percent", signDisplay: "exceptZero", minimumFractionDigits: 3,
    maximumFractionDigits: 6,
  }).format(value / 100);
}

function getTradeSignal(macroBias, technicalBias) {
  if (technicalBias === "Invalid Price Data") {
    return { signal: "Wait", bias: technicalBias, className: "neutral-score",
      message: "The price history contains invalid readings. Wait for valid price data." };
  }
  if (technicalBias === "Price Noise") {
    return { signal: "Wait", bias: technicalBias, className: "neutral-score",
      message: "The rolling price move is inside the noise band. There is no directional technical signal yet." };
  }
  if (technicalBias === "Collecting Data") {
    return {
      signal: "Wait",
      bias: "Collecting Data",
      className: "neutral-score",
      message: "The chart needs more live readings before giving a technical signal.",
    };
  }

  if (macroBias === "Bearish" && technicalBias === "Bearish Momentum") {
    return {
      signal: "Sell Watch",
      bias: "Macro + Technicals Agree",
      className: "negative-score",
      message: "Gold has bearish macro pressure and live price action is confirming downside momentum.",
    };
  }

  if (macroBias === "Bullish" && technicalBias === "Bullish Momentum") {
    return {
      signal: "Buy Watch",
      bias: "Macro + Technicals Agree",
      className: "positive-score",
      message: "Gold has bullish macro support and live price action is confirming upside momentum.",
    };
  }

  if (macroBias === "Bearish" && technicalBias === "Bullish Momentum") {
    return {
      signal: "Wait",
      bias: "Technical Bounce Against Macro",
      className: "neutral-score",
      message: "Macro is bearish, but price is rising. Wait for rejection or clearer confirmation.",
    };
  }

  if (macroBias === "Bullish" && technicalBias === "Bearish Momentum") {
    return {
      signal: "Wait",
      bias: "Technical Pullback Against Macro",
      className: "neutral-score",
      message: "Macro is bullish, but price is falling. Wait for support or reversal confirmation.",
    };
  }

  return {
    signal: "Wait",
    bias: "Macro Neutral or Unavailable",
    className: "neutral-score",
    message: "A directional macro bias is required before a Buy or Sell Watch can appear.",
  };
}

function RuleCard({ title, text }) {
  return (
    <div className="technical-rule-card">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function formatSignedScore(value) {
  if (value === null || value === undefined) {
    return "--";
  }

  return value > 0 ? `+${value}` : `${value}`;
}

export default TechnicalsPage;