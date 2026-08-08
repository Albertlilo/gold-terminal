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

        <p>Macro</p>
        <p>Markets</p>
      </nav>
    </aside>
  );
}

export default Sidebar;