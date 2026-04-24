// Ported from github-commit-analyzer/src/GitHubCommitAnalyzer.jsx (lines 90-236)

export const EXPERTISE_PATTERNS = {
  "Mobile Development": {
    extensions: ["swift", "kt", "java", "dart", "m", "h", "xib", "storyboard"],
    configFiles: ["pubspec.yaml", "build.gradle", "Podfile", "AndroidManifest.xml", "Info.plist", "app.json"],
    pathPatterns: ["ios/", "android/", "lib/", "flutter/"],
    icon: "📱",
    color: "purple"
  },
  "Frontend Development": {
    extensions: ["jsx", "tsx", "vue", "svelte", "html", "css", "scss", "sass", "less"],
    configFiles: ["package.json", "vite.config", "webpack.config", "next.config", "nuxt.config", "tailwind.config", ".babelrc", "tsconfig.json"],
    pathPatterns: ["src/components/", "src/pages/", "public/", "styles/", "assets/"],
    icon: "🌐",
    color: "blue"
  },
  "Backend Development": {
    extensions: ["py", "rb", "php", "go", "rs", "java", "cs", "ex", "exs"],
    configFiles: ["requirements.txt", "Gemfile", "composer.json", "go.mod", "Cargo.toml", "pom.xml", "build.gradle", "mix.exs"],
    pathPatterns: ["api/", "server/", "backend/", "controllers/", "models/", "services/"],
    icon: "⚙️",
    color: "green"
  },
  "DevOps/Infrastructure": {
    extensions: ["yml", "yaml", "tf", "hcl", "sh", "bash", "dockerfile"],
    configFiles: ["Dockerfile", "docker-compose.yml", ".gitlab-ci.yml", "Jenkinsfile", "terraform.tf", "ansible.yml", "kubernetes.yml", "k8s.yml", ".github/workflows"],
    pathPatterns: [".github/", "deploy/", "infrastructure/", "terraform/", "k8s/", "helm/"],
    icon: "🚀",
    color: "orange"
  },
  "Data Science/ML": {
    extensions: ["ipynb", "py", "r", "rmd", "jl"],
    configFiles: ["requirements.txt", "environment.yml", "setup.py", "pyproject.toml"],
    pathPatterns: ["notebooks/", "data/", "models/", "training/", "datasets/"],
    keywords: ["pandas", "numpy", "tensorflow", "pytorch", "sklearn", "keras", "matplotlib"],
    icon: "📊",
    color: "cyan"
  },
  "Database/SQL": {
    extensions: ["sql", "prisma", "graphql", "gql"],
    configFiles: ["prisma/schema.prisma", "knexfile.js", "sequelize.config.js", "typeorm.config"],
    pathPatterns: ["migrations/", "seeds/", "schema/", "database/"],
    icon: "🗄️",
    color: "amber"
  },
  "Game Development": {
    extensions: ["cs", "cpp", "c", "lua", "gd", "gdscript"],
    configFiles: ["project.godot", "*.uproject", "*.unity"],
    pathPatterns: ["Assets/", "Scripts/", "Scenes/", "Prefabs/"],
    icon: "🎮",
    color: "red"
  },
  "Full Stack": {
    icon: "💻",
    color: "indigo"
  }
};

function safeExt(filename) {
  const match = filename.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "";
}

export function detectExpertise(files, fileTypes) {
  const scores = {};
  const detectedTechs = new Set();

  // Initialize scores
  Object.keys(EXPERTISE_PATTERNS).forEach(expertise => {
    scores[expertise] = 0;
  });

  // Analyze each file
  files.forEach(file => {
    const filename = file.filename || file;
    const ext = safeExt(filename);
    const lowerFilename = filename.toLowerCase();

    Object.entries(EXPERTISE_PATTERNS).forEach(([expertise, patterns]) => {
      // Check extensions
      if (patterns.extensions?.includes(ext)) {
        scores[expertise] += 2;
        detectedTechs.add(ext.toUpperCase());
      }

      // Check config files
      patterns.configFiles?.forEach(config => {
        if (lowerFilename.includes(config.toLowerCase()) || lowerFilename.endsWith(config.toLowerCase())) {
          scores[expertise] += 5;
          detectedTechs.add(config);
        }
      });

      // Check path patterns
      patterns.pathPatterns?.forEach(pathPattern => {
        if (lowerFilename.includes(pathPattern.toLowerCase())) {
          scores[expertise] += 3;
        }
      });
    });
  });

  // Also use fileTypes data for additional scoring
  if (fileTypes && Array.isArray(fileTypes)) {
    fileTypes.forEach(ft => {
      const ext = ft.name.replace(".", "").toLowerCase();
      Object.entries(EXPERTISE_PATTERNS).forEach(([expertise, patterns]) => {
        if (patterns.extensions?.includes(ext)) {
          scores[expertise] += ft.value; // Weight by frequency
        }
      });
    });
  }

  // Sort by score and get top expertise areas
  const sortedExpertise = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  // If multiple areas have similar scores, might be Full Stack
  const topScore = sortedExpertise[0]?.[1] || 0;
  const significantAreas = sortedExpertise.filter(([_, score]) => score >= topScore * 0.5);

  let primaryExpertise = "Full Stack";
  let allExpertise = [];

  if (sortedExpertise.length === 0) {
    primaryExpertise = "General Development";
    allExpertise = [{ name: "General Development", score: 0, icon: "💻", color: "gray" }];
  } else if (significantAreas.length >= 3) {
    primaryExpertise = "Full Stack";
    allExpertise = significantAreas.map(([name, score]) => ({
      name,
      score,
      icon: EXPERTISE_PATTERNS[name]?.icon || "💻",
      color: EXPERTISE_PATTERNS[name]?.color || "gray"
    }));
  } else {
    primaryExpertise = sortedExpertise[0][0];
    allExpertise = sortedExpertise.slice(0, 4).map(([name, score]) => ({
      name,
      score,
      icon: EXPERTISE_PATTERNS[name]?.icon || "💻",
      color: EXPERTISE_PATTERNS[name]?.color || "gray"
    }));
  }

  return {
    primary: primaryExpertise,
    primaryIcon: EXPERTISE_PATTERNS[primaryExpertise]?.icon || "💻",
    primaryColor: EXPERTISE_PATTERNS[primaryExpertise]?.color || "gray",
    all: allExpertise,
    technologies: Array.from(detectedTechs).slice(0, 10)
  };
}
