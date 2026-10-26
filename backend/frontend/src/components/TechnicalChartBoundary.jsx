import { Component } from "react";

export default class TechnicalChartBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Gold candle chart render failed:", error);
  }

  render() {
    if (this.state.failed) {
      return <div className="chart-error-state" role="alert">
        <strong>Chart could not be displayed.</strong>
        <span>Your other timeframe readings are still available.</span>
        <button type="button" onClick={this.props.onRetry}>Retry chart</button>
      </div>;
    }
    return this.props.children;
  }
}
