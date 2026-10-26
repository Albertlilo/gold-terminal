function Sidebar({ activePage, setActivePage }) {
  const pages = [
    ["home", "Home"], ["goldScore", "Gold Score"], ["technicals", "Technicals"],
    ["indicators", "Indicators"], ["macro", "Macro"], ["markets", "Markets"],
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>Trendline Insight</h2>
        <span>Free Educational Dashboard</span>
      </div>

      <nav aria-label="Main navigation">
        {pages.map(([page, label]) => (
          <button
            key={page}
            type="button"
            className={activePage === page ? "active-nav" : ""}
            aria-current={activePage === page ? "page" : undefined}
            onClick={() => setActivePage(page)}
          >
            <span>{label}</span>
            {activePage === page && <span className="nav-indicator" aria-hidden="true" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span>Built by Albert</span>
        <small>Macro signals for gold education</small>
      </div>
    </aside>
  );
}

export default Sidebar;
