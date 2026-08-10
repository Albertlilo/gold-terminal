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
    </>
  );
}

export default GoldScorePage;