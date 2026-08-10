import GoldPriceChart from "./components/GoldPriceChart";
import { useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import MetricCard from "./components/MetricCard";
import DriverList from "./components/DriverList";
import GoldScorePanel from "./components/GoldScorePanel";

function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [activePage, setActivePage] = useState("home");
  const [currentTime, setCurrentTime] = useState(new Date());
  const previousGoldPrice = useRef(null);
  const [goldMovement, setGoldMovement] = useState("Waiting...");
  const [goldChange, setGoldChange] = useState(0);
  const [goldChangePercent, setGoldChangePercent] = useState(0);
  const [goldHistory, setGoldHistory] = useState([]);

  useEffect(() => {
    const fetchDashboard = () => {
      fetch("https://gold-terminal-ufv4.onrender.com/api/fred/dashboard")
        .then((response) => response.json())
        .then((data) => {
          const newGoldPrice = data?.market?.xauusd?.price;
          if (newGoldPrice !== undefined) {
            setGoldHistory((history) => [
              ...history.slice(-19),
              {
                price: newGoldPrice,
                time: new Date().toLocaleTimeString(),
              },
            ]);
          }

          if (
            previousGoldPrice.current !== null &&
            newGoldPrice !== undefined
          ) {
            const change = newGoldPrice - previousGoldPrice.current;
            const changePercent =
              (change / previousGoldPrice.current) * 100;

            setGoldChange(change);
            setGoldChangePercent(changePercent);
            if (newGoldPrice > previousGoldPrice.current) {
              setGoldMovement("↑ Rising");
            } else if (newGoldPrice < previousGoldPrice.current) {
              setGoldMovement("↓ Falling");
            } else {
              setGoldMovement("→ Flat");
            }
          }

          previousGoldPrice.current = newGoldPrice;
          setDashboardData(data);
        })
        .catch((error) => console.error(error));
    };

    fetchDashboard();

    const dashboardInterval = setInterval(fetchDashboard, 30000);

    return () => clearInterval(dashboardInterval);
  }, []);

  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  const goldPrice = dashboardData?.market?.xauusd?.price
    ? dashboardData.market.xauusd.price.toFixed(2)
    : "Loading...";

  const goldScore = dashboardData?.gold?.score?.totalScore ?? "--";

  const goldSummary =
    dashboardData?.gold?.summary ?? "Loading macro signals...";

  const realYield =
    dashboardData?.realYields?.tenYearRealYield?.value ?? "--";

  const dollarIndex =
    dashboardData?.currency?.dollarIndex?.value ?? "--";

  const inflation =
    dashboardData?.inflation?.tenYearBreakeven?.value ?? "--";

  const vix =
    dashboardData?.risk?.vix?.value ?? "--";

  const unemployment =
    dashboardData?.labour?.unemploymentRate?.value ?? "--";

  const fedFunds =
    dashboardData?.rates?.fedFunds?.value ?? "--";

  const m2 =
    dashboardData?.liquidity?.m2MoneySupply?.value ?? "--";

  const tenYearYield =
    dashboardData?.rates?.tenYear?.value ?? "--";

  return (
    <div className="app">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="dashboard">
        {activePage === "home" && (
          <>
            <div className="dashboard-header">
              <div>
                <h1>Home</h1>
                <p>Macro command centre</p>
              </div>

              <div className="status-area">
                <span className="status-badge">Live</span>
                <span className="last-updated">
                  {currentTime.toLocaleTimeString()}
                </span>
              </div>
            </div>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Market</span>
                <h2>Market Overview</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="Gold Price"
                  value={goldPrice}
                  description="XAUUSD"
                />

                <MetricCard
                  label="Gold Score"
                  value={goldScore}
                  description={goldSummary}
                  className="gold-card"
                />

                <MetricCard
                  label="Dollar"
                  value={dollarIndex}
                  description="Broad USD Index"
                />

                <MetricCard
                  label="10Y Treasury"
                  value={tenYearYield}
                  description="Nominal Treasury yield"
                />
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Macro</span>
                <h2>Macro Conditions</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="10Y Real Yield"
                  value={realYield}
                  description="Real yield pressure"
                />

                <MetricCard
                  label="10Y Inflation"
                  value={inflation}
                  description="Breakeven inflation"
                />

                <MetricCard
                  label="Fed Funds"
                  value={fedFunds}
                  description="Policy rate"
                />

                <MetricCard
                  label="Unemployment"
                  value={unemployment}
                  description="US labour market"
                />
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Risk & Liquidity</span>
                <h2>Market Conditions</h2>
              </div>

              <div className="card-grid">
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
              </div>
            </section>

            <section className="drivers-section">
              <DriverList
                title="Top Bullish Drivers"
                drivers={dashboardData?.gold?.topBullishDrivers}
              />

              <DriverList
                title="Top Bearish Drivers"
                drivers={dashboardData?.gold?.topBearishDrivers}
              />
            </section>
          </>
        )}

        {activePage === "goldScore" && (
          <>
            <div className="dashboard-header">
              <div>
                <h1>Gold Score</h1>
                <p>Macro scoring engine</p>
              </div>

              <div className="status-area">
                <span className="status-badge">Live</span>
                <span className="last-updated">
                  {currentTime.toLocaleTimeString()}
                </span>
              </div>
            </div>

            <GoldScorePanel gold={dashboardData?.gold} />

            <section className="drivers-section">
              <DriverList
                title="Top Bullish Drivers"
                drivers={dashboardData?.gold?.topBullishDrivers}
              />

              <DriverList
                title="Top Bearish Drivers"
                drivers={dashboardData?.gold?.topBearishDrivers}
              />
            </section>
          </>
        )}

        {activePage === "macro" && (
          <>
            <div className="dashboard-header">
              <div>
                <h1>Macro</h1>
                <p>US macroeconomic conditions</p>
              </div>

              <div className="status-area">
                <span className="status-badge">Live</span>
                <span className="last-updated">
                  {currentTime.toLocaleTimeString()}
                </span>
              </div>
            </div>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Rates</span>
                <h2>Interest Rates</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="Fed Funds"
                  value={dashboardData?.rates?.fedFunds?.value ?? "--"}
                  description="Federal funds rate"
                />

                <MetricCard
                  label="2Y Treasury"
                  value={dashboardData?.rates?.twoYear?.value ?? "--"}
                  description="2-year Treasury yield"
                />

                <MetricCard
                  label="10Y Treasury"
                  value={dashboardData?.rates?.tenYear?.value ?? "--"}
                  description="10-year Treasury yield"
                />

                <MetricCard
                  label="10Y Real Yield"
                  value={dashboardData?.realYields?.tenYearRealYield?.value ?? "--"}
                  description="Inflation-adjusted yield"
                />
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Inflation</span>
                <h2>Inflation Conditions</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="5Y Breakeven"
                  value={dashboardData?.inflation?.fiveYearBreakeven?.value ?? "--"}
                  description="5-year inflation expectations"
                />

                <MetricCard
                  label="10Y Breakeven"
                  value={dashboardData?.inflation?.tenYearBreakeven?.value ?? "--"}
                  description="10-year inflation expectations"
                />

                <MetricCard
                  label="Core PCE"
                  value={dashboardData?.inflation?.corePce?.value ?? "--"}
                  description="Core inflation"
                />

                <MetricCard
                  label="PPI"
                  value={dashboardData?.inflation?.ppi?.value ?? "--"}
                  description="Producer prices"
                />
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Labour</span>
                <h2>Labour Market</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="Unemployment"
                  value={dashboardData?.labour?.unemploymentRate?.value ?? "--"}
                  description="Unemployment rate"
                />

                <MetricCard
                  label="Nonfarm Payrolls"
                  value={dashboardData?.labour?.nonfarmPayrolls?.value ?? "--"}
                  description="US payroll employment"
                />

                <MetricCard
                  label="ADP Employment"
                  value={dashboardData?.labour?.adpEmployment?.value ?? "--"}
                  description="Private employment"
                />

                <MetricCard
                  label="Initial Claims"
                  value={dashboardData?.consumerHousing?.initialClaims?.value ?? "--"}
                  description="Weekly jobless claims"
                />
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Growth</span>
                <h2>Economic Growth</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="Real GDP"
                  value={dashboardData?.growth?.realGdp?.value ?? "--"}
                  description="Real economic output"
                />

                <MetricCard
                  label="Industrial Production"
                  value={dashboardData?.growth?.industrialProduction?.value ?? "--"}
                  description="Industrial activity"
                />

                <MetricCard
                  label="Retail Sales"
                  value={dashboardData?.growth?.retailSales?.value ?? "--"}
                  description="Consumer spending"
                />

                <MetricCard
                  label="Consumer Sentiment"
                  value={dashboardData?.consumerHousing?.consumerSentiment?.value ?? "--"}
                  description="Consumer confidence"
                />
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Liquidity</span>
                <h2>System Liquidity</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="M2 Money Supply"
                  value={dashboardData?.liquidity?.m2MoneySupply?.value ?? "--"}
                  description="Broad money supply"
                />

                <MetricCard
                  label="Reverse Repo"
                  value={dashboardData?.liquidity?.reverseRepo?.value ?? "--"}
                  description="Fed reverse repo facility"
                />

                <MetricCard
                  label="Treasury General Account"
                  value={dashboardData?.liquidity?.treasuryGeneralAccount?.value ?? "--"}
                  description="US Treasury cash balance"
                />

                <MetricCard
                  label="Housing Starts"
                  value={dashboardData?.consumerHousing?.housingStarts?.value ?? "--"}
                  description="Residential construction"
                />
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Risk</span>
                <h2>Financial Conditions</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="VIX"
                  value={dashboardData?.risk?.vix?.value ?? "--"}
                  description="Market volatility"
                />

                <MetricCard
                  label="Financial Stress"
                  value={dashboardData?.risk?.financialStress?.value ?? "--"}
                  description="Financial stress index"
                />

                <MetricCard
                  label="High-Yield Spread"
                  value={dashboardData?.risk?.highYieldSpread?.value ?? "--"}
                  description="Credit risk spread"
                />

                <MetricCard
                  label="Dollar"
                  value={dashboardData?.currency?.dollarIndex?.value ?? "--"}
                  description="Broad US dollar index"
                />
              </div>
            </section>
          </>
        )}
        {activePage === "markets" && (
          <>
            <div className="dashboard-header">
              <div>
                <h1>Markets</h1>
                <p>Price action and market confirmation</p>
              </div>

              <div className="status-area">
                <span className="status-badge">Live</span>
                <span className="last-updated">
                  {currentTime.toLocaleTimeString()}
                </span>
              </div>
            </div>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Primary Market</span>
                <h2>Gold</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="XAUUSD"
                  value={goldPrice}
                  description="Live gold spot price"
                  className="gold-card"
                />
                <MetricCard
                  label="Gold Movement"
                  value={goldMovement}
                  description="Change since previous update"
                  valueClassName={
                    goldMovement.includes("Rising")
                      ? "movement-up"
                      : goldMovement.includes("Falling")
                        ? "movement-down"
                        : "movement-flat"
                  }
                />
                <MetricCard
                  label="Price Change"
                  value={`${goldChange >= 0 ? "+" : ""}${goldChange.toFixed(2)}`}
                  description={`${goldChangePercent >= 0 ? "+" : ""}${goldChangePercent.toFixed(2)}% since previous update`}
                  valueClassName={
                    goldChange > 0
                      ? "movement-up"
                      : goldChange < 0
                        ? "movement-down"
                        : "movement-flat"
                  }
                />

                <MetricCard
                  label="Gold Bias"
                  value={dashboardData?.gold?.score?.bias ?? "--"}
                  description={goldSummary}
                />
              </div>
            </section>
<GoldPriceChart history={goldHistory} />
            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Rates Market</span>
                <h2>Treasury Confirmation</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="2Y Treasury"
                  value={dashboardData?.rates?.twoYear?.value ?? "--"}
                  description="Front-end yield"
                />

                <MetricCard
                  label="10Y Treasury"
                  value={dashboardData?.rates?.tenYear?.value ?? "--"}
                  description="Long-term yield"
                />

                <MetricCard
                  label="10Y Real Yield"
                  value={realYield}
                  description="Key gold pressure"
                />
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Risk Market</span>
                <h2>Risk Confirmation</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="VIX"
                  value={vix}
                  description="Equity volatility"
                />

                <MetricCard
                  label="High-Yield Spread"
                  value={dashboardData?.risk?.highYieldSpread?.value ?? "--"}
                  description="Credit stress"
                />

                <MetricCard
                  label="Financial Stress"
                  value={dashboardData?.risk?.financialStress?.value ?? "--"}
                  description="System stress"
                />
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <span className="section-label">Currency</span>
                <h2>Dollar Confirmation</h2>
              </div>

              <div className="card-grid">
                <MetricCard
                  label="Broad USD Index"
                  value={dollarIndex}
                  description="FRED trade-weighted dollar"
                />

                <MetricCard
                  label="DXY"
                  value="--"
                  description="Not connected yet"
                />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;