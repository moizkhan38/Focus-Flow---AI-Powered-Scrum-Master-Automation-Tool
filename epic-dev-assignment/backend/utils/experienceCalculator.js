// Ported from github-commit-analyzer/src/GitHubCommitAnalyzer.jsx (lines 257-289)

export function calculateExperienceLevel(totalCommits, onTimePercentage, messageQuality, consistency) {
  // Default undefined/NaN params to 0 so scoring doesn't break
  const commits = Number(totalCommits) || 0;
  const onTime = Number(onTimePercentage) || 0;
  const msgQuality = Number(messageQuality) || 0;
  const consist = Number(consistency) || 0;

  let score = 0;

  // Commit volume (40 points max) — smooth interpolation within buckets
  if (commits > 200) score += 40;
  else if (commits > 150) score += 35 + Math.round(((commits - 150) / 50) * 5);
  else if (commits > 100) score += 30 + Math.round(((commits - 100) / 50) * 5);
  else if (commits > 50) score += 25 + Math.round(((commits - 50) / 50) * 5);
  else score += Math.max(5, Math.round((commits / 50) * 15) + 10);

  // Work pattern (15 points max)
  if (onTime >= 60) score += 15;
  else if (onTime >= 50) score += 10 + Math.round(((onTime - 50) / 10) * 5);
  else if (onTime >= 30) score += 5 + Math.round(((onTime - 30) / 20) * 5);
  else score += Math.max(2, Math.round((onTime / 30) * 3) + 2);

  // Message quality (25 points max)
  if (msgQuality >= 40) score += 25;
  else if (msgQuality >= 30) score += 20 + Math.round(((msgQuality - 30) / 10) * 5);
  else if (msgQuality >= 20) score += 15 + Math.round(((msgQuality - 20) / 10) * 5);
  else score += Math.max(5, Math.round((msgQuality / 20) * 10) + 5);

  // Consistency (20 points max)
  if (consist >= 70 && commits > 100) score += 20;
  else if (consist >= 60 && commits > 50) score += 15 + Math.round(((consist - 60) / 10) * 5);
  else if (consist >= 40 && commits > 30) score += 10 + Math.round(((consist - 40) / 20) * 5);
  else score += Math.max(3, Math.round((consist / 40) * 7) + 3);

  // Clamp score to 0-100 range
  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return { level: "Senior", tone: "purple", score };
  if (score >= 60) return { level: "Mid-Level", tone: "blue", score };
  if (score >= 40) return { level: "Junior", tone: "green", score };
  return { level: "Beginner", tone: "yellow", score };
}
