function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="sidebar">
      <h2>Gold Terminal</h2>

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
    </aside>
  );
}

export default Sidebar;