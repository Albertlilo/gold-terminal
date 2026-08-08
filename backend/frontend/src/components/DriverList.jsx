function DriverList({ title, drivers }) {
  return (
    <div className="driver-panel">
      <h3>{title}</h3>

      {drivers?.map((driver) => (
        <div className="driver-row" key={driver.indicator}>
          <span>{driver.indicator}</span>
          <strong>{driver.points > 0 ? `+${driver.points}` : driver.points}</strong>
        </div>
      ))}
    </div>
  );
}

export default DriverList;