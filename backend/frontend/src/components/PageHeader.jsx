function PageHeader({ title, subtitle, currentTime }) {
  return (
    <div className="dashboard-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="status-area">
        <span className="status-badge">Live</span>
        <span className="last-updated">
          {currentTime.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

export default PageHeader;