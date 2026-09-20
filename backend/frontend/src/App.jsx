import { getGoldSession } from "./lib/goldSession";
import DashboardDataStatus from "./components/DashboardDataStatus";
import TechnicalsPage from "./pages/TechnicalsPage";
import IndicatorsPage from "./pages/IndicatorsPage";
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
  const [lastSuccessAt, setLastSuccessAt] = useState(null);
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardBusy, setDashboardBusy] = useState(false);
  const retryDashboard = useRef(() => {});
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
    let disposed = false;
    let inFlight = false;
    let controller;
    const fetchDashboard = async () => {
      if (inFlight || disposed) return;
      inFlight = true;
      setDashboardBusy(true);
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 65000);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/fred/dashboard`, { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            `Dashboard request failed: ${response.status}`
          );
        }

        const data = await response.json();
        if (disposed) return;
        if (!data?.gold?.score || !data?.market) throw new Error("Incomplete dashboard response");
        setDashboardError("");
        const closed = !getGoldSession().isOpen || data?.market?.xauusd?.marketClosed;
        if (closed && previousGoldPrice.current !== null) data.market.xauusd.price = previousGoldPrice.current;
        const newGoldPrice = data?.market?.xauusd?.price;
        if (closed) { setGoldMovement("Market closed"); setGoldChange(0); setGoldChangePercent(0); }

        if (!closed && Number.isFinite(newGoldPrice) && newGoldPrice > 0 && !data.market.xauusd.stale) {
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

        if (closed && previousGoldPrice.current === null && Number.isFinite(newGoldPrice)) previousGoldPrice.current = newGoldPrice;
        setDashboardData(data);
        setLastSuccessAt(Date.now());
      } catch (error) {
        if (!disposed) setDashboardError(error.name === "AbortError"
          ? "The dashboard request timed out. The server may be waking up."
          : "Dashboard data is unavailable. The server or its data provider could not complete the request.");
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        if (!disposed) setDashboardBusy(false);
      }
    };

    retryDashboard.current = fetchDashboard;
    const initialRequest = setTimeout(fetchDashboard, 0);

    const dashboardInterval = setInterval(
      fetchDashboard,
      DASHBOARD_REFRESH_MS
    );

    return () => {
      disposed = true;
      clearTimeout(initialRequest);
      clearInterval(dashboardInterval);
      controller?.abort();
    };
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
      : dashboardError || dashboardData ? "Unavailable" : "Loading...";

  const sessionClosed = !getGoldSession(currentTime.getTime()).isOpen;
  const displayedMovement = sessionClosed ? "Market closed" : goldMovement;
  const displayedChange = sessionClosed ? 0 : goldChange;
  const displayedChangePercent = sessionClosed ? 0 : goldChangePercent;

  const goldScore =
    dashboardData?.gold?.score?.totalScore ?? "--";

  const goldSummary =
    dashboardData?.gold?.summary ?? (dashboardError ? "Macro data unavailable" : "Loading macro signals...");

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
        <DashboardDataStatus
          lastSuccessAt={lastSuccessAt}
          busy={dashboardBusy}
          error={dashboardError}
          now={currentTime.getTime()}
          onRetry={() => retryDashboard.current()}
        />
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
            goldMovement={displayedMovement}
            goldChange={displayedChange}
            goldChangePercent={displayedChangePercent}
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
            goldMovement={displayedMovement}
            goldChange={displayedChange}
            goldChangePercent={displayedChangePercent}
            goldHistory={goldHistory}
            realYield={realYield}
            dollarIndex={dollarIndex}
            sessionHigh={sessionHigh}
            sessionLow={sessionLow}
            sessionRange={sessionRange}
          />
        )}

        {activePage === "technicals" && (
          <TechnicalsPage
            lastSuccessAt={lastSuccessAt}
            dashboardError={dashboardError}
            dashboardData={dashboardData}
            currentTime={currentTime}
            goldHistory={goldHistory}
            goldPrice={goldPrice}
            goldMovement={displayedMovement}
            goldChange={displayedChange}
            goldChangePercent={displayedChangePercent}
          />
        )}

        {activePage === "indicators" && (
          <IndicatorsPage currentTime={currentTime} />
        )}
      </main>
    </div>
  );
}

export default App;
