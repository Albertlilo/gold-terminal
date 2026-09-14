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

const scoringRules = {
  realYield: {
    bullishWhen: "down",
    weight: 3,
    label: "10Y real yield"
  },
  twoYearYield: {
    bullishWhen: "down",
    weight: 2,
    label: "2Y Treasury yield"
  },
  dollar: {
    bullishWhen: "down",
    weight: 3,
    label: "US dollar"
  },
  inflationExpectations: {
    bullishWhen: "up",
    weight: 2,
    label: "10Y inflation expectations"
  },
  corePce: {
    bullishWhen: "up",
    weight: 2,
    label: "Core PCE inflation"
  },
  ppi: {
    bullishWhen: "up",
    weight: 1,
    label: "Producer prices"
  },
  financialStress: {
    bullishWhen: "up",
    weight: 2,
    label: "Financial stress"
  },
  vix: {
    bullishWhen: "up",
    weight: 1,
    label: "Market volatility"
  },
  highYieldSpread: {
    bullishWhen: "up",
    weight: 1,
    label: "High-yield credit spread"
  },
  adpEmployment: {
    bullishWhen: "down",
    weight: 1,
    label: "ADP hiring momentum"
  },
  nonfarmPayrolls: {
    bullishWhen: "down",
    weight: 2,
    label: "NFP hiring momentum"
  }
};

const calculateGoldScore = ({
  realYield,
  dollar,
  inflationExpectations,
  financialStress,
  vix,
  highYieldSpread,
  adpEmployment,
  nonfarmPayrolls,
  corePce,
  ppi
}) => {
  const indicatorChanges = {
    realYield: realYield?.change ?? 0,
    dollar: dollar?.change ?? 0,
    inflationExpectations: inflationExpectations?.change ?? 0,
    corePce: corePce?.change ?? 0,
    ppi: ppi?.change ?? 0,
    financialStress: financialStress?.change ?? 0,
    vix: vix?.change ?? 0,
    highYieldSpread: highYieldSpread?.change ?? 0,
    adpEmployment: adpEmployment?.change ?? 0,
    nonfarmPayrolls: nonfarmPayrolls?.change ?? 0
  };

  const scores = Object.fromEntries(
    Object.entries(scoringRules).map(([indicator, rule]) => [
      indicator,
      scoreChange(
        indicatorChanges[indicator],
        rule.bullishWhen,
        rule.weight
      )
    ])
  );

  const driverLabels = {
    realYield: "10Y real yield",
    dollar: "US dollar",
    inflationExpectations: "10Y inflation expectations",
    corePce: "Core PCE inflation",
    ppi: "Producer prices",
    financialStress: "Financial stress",
    vix: "Market volatility",
    highYieldSpread: "High-yield credit spread",
    adpEmployment: "ADP hiring momentum",
    nonfarmPayrolls: "NFP hiring momentum"
  };

  const drivers = Object.entries(scores)
    .filter(([, score]) => score !== 0)
    .map(([indicator, score]) => ({
      indicator: scoringRules[indicator].label,
      impact: score > 0 ? "Bullish" : "Bearish",
      points: score
    }))
    .sort(
      (first, second) =>
        Math.abs(second.points) - Math.abs(first.points));

  const totalScore = Object.values(scores).reduce(
    (total, score) => total + score,
    0
  );

  const bullishPoints = Object.values(scores)
    .filter((score) => score > 0)
    .reduce((total, score) => total + score, 0);

  const bearishPoints = Math.abs(
    Object.values(scores)
      .filter((score) => score < 0)
      .reduce((total, score) => total + score, 0)
  );

  const maxScore = Object.values(scoringRules).reduce(
    (total, rule) => total + rule.weight,
    0
  );
  const activePoints = bullishPoints + bearishPoints;

  const directionalConfidence = Math.round(
    (Math.abs(totalScore) / maxScore) * 100
  );

  const activityLevel = Math.min(
    100,
    Math.round((activePoints / maxScore) * 100)
  );

  const isHighConflict =
    Math.abs(totalScore) <= 2 && activePoints >= 12;

  const bias =
    isHighConflict ? "High Conflict" :
      totalScore >= 5 ? "Bullish" :
        totalScore <= -5 ? "Bearish" :
          "Neutral";

  const lean =
    isHighConflict ? "Balanced Battle" :
      totalScore >= 3 ? "Bullish Lean" :
        totalScore <= -3 ? "Bearish Lean" :
          "No Clear Lean";

  const confidence = isHighConflict
    ? activityLevel
    : directionalConfidence;

  return {
    totalScore,
    bullishPoints,
    bearishPoints,
    maxScore,
    bias,
    lean,
    confidence,
    directionalConfidence,
    activityLevel,
    activePoints,
    isHighConflict,
    scores,
    drivers
  };
};

module.exports = {
  scoreChange,
  calculateGoldScore
};