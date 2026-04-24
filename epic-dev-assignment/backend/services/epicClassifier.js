import { EXPERTISE_PATTERNS } from '../utils/expertiseDetector.js';
import { classifyEpic as classifyWithGemini } from './flaskProxy.js';

// Epic type to expertise mapping keywords
const EPIC_TYPE_KEYWORDS = {
  "Mobile Development": {
    keywords: ["mobile app", "ios", "android", "flutter", "react native",
               "swift", "kotlin", "mobile ui", "app store", "google play",
               "mobile", "smartphone", "tablet"]
  },
  "Frontend Development": {
    keywords: ["web app", "dashboard", "ui", "user interface", "frontend",
               "react", "vue", "angular", "responsive design", "web components",
               "website", "web page", "client-side", "browser"]
  },
  "Backend Development": {
    keywords: ["api", "backend", "server", "microservice", "rest", "graphql",
               "database integration", "authentication", "authorization",
               "server-side", "endpoint", "web service"]
  },
  "DevOps/Infrastructure": {
    keywords: ["deployment", "ci/cd", "infrastructure", "cloud", "docker",
               "kubernetes", "terraform", "monitoring", "logging", "devops",
               "pipeline", "automation"]
  },
  "Data Science/ML": {
    keywords: ["analytics", "machine learning", "ai", "data processing",
               "prediction", "recommendation", "data pipeline", "ml model",
               "artificial intelligence", "data science", "neural network"]
  },
  "Database/SQL": {
    keywords: ["database", "sql", "data model", "schema", "migration",
               "query optimization", "data migration", "database design",
               "nosql", "mongodb", "postgresql", "mysql"]
  },
  "Game Development": {
    keywords: ["game", "unity", "unreal", "game engine", "3d", "physics",
               "game mechanics", "gameplay", "gaming"]
  },
  "Full Stack": {
    keywords: ["full stack", "end-to-end", "complete system", "fullstack"]
  }
};

/**
 * Classify an epic using hybrid rule-based + AI approach
 * @param {Object} epic - Epic object with epic_title and epic_description
 * @returns {Promise<Object>} Classification result with primary, confidence, and method
 */
export async function classifyEpic(epic) {
  const text = `${epic.epic_title || ''} ${epic.epic_description || ''}`.toLowerCase();

  // Step 1: Rule-based keyword matching
  const keywordScores = {};

  Object.entries(EPIC_TYPE_KEYWORDS).forEach(([type, config]) => {
    keywordScores[type] = config.keywords.filter(keyword =>
      text.includes(keyword.toLowerCase())
    ).length;
  });

  // Find top scoring types
  const maxScore = Math.max(...Object.values(keywordScores));
  const topTypes = Object.entries(keywordScores)
    .filter(([_, score]) => score === maxScore && score > 0)
    .map(([type]) => type);

  // If single clear match, return it
  if (topTypes.length === 1) {
    return {
      primary: topTypes[0],
      confidence: "high",
      method: "keyword",
      score: maxScore
    };
  }

  // If multiple matches, try Gemini classification
  if (topTypes.length > 1) {
    try {
      const geminiResult = await classifyWithGemini(epic.epic_title, epic.epic_description);
      if (geminiResult && geminiResult.category) {
        return {
          primary: geminiResult.category,
          confidence: "medium",
          method: "gemini",
          alternatives: topTypes
        };
      }
    } catch (err) {
      // Gemini unavailable — fall through to keyword-based result
      console.warn(`Gemini classification failed for "${epic.epic_title}":`, err.message);
    }
  }

  // Default to Full Stack or highest keyword score
  if (topTypes.length > 0) {
    return {
      primary: topTypes[0],
      confidence: "low",
      method: "keyword",
      alternatives: topTypes.slice(1)
    };
  }

  // No matches - default to Full Stack
  return {
    primary: "Full Stack",
    confidence: "low",
    method: "default"
  };
}

/**
 * Classify multiple epics
 * @param {Array} epics - Array of epic objects
 * @returns {Promise<Array>} Array of classification results
 */
export async function classifyEpics(epics) {
  const results = [];

  for (const epic of epics) {
    const classification = await classifyEpic(epic);
    results.push({
      epic_id: epic.epic_id,
      classification
    });
  }

  return results;
}
