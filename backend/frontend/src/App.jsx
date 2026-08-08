function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Gold Terminal</h2>

        <nav>
          <p>Home</p>
          <p>Gold Score</p>
          <p>Macro</p>
          <p>Markets</p>
        </nav>
      </aside>

      <main className="dashboard">
        <h1>Home</h1>
        <p>Macro command centre</p>

        <div className="card-grid">
          <div className="card">
            <span>Gold Price</span>
            <h2>XAUUSD</h2>
            <p>Loading...</p>
          </div>

          <div className="card gold-card">
            <span>Gold Score</span>
            <h2>0</h2>
            <p className="gold-summary">Balanced Macro Forces</p>
          </div>

          <div className="card">
            <span>10Y Real Yield</span>
            <h2>--</h2>
            <p>Macro driver</p>
          </div>

          <div className="card">
            <span>Dollar</span>
            <h2>--</h2>
            <p>Broad USD Index</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;