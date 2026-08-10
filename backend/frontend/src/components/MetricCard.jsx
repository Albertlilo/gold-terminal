function MetricCard({
  label,
  value,
  description,
  className = "",
  valueClassName = "",
}) {
  return (
    <div className={`card ${className}`}>
      <span>{label}</span>
      <h2 className={valueClassName}>{value}</h2>
      <p>{description}</p>
    </div>
  );
}

export default MetricCard;