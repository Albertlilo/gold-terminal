import PageHeader from "../components/PageHeader";
import GoldScorePanel from "../components/GoldScorePanel";

function GoldScorePage({ dashboardData, currentTime }) {
  return (
    <>
      <PageHeader
        title="Gold Score Dashboard"
        subtitle="Real-time scoring of macro and market indicators driving gold"
        currentTime={currentTime}
      />

      <GoldScorePanel gold={dashboardData?.gold} />

      <section className="about-score-panel">
        <div className="about-score-header">
          <span className="section-label">
            About The Model
          </span>

          <h2>How the Gold Score works</h2>

          <p>
            The Gold Score is not a price prediction. It is a live macro
            conditions model that measures whether the current environment is
            more supportive or more restrictive for gold.
          </p>
        </div>

        <div className="about-score-grid">
          <ScoreExplainer
            title="Total Score"
            value="Bullish minus Bearish"
            description="The final score compares supportive gold forces against restrictive forces. A positive score leans bullish, a negative score leans bearish, and zero means forces are balanced."
          />

          <ScoreExplainer
            title="Bullish Points"
            value="Support for gold"
            description="Bullish points come from indicators that are currently helping gold, such as falling real yields, a weaker dollar, rising stress, or softer labour momentum."
          />

          <ScoreExplainer
            title="Bearish Points"
            value="Pressure on gold"
            description="Bearish points come from indicators that are currently pressuring gold, such as rising real yields, a stronger dollar, lower stress, or strong jobs data."
          />

          <ScoreExplainer
            title="Confidence"
            value="Strength of the signal"
            description="Confidence shows how one-sided the model is. If bullish and bearish forces are balanced, confidence will be low even if many indicators are active."
          />

          <ScoreExplainer
            title="Lean"
            value="Current direction"
            description="Lean translates the score into plain English. It helps show whether gold has a bullish lean, bearish lean, or no clear lean."
          />

          <ScoreExplainer
            title="Neutral Score"
            value="Not a bearish signal"
            description="A neutral score does not mean gold cannot rise. It means the macro indicators currently connected to the model do not show a clear directional edge."
          />
        </div>
      </section>
    </>
  );
}

function ScoreExplainer({
  title,
  value,
  description,
}) {
  return (
    <div className="score-explainer-card">
      <span>{title}</span>
      <h3>{value}</h3>
      <p>{description}</p>
    </div>
  );
}

export default GoldScorePage;