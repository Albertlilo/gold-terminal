function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>Gold Terminal</h2>
        <span>Free Educational Dashboard</span>
      </div>

      <nav>
        <p
          className={activePage === "home" ? "active-nav" : ""}
          onClick={() => setActivePage("home")}
        >
          Home
        </p>

        <p
          className={activePage === "goldScore" ? "active-nav" : ""}
          onClick={() => setActivePage("goldScore")}
        >
          Gold Score
        </p>

        <p
          className={activePage === "technicals" ? "active-nav" : ""}
          onClick={() => setActivePage("technicals")}
        >
          Technicals
        </p>

        <p
          className={activePage === "indicators" ? "active-nav" : ""}
          onClick={() => setActivePage("indicators")}
        >
          Indicators
        </p>

        <p
          className={activePage === "macro" ? "active-nav" : ""}
          onClick={() => setActivePage("macro")}
        >
          Macro
        </p>

        <p
          className={activePage === "markets" ? "active-nav" : ""}
          onClick={() => setActivePage("markets")}
        >
          Markets
        </p>
      </nav>
      <div className="sidebar-footer">
        <span>Built by Albert</span>
        <small>Macro signals for gold education</small>
      </div>
    </aside>
  );
}

export default Sidebar;