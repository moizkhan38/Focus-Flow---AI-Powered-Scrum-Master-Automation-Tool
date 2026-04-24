import { classifyEpic } from './epicClassifier.js';

// Maximum story points a single developer should handle
const MAX_CAPACITY_PER_DEV = 100;

/**
 * Normalize a raw expertise score to 0-1 range relative to the developer's max score
 */
function normalizeExpertiseScore(matchScore, allExpertise) {
  if (!allExpertise?.length) return 0;
  const maxScore = Math.max(...allExpertise.map(e => e.score));
  if (maxScore === 0) return 0;
  return matchScore / maxScore;
}

/**
 * Score a single developer for a specific epic
 */
function scoreDeveloper(dev, epicType, devWorkloads, developers) {
  let score = 0;
  const breakdown = {
    expertiseMatch: 0,
    experienceLevel: 0,
    workloadBalance: 0
  };

  const allExpertise = dev.analysis?.expertise?.all || [];

  // Factor 1: Expertise Match (50 points max)
  const expertiseMatch = allExpertise.find(e => e.name === epicType);
  if (expertiseMatch) {
    // Normalize: how strong is this area relative to the dev's best area
    const normalized = normalizeExpertiseScore(expertiseMatch.score, allExpertise);
    const expertisePoints = Math.round(normalized * 50);
    score += expertisePoints;
    breakdown.expertiseMatch = expertisePoints;
  } else if (dev.analysis?.expertise?.primary === "Full Stack") {
    // Full Stack devs get partial credit proportional to their breadth
    // More expertise areas = better generalist = higher partial score
    const areaCount = allExpertise.length;
    const fullStackPoints = Math.min(30, Math.round((areaCount / 5) * 30));
    score += fullStackPoints;
    breakdown.expertiseMatch = fullStackPoints;
  }
  // No match and not Full Stack → 0 expertise points (penalizes mismatches)

  // Factor 2: Experience Level (30 points max)
  const experiencePoints = {
    "Senior": 30,
    "Mid-Level": 20,
    "Junior": 10,
    "Beginner": 5
  };
  const expPoints = experiencePoints[dev.analysis?.experienceLevel?.level] || 5;
  score += expPoints;
  breakdown.experienceLevel = expPoints;

  // Factor 3: Workload Balance (20 points max)
  const totalAssigned = Object.values(devWorkloads).reduce((a, b) => a + b, 0);
  const avgWorkload = totalAssigned / developers.length;
  const currentLoad = devWorkloads[dev.username] || 0;

  // Penalize overloaded developers, reward underloaded ones
  if (currentLoad >= MAX_CAPACITY_PER_DEV) {
    // At or over capacity — no workload bonus
    breakdown.workloadBalance = 0;
  } else {
    const maxLoad = Math.max(...Object.values(devWorkloads), 1);
    // Score inversely proportional to current load
    const loadRatio = 1 - (currentLoad / Math.max(maxLoad, avgWorkload || 1));
    const workloadPoints = Math.round(Math.max(0, Math.min(20, loadRatio * 20)));
    score += workloadPoints;
    breakdown.workloadBalance = workloadPoints;
  }

  return { dev, score, breakdown };
}

/**
 * Calculate confidence based on score, score gap, and expertise match quality
 */
function calculateConfidence(topScore, secondScore, hasExpertiseMatch, epicClassificationConfidence) {
  const scoreGap = topScore - secondScore;
  let confidence = "low";

  if (topScore >= 65 && hasExpertiseMatch && scoreGap >= 10) {
    confidence = "high";
  } else if (topScore >= 50 && hasExpertiseMatch) {
    confidence = scoreGap >= 5 ? "high" : "medium";
  } else if (topScore >= 40 || hasExpertiseMatch) {
    confidence = "medium";
  }

  // Downgrade if epic classification itself was uncertain
  if (epicClassificationConfidence === "low" && confidence === "high") {
    confidence = "medium";
  }

  return confidence;
}

/**
 * Auto-assign individual stories to developers using multi-factor scoring.
 * Each story is classified via its parent epic, then scored and assigned independently.
 * @param {Array} epics - Approved epics with user stories
 * @param {Array} developers - Analyzed developers with expertise and experience
 * @returns {Object} Story-level assignment results with workload distribution
 */
