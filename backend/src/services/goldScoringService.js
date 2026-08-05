const scoreChange = (
  change,
  bullishWhen = "up",
  weight = 1
) => {
  if (change === 0) {
    return 0;
  }

  const isUp = change > 0;

  if (bullishWhen === "up") {
    return isUp ? weight : -weight;
  }

  return isUp ? -weight : weight;
};

const calculateGoldScore = ({
  realYieldChange,
  dollarChange,
  inflationExpectationChange,
  financialStressChange,
  vixChange,
  highYieldSpreadChange,
  adpMomentumChange,
  nfpMomentumChange,
  corePceChange,
  ppiChange
}) => {
  const scores = {
    realYield: scoreChange(realYieldChange, "down", 3),
    dollar: scoreChange(dollarChange, "down", 3),
    inflationExpectations: scoreChange(
      inflationExpectationChange,
      "up",
      2
    ),
    corePce: scoreChange(corePceChange, "up", 2),
    ppi: scoreChange(ppiChange, "up", 1),

    financialStress: scoreChange(
      financialStressChange,
      "up",
      2
    ),
    vix: scoreChange(vixChange, "up", 1),
    highYieldSpread: scoreChange(
      highYieldSpreadChange,
      "up",
      1
    ),
    adpEmployment: scoreChange(adpMomentumChange, "down", 1),
    nonfarmPayrolls: scoreChange(nfpMomentumChange, "down", 2)
  };

  const totalScore = Object.values(scores).reduce(
    (total, score) => total + score,
    0
  );

  const bias =
    totalScore >= 5 ? "Bullish" :
    totalScore <= -5 ? "Bearish" :
    "Neutral";

  const lean =
  totalScore >= 3 ? "Bullish Lean" :
  totalScore <= -3 ? "Bearish Lean" :
  "No Clear Lean";

  const bullishPoints = Object.values(scores)
  .filter((score) => score > 0)
  .reduce((total, score) => total + score, 0);
  
  const bearishPoints = Math.abs(
  Object.values(scores)
    .filter((score) => score < 0)
    .reduce((total, score) => total + score, 0)
);


  const maxScore = 15;
  
  const confidence = Math.round(
  (Math.abs(totalScore) / maxScore) * 100
);

return {
  totalScore,
  bias,
  lean,
  confidence,
  scores,
};
};

module.exports = {
  scoreChange,
  calculateGoldScore
};