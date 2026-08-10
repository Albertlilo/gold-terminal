import { useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import HomePage from "./pages/HomePage";
import GoldScorePage from "./pages/GoldScorePage";
import MacroPage from "./pages/MacroPage";
import MarketsPage from "./pages/MarketsPage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://gold-terminal-ufv4.onrender.com";

const DASHBOARD_REFRESH_MS = 30000;

function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [activePage, setActivePage] = useState("home");
  const [currentTime, setCurrentTime] = useState(new Date());

  const previousGoldPrice = useRef(null);

  const [goldMovement, setGoldMovement] = useState("Waiting...");
  const [goldChange, setGoldChange] = useState(0);
  const [goldChangePercent, setGoldChangePercent] = useState(0);
  const [goldHistory, setGoldHistory] = useState([]);

  const [sessionHigh, setSessionHigh] = useState(null);
  const [sessionLow, setSessionLow] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/fred/dashboard`
        );

        if (!response.ok) {
          throw new Error(
            `Dashboard request failed: ${response.status}`
          );
        }

        const data = await response.json();
        const newGoldPrice = data?.market?.xauusd?.price;

        if (typeof newGoldPrice === "number") {
          setGoldHistory((history) => [
            ...history.slice(-19),
            {
              price: newGoldPrice,
              time: new Date().toLocaleTimeString(),
            },
          ]);

          setSessionHigh((currentHigh) =>
            currentHigh === null
              ? newGoldPrice
              : Math.max(currentHigh, newGoldPrice)
          );

          setSessionLow((currentLow) =>
            currentLow === null
              ? newGoldPrice
              : Math.min(currentLow, newGoldPrice)
          );

          if (previousGoldPrice.current !== null) {
            const change =
              newGoldPrice - previousGoldPrice.current;

            const changePercent =
              (change / previousGoldPrice.current) * 100;

            setGoldChange(change);
            setGoldChangePercent(changePercent);

            if (change > 0) {
              setGoldMovement("↑ Rising");
            } else if (change < 0) {
              setGoldMovement("↓ Falling");
            } else {
              setGoldMovement("→ Flat");
            }
          }

          previousGoldPrice.current = newGoldPrice;
        }

        setDashboardData(data);
      } catch (error) {
        console.error("Dashboard fetch failed:", error);
      }
    };

    fetchDashboard();

    const dashboardInterval = setInterval(
      fetchDashboard,
      DASHBOARD_REFRESH_MS
    );

    return () => clearInterval(dashboardInterval);
  }, []);

  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  const goldPrice =
    typeof dashboardData?.market?.xauusd?.price === "number"
      ? dashboardData.market.xauusd.price.toFixed(2)
      : "Loading...";

  const goldScore =
    dashboardData?.gold?.score?.totalScore ?? "--";

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

  const sessionRange =
    sessionHigh !== null && sessionLow !== null
      ? sessionHigh - sessionLow
      : null;

  return (
    <div className="app">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="dashboard">
        {activePage === "home" && (
          <HomePage
            dashboardData={dashboardData}
            currentTime={currentTime}
            goldPrice={goldPrice}
            goldScore={goldScore}
            goldSummary={goldSummary}
            dollarIndex={dollarIndex}
            tenYearYield={tenYearYield}
            realYield={realYield}
            inflation={inflation}
            fedFunds={fedFunds}
            unemployment={unemployment}
            vix={vix}
            m2={m2}
            goldMovement={goldMovement}
            goldChange={goldChange}
            goldChangePercent={goldChangePercent}
            sessionHigh={sessionHigh}
            sessionLow={sessionLow}
            sessionRange={sessionRange}
          />
        )}

        {activePage === "goldScore" && (
          <GoldScorePage
            dashboardData={dashboardData}
            currentTime={currentTime}
          />
        )}

        {activePage === "macro" && (
          <MacroPage
            dashboardData={dashboardData}
            currentTime={currentTime}
          />
        )}

        {activePage === "markets" && (
          <MarketsPage
            dashboardData={dashboardData}
            currentTime={currentTime}
            goldPrice={goldPrice}
            goldMovement={goldMovement}
            goldChange={goldChange}
            goldChangePercent={goldChangePercent}
            goldHistory={goldHistory}
            realYield={realYield}
            dollarIndex={dollarIndex}
            sessionHigh={sessionHigh}
            sessionLow={sessionLow}
            sessionRange={sessionRange}
          />
        )}
      </main>
    </div>
  );
}

export default App;