export async function autoAssignStories(epics, developers) {
  const assignments = [];
  const devWorkloads = {};

  // Initialize workloads
  developers.forEach(dev => {
    devWorkloads[dev.username] = 0;
  });

  // Classify all epics first
  for (const epic of epics) {
    if (!epic.classification) {
      epic.classification = await classifyEpic(epic);
    }
  }

  // Assign each story individually
  for (const epic of epics) {
    const epicType = epic.classification.primary;
    const stories = epic.user_stories || [];

    for (const story of stories) {
      const storyPoints = parseInt(story.story_points || 5, 10);

      // Score each developer for this story (using epic classification as context)
      const devScores = developers.map(dev =>
        scoreDeveloper(dev, epicType, devWorkloads, developers)
      );

      // Sort by score descending with tie-breaking
      devScores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.breakdown.experienceLevel !== a.breakdown.experienceLevel)
          return b.breakdown.experienceLevel - a.breakdown.experienceLevel;
        return a.dev.username.localeCompare(b.dev.username);
      });

      const assigned = devScores[0];
      const secondBest = devScores[1];
      const hasExpertiseMatch = assigned.breakdown.expertiseMatch > 0;

      const confidence = calculateConfidence(
        assigned.score,
        secondBest?.score ?? 0,
        hasExpertiseMatch,
        epic.classification.confidence
      );

      assignments.push({
        epic: {
          epic_id: epic.epic_id,
          epic_title: epic.epic_title,
          classification: epic.classification,
        },
        story: {
          story_id: story.story_id,
          story_title: story.story_title,
          story_points: storyPoints,
        },
        developer: {
          username: assigned.dev.username,
          expertise: assigned.dev.analysis.expertise.primary,
          experienceLevel: assigned.dev.analysis.experienceLevel.level,
          avatar: assigned.dev.avatar
        },
        score: Math.round(assigned.score),
        confidence,
        breakdown: assigned.breakdown,
        alternatives: devScores.slice(1, 3).map(ds => ({
          username: ds.dev.username,
          score: Math.round(ds.score),
          expertise: ds.dev.analysis.expertise.primary
        }))
      });

      // Update workload per story
      devWorkloads[assigned.dev.username] += storyPoints;
    }
  }

  return {
    success: true,
    assignments,
    workloadDistribution: devWorkloads,
    summary: {
      totalEpics: epics.length,
      totalStories: assignments.length,
      totalStoryPoints: Object.values(devWorkloads).reduce((a, b) => a + b, 0),
      avgStoryPointsPerDev: Object.values(devWorkloads).reduce((a, b) => a + b, 0) / developers.length,
      highConfidenceAssignments: assignments.filter(a => a.confidence === "high").length,
      mediumConfidenceAssignments: assignments.filter(a => a.confidence === "medium").length,
      lowConfidenceAssignments: assignments.filter(a => a.confidence === "low").length
    }
  };
}

/**
 * Manually reassign a story to a different developer with score recalculation
 * @param {Array} assignments - Current story-level assignments
 * @param {string} storyId - Story ID to reassign
 * @param {string} newDeveloperUsername - New developer username
 * @param {Object} workloadDistribution - Current workload distribution
 * @param {Array} developers - Full developer list for score recalculation
 * @returns {Object} Updated assignments and workload
 */
export function reassignStory(assignments, storyId, newDeveloperUsername, workloadDistribution, developers) {
  const assignmentIndex = assignments.findIndex(a => a.story?.story_id === storyId || a.epic?.epic_id === storyId);

  if (assignmentIndex === -1) {
    throw new Error(`Story ${storyId} not found in assignments`);
  }

  const assignment = assignments[assignmentIndex];
  const oldDeveloper = assignment.developer?.username;
  const storyPoints = assignment.story?.story_points || 5;

  // Update workload
  workloadDistribution[oldDeveloper] = Math.max(0, (workloadDistribution[oldDeveloper] || 0) - storyPoints);
  workloadDistribution[newDeveloperUsername] = (workloadDistribution[newDeveloperUsername] || 0) + storyPoints;

  // Find new developer's full data for proper score recalculation
  const newDev = developers?.find(d => d.username === newDeveloperUsername);

  if (newDev) {
    const epicType = assignment.epic?.classification?.primary || "Full Stack";
    const recalc = scoreDeveloper(newDev, epicType, workloadDistribution, developers || []);

    assignments[assignmentIndex].developer = {
      username: newDev.username,
      expertise: newDev.analysis?.expertise?.primary || "Full Stack",
      experienceLevel: newDev.analysis?.experienceLevel?.level || "Junior",
      avatar: newDev.avatar
    };
    assignments[assignmentIndex].score = Math.round(recalc.score);
    assignments[assignmentIndex].breakdown = recalc.breakdown;
    assignments[assignmentIndex].confidence = recalc.breakdown.expertiseMatch > 0 ? "manual-verified" : "manual";
  } else {
    assignments[assignmentIndex].developer.username = newDeveloperUsername;
    assignments[assignmentIndex].confidence = "manual";
  }

  return {
    success: true,
    assignments,
    workloadDistribution
  };
}
