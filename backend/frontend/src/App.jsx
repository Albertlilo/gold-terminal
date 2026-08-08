import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import MetricCard from "./components/MetricCard";
import DriverList from "./components/DriverList";
import GoldScorePanel from "./components/GoldScorePanel";

function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [activePage, setActivePage] = useState("home");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchDashboard = () => {
      fetch("http://localhost:3000/api/fred/dashboard")
        .then((response) => response.json())
        .then((data) => setDashboardData(data))
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
                label="10Y Real Yield"
                value={realYield}
                description="Real yield pressure"
              />

              <MetricCard
                label="Dollar"
                value={dollarIndex}
                description="Broad USD Index"
              />

              <MetricCard
                label="10Y Inflation"
                value={inflation}
                description="Breakeven inflation"
              />

              <MetricCard
                label="VIX"
                value={vix}
                description="Market volatility"
              />

              <MetricCard
                label="Unemployment"
                value={unemployment}
                description="US labour market"
              />

              <MetricCard
                label="Fed Funds"
                value={fedFunds}
                description="Policy rate"
              />

              <MetricCard
                label="M2 Money Supply"
                value={m2}
                description="System liquidity"
              />

              <MetricCard
                label="10Y Treasury"
                value={tenYearYield}
                description="Nominal Treasury yield"
              />
            </div>

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
      </main>
    </div>
  );
}

export default App;