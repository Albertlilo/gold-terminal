function MetricCard({ label, value, description, className = "" }) {
  return (
    <div className={`card ${className}`}>
      <span>{label}</span>
      <h2>{value}</h2>
      <p>{description}</p>
    </div>
  );
}

export default MetricCard;