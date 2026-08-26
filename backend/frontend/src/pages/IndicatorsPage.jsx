import PageHeader from "../components/PageHeader";

const indicators = [
  {
    title: "10Y Real Yield",
    what: "The return investors earn from a 10-year U.S. bond after adjusting for inflation.",
    why: "Gold does not pay interest, so real yields are one of the biggest pressure points for gold.",
    bullish: "Falling real yields usually support gold.",
    bearish: "Rising real yields usually pressure gold.",
  },
  {
    title: "Broad US Dollar Index",
    what: "A trade-weighted measure of the U.S. dollar against major trading partners.",
    why: "Gold is priced in dollars, so a stronger dollar can make gold more expensive globally.",
    bullish: "A weaker dollar usually supports gold.",
    bearish: "A stronger dollar usually pressures gold.",
  },
  {
    title: "10Y Inflation Expectations",
    what: "The market’s expectation for average inflation over the next 10 years.",
    why: "Gold can benefit when investors worry about future inflation and currency debasement.",
    bullish: "Rising inflation expectations can support gold.",
    bearish: "Falling inflation expectations can reduce gold’s inflation-hedge appeal.",
  },
  {
    title: "Core PCE Inflation",
    what: "The Federal Reserve’s preferred inflation measure, excluding food and energy.",
    why: "It influences Fed policy expectations, rates, and real yields.",
    bullish: "Sticky inflation can support gold if real yields fall or policy credibility weakens.",
    bearish: "Sticky inflation can pressure gold if it pushes rates and real yields higher.",
  },
  {
    title: "Producer Prices",
    what: "A measure of inflation pressures faced by producers before costs reach consumers.",
    why: "Rising producer prices can signal future inflation pressure.",
    bullish: "Rising producer inflation can support gold if inflation fears increase.",
    bearish: "Falling producer inflation can reduce inflation-hedge demand.",
  },
  {
    title: "Financial Stress",
    what: "A gauge of stress across credit markets, funding markets, and the financial system.",
    why: "Gold can attract safe-haven demand when financial stress rises.",
    bullish: "Higher financial stress usually supports gold.",
    bearish: "Lower financial stress can reduce safe-haven demand.",
  },
  {
    title: "Market Volatility",
    what: "A measure of investor fear and uncertainty, commonly tracked through VIX.",
    why: "Gold can benefit when investors seek safety during volatile markets.",
    bullish: "Rising volatility can support gold.",
    bearish: "Falling volatility can reduce safe-haven demand.",
  },
  {
    title: "High-Yield Spread",
    what: "The extra yield investors demand to hold risky corporate debt.",
    why: "Wider spreads can signal rising credit risk and stress in markets.",
    bullish: "Wider spreads can support gold through risk-off demand.",
    bearish: "Tighter spreads can pressure gold if risk appetite improves.",
  },
  {
    title: "ADP Employment",
    what: "A private-sector employment estimate released before official payroll data.",
    why: "Labour strength affects Fed expectations, yields, and gold pressure.",
    bullish: "Weakening employment can support gold if it lowers rate expectations.",
    bearish: "Strong employment can pressure gold if it raises rate expectations.",
  },
  {
    title: "Nonfarm Payrolls",
    what: "The main U.S. jobs report showing monthly employment growth.",
    why: "It is one of the most important macro releases for Fed policy and yields.",
    bullish: "Weak payrolls can support gold if markets expect easier policy.",
    bearish: "Strong payrolls can pressure gold if rates and real yields rise.",
  },
];

function IndicatorsPage({ currentTime }) {
  return (
    <>
      <PageHeader
        title="Gold Score Indicators"
        subtitle="The 10 macro drivers behind the Gold Score"
        currentTime={currentTime}
      />

      <section className="indicators-intro">
        <span className="section-label">Education</span>

        <h2>How to read the Gold Score</h2>

        <p>
          Each indicator explains one part of the gold story. The model does not
          predict the future by itself. It measures whether current macro forces
          are more supportive or more restrictive for gold.
        </p>
      </section>

      <section className="indicators-grid">
        {indicators.map((indicator, index) => (
          <div className="indicator-card" key={indicator.title}>
            <div className="indicator-number">
              {String(index + 1).padStart(2, "0")}
            </div>

            <h3>{indicator.title}</h3>

            <div className="indicator-block">
              <span>What it is</span>
              <p>{indicator.what}</p>
            </div>

            <div className="indicator-block">
              <span>Why gold cares</span>
              <p>{indicator.why}</p>
            </div>

            <div className="indicator-signals">
              <div>
                <span>Bullish</span>
                <p>{indicator.bullish}</p>
              </div>

              <div>
                <span>Bearish</span>
                <p>{indicator.bearish}</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

export default IndicatorsPage;