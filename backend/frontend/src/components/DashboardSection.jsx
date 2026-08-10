function DashboardSection({ label, title, children }) {
  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <span className="section-label">{label}</span>
        <h2>{title}</h2>
      </div>

      {children}
    </section>
  );
}

export default DashboardSection;