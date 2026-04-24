# Focus Flow — Complete Application Flow

> AI-powered project planning platform: generates epics & stories via Gemini, analyzes developers via GitHub, assigns work intelligently, syncs everything to Jira, and monitors sprints in real-time.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Phase 0: Authentication](#phase-0-authentication)
- [Phase 1: Project Creation Wizard](#phase-1-project-creation-wizard)
  - [Step 1 — Epic Generation (AI)](#step-1--epic-generation-ai)
  - [Step 2 — Epic & Story Approval](#step-2--epic--story-approval)
  - [Step 3 — Developer Analysis (GitHub)](#step-3--developer-analysis-github)
  - [Step 4 — Intelligent Story Assignment](#step-4--intelligent-story-assignment)
  - [Step 5 — Sprint Configuration & Save](#step-5--sprint-configuration--save)
- [Phase 2: Jira Sync](#phase-2-jira-sync)
  - [Step 0 — Create Jira Project](#step-0--create-jira-project)
  - [Step 1 — Calculate Sprint Dates](#step-1--calculate-sprint-dates)
  - [Step 2 — Create Sprints](#step-2--create-sprints)
  - [Step 3 — Resolve Jira Users](#step-3--resolve-jira-users-two-tier-lookup)
  - [Step 4 — Add Developers to Team](#step-4--add-developers-to-project-team)
  - [Step 5 — Create Epics & Stories in Jira](#step-5--create-epics--stories-in-jira)
  - [Step 6 — Distribute Stories Across Sprints](#step-6--distribute-stories-across-sprints)
  - [Step 7 — Start First Sprint](#step-7--start-first-sprint)
  - [Sync Response](#sync-response)
- [Phase 3: Sprint Monitoring & Management](#phase-3-sprint-monitoring--management)
  - [Project Detail Page](#project-detail-page)
  - [Interactive Kanban Board (2-Way Jira Sync)](#interactive-kanban-board-2-way-jira-sync)
  - [Verify Page](#verify-page)
  - [Assign Page](#assign-page)
  - [Dashboard, Reports & Settings](#dashboard-reports--settings)
- [Data Transforms & Naming Conventions](#data-transforms--naming-conventions)
- [Data Persistence](#data-persistence)
- [API Reference](#api-reference)
- [Technical Details & Configuration](#technical-details--configuration)

---

## Architecture Overview

```
┌──────────────────────────────────┐
│  Frontend (React 19 + Vite)      │  Port 5173
│  Tailwind CSS 3 + Framer Motion  │
│  Vite proxy: /api → :3003        │
└──────────────┬───────────────────┘
               │  HTTP / JSON
┌──────────────▼───────────────────┐
│  Backend API Gateway (Express 5) │  Port 3003
│  Routes: epics, developers,      │
│  assignment, jira, sync          │
└──┬───────────────┬───────────────┘
   │               │
┌──▼──────┐  ┌─────▼──────────────┐
│  Flask   │  │  External APIs     │
│  Gemini  │  │  GitHub REST API   │
│  2.5     │  │  Jira REST API v3  │
│  Flash   │  │  Jira Agile API    │
│  Port    │  │                    │
│  5000    │  │                    │
└──────────┘  └────────────────────┘
```

**Three independent services must be running:**

| Service | Directory | Command | Port |
|---------|-----------|---------|------|
| AI Generator | `epic-generator/` | `python web_app.py` | 5000 |
| API Gateway | `epic-dev-assignment/backend/` | `npm start` | 3003 |
| Frontend UI | `epic-dev-assignment/frontend/` | `npm run dev` | 5173 |

The Vite dev server proxies all `/api` requests to the Express backend (120-second timeout for AI calls). Express proxies AI requests to Flask. Express handles GitHub and Jira APIs directly.

---

## Phase 0: Authentication

**Route:** `/login` — **File:** `frontend/src/pages/Login.jsx`

| Step | Detail |
|------|--------|
| 1 | User opens `http://localhost:5173` |
| 2 | `AuthGuard` component checks `sessionStorage('focus-flow-auth')` |
| 3 | If not authenticated → redirect to `/login` |
| 4 | User enters `admin` / `1234` (hardcoded credentials) |
| 5 | `AuthContext.login()` sets `sessionStorage('focus-flow-auth', 'true')` |
| 6 | Redirect to `/projects` (or previous protected route) |
| 7 | `AuthGuard` wraps all protected routes — logout clears sessionStorage |

**Key files:**
- `frontend/src/context/AuthContext.jsx` — login/logout logic, session check
- `frontend/src/components/layout/AuthGuard.jsx` — route protection wrapper

---

## Phase 1: Project Creation Wizard

**Route:** `/projects/new` — **File:** `frontend/src/pages/projects/ProjectWizardPage.jsx`

The wizard wraps four step components inside a sidebar layout with an animated dark-theme ambient background. Each step is a standalone component reusable from the legacy `/wizard` route.

---

### Step 1 — Epic Generation (AI)

**Component:** `frontend/src/components/steps/Step1_EpicGeneration.jsx`

#### User Action
User enters a project name and a free-text project description, then clicks "Generate".

#### API Call
```
Frontend                    Express                         Flask
   │                           │                              │
   ├── POST /api/generate ────►│                              │
   │   { description }         ├── POST /api/generate ───────►│
   │                           │   { description }            │
   │                           │                              ├── Gemini 2.5 Flash
   │                           │                              │   (structured prompt)
   │                           │                              │
   │                           │◄── { success, result } ──────┤
   │◄── { success, result } ───┤                              │
```

#### What Gemini Generates

The Flask service (`epic-generator/web_app.py`) sends a detailed prompt to Gemini 2.5 Flash (`src/gemini_generator.py`) that:

1. **Estimates complexity** — counts features/bullet points in the description to determine epic count (3–10)
2. **Generates structured output** with strict numbering: `E1`, `E1-US1`, `E1-US1-TC1`
3. **Enforces quality rules:**
   - SPECIFIC details from the project description (not generic)
   - MEASURABLE metrics in acceptance criteria (e.g., "within 2 seconds", "99.5% uptime")
   - Concrete test data (e.g., "Username: testuser@example.com")

#### Generated Data Structure

```json
{
  "success": true,
  "result": {
    "epics": [
      {
        "epic_id": "E1",
        "epic_title": "User Authentication & Authorization",
        "epic_description": "Comprehensive auth system with OAuth2...",
        "user_stories": [
          {
            "story_id": "E1-US1",
            "story_title": "User Registration with Email Verification",
            "story_description": "As a new user, I want to register...",
            "story_points": "5",
            "acceptance_criteria": "1. Registration form validates email format in real-time\n2. Password requires 8+ chars with 1 uppercase, 1 number\n3. Verification email sent within 5 seconds...",
            "test_cases": [
              {
                "test_case_id": "E1-US1-TC1",
                "test_case_description": "Verify successful user registration flow",
                "input_preconditions": "Application running, email service configured, database empty",
                "input_test_data": "Username: testuser@example.com, Password: SecurePass123!",
                "input_user_action": "1. Navigate to /register\n2. Enter email and password\n3. Click 'Create Account'\n4. Check email inbox\n5. Click verification link",
                "expected_results": [
                  "1. Registration completes within 2 seconds",
                  "2. Verification email received within 5 seconds",
                  "3. User redirected to dashboard after verification",
                  "4. Welcome notification displayed for 3 seconds"
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "raw_output": "...(raw Gemini text)...",
  "generator_used": "Gemini API"
}
```

#### Parsing Pipeline (Flask)

1. `_strip_markdown()` — removes bold/italic/backtick formatting so regex works
2. `parse_multiple_epics()` — regex extracts:
   - Epic blocks: `Epic E\d+:` pattern
   - Story blocks: `User Story E\d+-US\d+:` pattern
   - Test case blocks: `Test Case ID: E\d+-US\d+-TC\d+` pattern
   - Expected results: numbered list items

#### Loading UX
Progress messages cycle at intervals (3s, 8s, 15s, 25s, 40s) while waiting for Gemini response.

---

### Step 2 — Epic & Story Approval

**Component:** `frontend/src/components/steps/Step2_EpicApproval.jsx`

#### What the User Sees

Each epic is an expandable card containing:

| Section | Content |
|---------|---------|
| **Epic Header** | Epic ID badge, title, approved/pending status |
| **Epic Description** | Full description text |
| **Stories** | Expandable list of user stories |
| **Story Detail** | Story ID, title, description, story points |
| **Acceptance Criteria** | Full AC text with approve/regenerate buttons |
| **Test Cases** | Each TC shows: ID, description, preconditions, test data, user action, expected results (numbered) |
| **Actions** | Approve Epic, Regenerate, Remove (with confirmation) |

#### Approval Flow

1. User reviews each story's acceptance criteria and test cases
2. Individual story approval or epic-level bulk approval
3. **Approved epics auto-collapse** to reduce visual clutter
4. User can **regenerate** any component (epic, story, AC, test case):
   - `POST /api/regenerate { type, project_description, context }`
   - Flask builds a targeted prompt and calls Gemini
   - Returns regenerated component only (not the whole project)
5. Proceed to Step 3 requires at least 2 approved epics

#### Data After Approval

Only approved epics and their approved stories are carried forward. The `approved` flag is set on each epic and story object.

---

### Step 3 — Developer Analysis (GitHub)

**Component:** `frontend/src/components/steps/Step3_DeveloperAnalysis.jsx`

#### Developer Sources

1. **Persistent Roster** — previously analyzed developers auto-loaded from `localStorage('focus-flow-developers')`. Auto-imports developers from existing projects on mount.
2. **New Analysis** — user enters GitHub usernames (with optional owner/repo for targeted analysis)

#### API Call

```
POST /api/analyze-developers
{
  "developers": [
    { "username": "octocat", "owner": "octocat", "repo": "hello-world" },
    { "username": "torvalds" }
  ]
}
```

Also accepts simplified form: `{ "github_usernames": ["octocat", "torvalds"] }`

#### GitHub Analysis Pipeline

For each developer, `githubService.analyzeDeveloper()` runs:

```
1. Fetch user's top 10 repos (sorted by last push)
   GET https://api.github.com/users/{username}/repos?sort=pushed&per_page=10

2. For each repo, fetch recent commits (max 30 per repo)
   GET https://api.github.com/repos/{owner}/{repo}/commits?author={username}&per_page=30

   ⚠ Fallback: if author filter returns 0 and owner === username,
     retry WITHOUT author filter (handles author name mismatch)

3. For each commit, fetch detailed diff stats
   GET https://api.github.com/repos/{owner}/{repo}/commits/{sha}
   → Extracts: files changed, lines added/deleted, file extensions

4. Aggregate & Analyze:
   ├── File types → expertise detection (expertiseDetector.js)
   ├── Commit patterns → experience level (experienceCalculator.js)
   ├── Work hours → on-time percentage
   ├── Message quality → convention adherence
   └── Commit intervals → consistency score
```

#### Expertise Detection (`backend/utils/expertiseDetector.js`)

Analyzes file extensions and paths against keyword patterns:

| Expertise Area | File Patterns |
|---------------|---------------|
| Mobile Development | `.swift`, `.kt`, `.dart`, `ios/`, `android/` |
| Frontend | `.jsx`, `.tsx`, `.vue`, `.html`, `.css`, `.scss` |
| Backend | `.py`, `.go`, `.java`, `.rb`, `api/`, `server/` |
| DevOps | `Dockerfile`, `.yml`, `terraform/`, `.tf`, `k8s/` |
| Data Science/ML | `.ipynb`, `model/`, `training/`, `dataset/` |
| Database/SQL | `.sql`, `migration/`, `schema/` |
| Game Development | `.unity`, `.cs` (Unity), `.uasset` |
| Full Stack | Assigned when 3+ areas have significant scores |

Returns: `{ primary, primaryIcon, primaryColor, all: [{ name, score }], technologies: ["React", "Python", ...] }`

#### Experience Level Calculation (`backend/utils/experienceCalculator.js`)

| Factor | Weight | Scoring |
|--------|--------|---------|
| Commit volume | 40 pts | >200 commits = 40, scaled down linearly |
| Work pattern | 15 pts | On-time % ≥ 60 = 15 |
| Message quality | 25 pts | Convention adherence ≥ 40 = 25 |
| Consistency | 20 pts | Low interval variance ≥ 70 = 20 |

| Total Score | Level |
|------------|-------|
| ≥ 80 | Senior |
| ≥ 60 | Mid-Level |
| ≥ 40 | Junior |
| < 40 | Beginner |

#### Developer Profile Card

Each analyzed developer shows:
- Avatar, username, experience level badge, primary expertise badge
- Stats grid: Total Commits, On-Time %, Consistency Score, Avg Commit Size
- Top skills (up to 6 technology badges)
- Expandable charts: File Types pie, Commit Sizes bar, Frequency line, On-Time vs Late, Weekday Activity, Hourly Activity

#### Roster Workload Display

For roster developers, shows current workload across all projects:
- Stories assigned, story points allocated, project count
- Computed from all projects in localStorage

#### Data Merge

Selected roster developers + newly analyzed developers are merged (deduplicated by username). New developers are auto-saved to the persistent roster for future projects.

---

### Step 4 — Intelligent Story Assignment

**Component:** `frontend/src/components/steps/Step4_Assignment.jsx`

#### API Call

```
POST /api/auto-assign
{
  "epics": [
    {
      "epic_id": "E1",
      "epic_title": "User Authentication",
      "user_stories": [
        { "story_id": "E1-US1", "story_title": "Registration", "story_points": "5" }
      ]
    }
  ],
  "developers": [ /* full developer objects with analysis */ ]
}
```

#### Assignment Algorithm (`backend/services/assignmentService.js`)

**Pre-step: Epic Classification** (`backend/services/epicClassifier.js`)

Each epic is classified to determine what expertise it requires. Uses a 3-tier approach:

1. **Keyword Matching** — scans title + description against 8 expertise keyword sets. If a single clear winner → "high" confidence
2. **Gemini AI Classification** — if multiple keyword matches tie, asks Gemini to classify. Returns "medium" confidence
3. **Default Fallback** — if no keywords match, defaults to "Full Stack" with "low" confidence

**Scoring: Three Factors (max 100 points per story)**

```
┌─────────────────────────────────────────────────────────┐
│ EXPERTISE MATCH (50 points max)                         │
│                                                         │
│ Look for epic's classification in developer's           │
│ expertise.all[] array.                                  │
│                                                         │
│ If found:                                               │
│   normalized = matchScore / developer's maxScore        │
│   expertisePoints = normalized × 50                     │
│                                                         │
│ If not found but developer is "Full Stack":             │
│   fullStackPoints = min(30, (areaCount / 5) × 30)      │
│   (rewards breadth across areas)                        │
│                                                         │
│ If not found and not Full Stack: 0 points               │
│   (penalizes expertise mismatch)                        │
├─────────────────────────────────────────────────────────┤
│ EXPERIENCE LEVEL (30 points max)                        │
│                                                         │
│ Senior: 30 │ Mid-Level: 20 │ Junior: 10 │ Beginner: 5  │
├─────────────────────────────────────────────────────────┤
│ WORKLOAD BALANCE (20 points max)                        │
│                                                         │
│ loadRatio = 1 - (currentLoad / maxLoadAmongAllDevs)     │
│ If at/over capacity (100 SP): 0 points                  │
│ Otherwise: round(max(0, min(20, loadRatio × 20)))       │
│ (rewards underloaded developers)                        │
└─────────────────────────────────────────────────────────┘

FINAL SCORE = expertiseMatch + experienceLevel + workloadBalance
```

**Confidence Levels:**

| Level | Criteria |
|-------|----------|
| High | Score ≥ 65 AND has expertise match AND gap ≥ 10 over next-best |
| High | Score ≥ 50 AND has expertise match AND gap ≥ 5 |
| Medium | Score ≥ 40 OR has expertise match |
| Low | Everything else |

Confidence is downgraded if the epic classification itself was low-confidence.

**Workload Rebalancing:** After each story is assigned, the developer's workload counter increases by that story's points. This naturally pushes subsequent stories toward less-loaded developers.

#### Assignment Response

```json
{
  "success": true,
  "assignments": [
    {
      "epic": { "epic_id": "E1", "epic_title": "...", "classification": { "primary": "Backend", "confidence": "high" } },
      "story": { "story_id": "E1-US1", "story_title": "...", "story_points": 5 },
      "developer": { "username": "octocat", "expertise": "Backend", "experienceLevel": "Senior", "avatar": "..." },
      "score": 85,
      "confidence": "high",
      "breakdown": { "expertiseMatch": 45, "experienceLevel": 30, "workloadBalance": 10 },
      "alternatives": [
        { "username": "torvalds", "score": 72, "expertise": "Backend" },
        { "username": "gvanrossum", "score": 61, "expertise": "Full Stack" }
      ]
    }
  ],
  "workloadDistribution": { "octocat": 25, "torvalds": 30 },
  "summary": {
    "totalEpics": 5, "totalStories": 18, "totalStoryPoints": 89,
    "avgStoryPointsPerDev": 29.7,
    "highConfidenceAssignments": 12, "mediumConfidenceAssignments": 4, "lowConfidenceAssignments": 2
  }
}
```

#### Assignment UI

- **Header stats:** Epic count, Story count, Total points, Confidence breakdown
- **Epic groups:** Collapsible cards (all auto-expanded after assignment)
  - Epic header: icon, ID, classification type, total points, story count, developer avatars
  - Story rows: Story ID badge, title, SP, assigned dev (avatar + name + expertise), score, confidence badge
  - Reassign dropdown per story
  - Alternatives row showing next-best developers
- **Workload Distribution chart:** Horizontal bar per developer with "Balanced"/"Unbalanced" indicator (±30% threshold)
- **Export:** CSV and JSON download buttons

#### Manual Reassignment

```
POST /api/reassign
{ "story_id": "E1-US1", "new_developer": "torvalds", "developers": [...] }

Response:
{ "success": true, "story_id": "E1-US1", "assigned_developer": "torvalds", "confidence": "manual" }
```

---

### Step 5 — Sprint Configuration & Save

**Located in:** `ProjectWizardPage.jsx` (lines 317–483)

#### Sprint Configuration

| Setting | Details |
|---------|---------|
| **Deadline** | Value + unit dropdown (hours / days / weeks / months). Displays computed end date. |
| **Sprint Count** | Manual input (1–10) or **"Suggest Optimal"** button |
| **Sprint Preview** | Cards showing date ranges for each sprint |

**Smart Sprint Suggestion Formula:**
```
byDuration = totalDays / 14        (one sprint per 2 weeks)
byStories  = totalStories / 10     (10 stories per sprint)
byPoints   = totalPoints / 35      (35 points per sprint)
suggested  = median(byDuration, byStories, byPoints)
result     = clamp(suggested, 1, 10)
```

#### Two Save Paths

**Path A: Save & Sync to Jira**
- Triggers `SyncButton` component
- Sends full payload to `POST /api/ai/sync-jira` (see Phase 2)
- On success: stores project with status `'synced'`, includes all Jira keys
- Shows animated progress through 5 sync steps + warning panel

**Path B: Save Without Jira**
- Creates project in localStorage with status `'assigned'` (or `'stories-ready'` if no assignments)
- No Jira interaction
- Project can be synced later from AssignPage

#### Project Data Stored to localStorage

```json
{
  "id": "1710842400000",
  "name": "E-Commerce Platform",
  "rawText": "Build a modern e-commerce...",
  "createdAt": "2026-03-19T10:00:00.000Z",
  "status": "synced",
  "epics": [
    {
      "id": "E1", "title": "User Authentication", "description": "...",
      "status": "approved",
      "jiraKey": "ECP-1",
      "stories": [
        {
          "id": "E1-US1", "title": "Registration", "description": "...",
          "acceptanceCriteria": "1. Email validation...",
          "storyPoints": 5,
          "testCases": [
            {
              "id": "E1-US1-TC1", "description": "Verify registration",
              "preconditions": "App running, DB empty",
              "testData": "Username: test@example.com",
              "userAction": "1. Navigate to /register...",
              "expectedResults": ["1. Completes within 2s", "2. Email received within 5s"]
            }
          ],
          "status": "approved",
          "jiraKey": "ECP-2"
        }
      ]
    }
  ],
  "assignments": [
    {
      "epic_id": "E1", "epic_title": "User Authentication",
      "story_id": "E1-US1", "story_title": "Registration",
      "story_points": 5, "assigned_developer": "octocat",
      "score": 85, "confidence": "high"
    }
  ],
  "analyzedDevelopers": [ /* full developer profiles */ ],
  "deadline": { "value": 4, "unit": "weeks" },
  "jiraSprintId": 123,
  "jiraProjectKey": "ECP",
  "jiraBoardId": 456
}
```

---

## Phase 2: Jira Sync

**Endpoint:** `POST /api/ai/sync-jira` — **File:** `backend/routes/sync.js`

**Trigger:** `SyncButton` component (`frontend/src/components/projects/SyncButton.jsx`)

The SyncButton shows an animated progress panel cycling through 5 visual steps while the backend executes 8 actual steps:

```
Frontend Progress Steps          Backend Actual Steps
━━━━━━━━━━━━━━━━━━━━━━          ━━━━━━━━━━━━━━━━━━━━
1. Creating Jira project...  →  Step 0: Create project + discover board
2. Adding developers...      →  Step 3: Resolve users + Step 4: Add to team
3. Creating epics & stories  →  Step 5: Create all issues
4. Setting up sprints...     →  Step 1-2: Calculate + create sprints
                                Step 6: Distribute stories across sprints
5. Starting sprint...        →  Step 7: Activate first sprint
```

#### Request Payload

```json
{
  "epics": [{ "id", "title", "description", "status": "approved", "stories": [...] }],
  "assignments": [{ "story_id", "epic_id", "assigned_developer", "score", "confidence" }],
  "dependencies": [{ "from": "E1-US2", "to": "E1-US1" }],
  "deadline": { "value": 4, "unit": "weeks" },
  "projectName": "E-Commerce Platform",
  "sprintCount": 3,
  "developerJiraMap": { "octocat": "octocat@company.com" }
}
```

---

### Step 0 — Create Jira Project

```
1. getMyself() → GET /rest/api/3/myself
   → Returns authenticated user's accountId (used as project lead)

2. generateProjectKey("E-Commerce Platform") → "ECP"
   → Takes first letter of each word, max 10 chars

3. createProject("E-Commerce Platform", "ECP", leadAccountId)
   → POST /rest/api/3/project
   → Uses Scrum template: com.pyxis.greenhopper.jira:gh-simplified-scrum-classic
   → On 409 conflict: retry with ECP2, ECP3... (up to 5 attempts)

4. Wait 2 seconds (Jira needs time to provision the board)

5. getProjectBoards(projectKey)
   → GET /rest/agile/1.0/board?projectKeyOrId=ECP
   → Prefers Scrum board type
   → Warns if only Kanban board found (sprints not supported on Kanban)
```

---

### Step 1 — Calculate Sprint Dates

```
Start date: now (new Date())
End date: start + deadline (value × unit)

Unit conversions:
  hours  → value × 3,600,000 ms
  days   → value × 86,400,000 ms
  weeks  → value × 604,800,000 ms
  months → value × 2,592,000,000 ms (30 days)

Validation:
  - Duration must be positive (value ≥ 1, default 2)
  - If endDate ≤ startDate → default to 14 days
  - Sprint count clamped to 1–10

Sprint duration = totalMs / numSprints
```

---

### Step 2 — Create Sprints

```
For i = 0 to numSprints - 1:
  sprintStart = startDate + (sprintDuration × i)
  sprintEnd   = startDate + (sprintDuration × (i + 1))
  sprintName  = "E-Commerce Platform - Sprint {i+1}"

  createSprint(boardId, sprintName, sprintStart, sprintEnd)
  → POST /rest/agile/1.0/sprint
  → { name, startDate, endDate, originBoardId }

  On failure: warning added, continues to next sprint
```

---

### Step 3 — Resolve Jira Users (Two-Tier Lookup)

For each unique developer in assignments:

```
┌─────────────────────────────────────────────────────────────────┐
│ Tier 1: Explicit Jira Email                                     │
│                                                                 │
│ If developerJiraMap["octocat"] = "octocat@company.com":         │
│   searchUser("octocat@company.com")                             │
│   → GET /rest/api/3/user/search?query=octocat@company.com      │
│   → Filter: active !== false                                    │
│   → Sort: exact email match first, then name match              │
│                                                                 │
│ If found → cache accountId                                      │
├─────────────────────────────────────────────────────────────────┤
│ Tier 2: GitHub Username Fallback                                │
│                                                                 │
│ If Tier 1 returned nothing:                                     │
│   searchUser("octocat")                                         │
│   → Searches Jira by display name / username                    │
│   → Same filtering + sorting                                    │
│                                                                 │
│ If found → cache accountId + add "fuzzy match" warning          │
├─────────────────────────────────────────────────────────────────┤
│ If neither tier found:                                          │
│   → Add to "unresolved users" warning list                      │
│   → Story will be created without assignee                      │
└─────────────────────────────────────────────────────────────────┘
```

---

### Step 4 — Add Developers to Project Team

```
1. getProjectRoles(projectKey)
   → GET /rest/api/3/project/ECP/role
   → Returns: { "Member": 10100, "Developers": 10101, "Administrators": 10102 }

2. Find target role (preference order):
   "Member" → "Developers" → "Developer" → any non-admin role

3. For each resolved developer:
   addUserToProjectRole(projectKey, roleId, accountId)
   → POST /rest/api/3/project/ECP/role/10100
   → { "user": ["accountId"] }
   → On failure: warning added, continues
```

This gives developers proper project access so they can view and update their assigned stories.

---

### Step 5 — Create Epics & Stories in Jira

#### Epic Creation

```
For each approved epic:
  createEpic(projectKey, title, description)
  → POST /rest/api/3/issue
  → {
      fields: {
        project: { key: "ECP" },
        summary: title,
        description: { type: "doc", content: [ADF paragraphs] },
        issuetype: { name: "Epic" }
      }
    }
  → Returns: { id, key: "ECP-1" }

  If epic has assigned developer:
    assignIssue("ECP-1", accountId)
    → PUT /rest/api/3/issue/ECP-1/assignee
```

#### Story Creation (with full AC + Test Cases)

```
For each approved story in the epic:
  createStory(projectKey, title, description, acceptanceCriteria, epicKey, testCases)
  → POST /rest/api/3/issue
  → {
      fields: {
        project: { key: "ECP" },
        summary: title,
        description: { /* ADF document (see below) */ },
        issuetype: { name: "Story" },
        [discoveredEpicLinkField]: "ECP-1"    ← dynamic field ID
      }
    }
```

**Jira Story Description (ADF Format):**

The story description is built as an Atlassian Document Format (ADF) document containing:

```
┌──────────────────────────────────────────────────┐
│ Description                                       │
│ "As a user, I want to register so that..."       │
│                                                   │
│ ── Acceptance Criteria ──                         │
│ 1. Email validation in real-time                  │
│ 2. Password requires 8+ chars with 1 uppercase    │
│ 3. Verification email within 5 seconds            │
│                                                   │
│ ── Test Case: E1-US1-TC1 ──                       │
│ Verify successful user registration flow          │
│                                                   │
│ Preconditions:                                    │
│ Application running, email service configured     │
│                                                   │
│ Test Data:                                        │
│ Username: testuser@example.com, Pass: Secure123!  │
│                                                   │
│ Steps:                                            │
│ 1. Navigate to /register                          │
│ 2. Enter email and password                       │
│ 3. Click 'Create Account'                         │
│                                                   │
│ Expected Results:                                 │
│   1. Registration completes within 2 seconds      │
│   2. Verification email received within 5 seconds │
│   3. User redirected to dashboard                 │
│   4. Welcome notification for 3 seconds           │
└──────────────────────────────────────────────────┘
```

**After story creation:**

```
updateStoryPoints("ECP-2", 5)
→ PUT /rest/api/3/issue/ECP-2
→ { fields: { [discoveredStoryPointsField]: 5 } }

assignIssue("ECP-2", accountId)
→ PUT /rest/api/3/issue/ECP-2/assignee
→ { accountId: "..." }

Note: Story-level assignment is preferred. Falls back to epic-level
assignment if no story-specific assignment exists.
```

---

### Step 6 — Distribute Stories Across Sprints

**Algorithm:** Dependency-aware greedy bin-packing with epic cohesion

```
distributeStoriesAcrossSprints(allStories, sprintCount, dependencies)

Phase 1: Build Dependency Graph
  blockedBy[storyId] = [list of blocker storyIds]
  (from dependencies[].from → dependencies[].to)

Phase 2: Group Stories by Epic
  epicGroups = { epicIdx → [stories] }
  Keeps same-epic stories together (cohesion)

Phase 3: Sort Epic Groups
  Sort by total story points descending
  (largest epics placed first for better balance)

Phase 4: Place Each Epic Group
  For each epic group:
    1. Find minimum eligible sprint:
       - Check all stories' blockers
       - Minimum sprint = max(blocker sprint + 1) across all blockers
       - Ensures dependent stories come AFTER their blockers

    2. Among eligible sprints (≥ minimum):
       - Pick the sprint with lowest current total points
       - (greedy bin-packing for load balance)

    3. Place all stories from this epic group into chosen sprint

Phase 5: Validation Pass
  For each story:
    For each blocker of this story:
      If blocker is in same or later sprint → VIOLATION
        → Move this story to blocker's sprint + 1
  (catches edge cases from epic-group-level placement)

Result: Array of sprint bins → [[stories], [stories], ...]
```

**Move to Jira Sprints:**

```
Single sprint:
  moveIssueToSprint(sprints[0].id, [all story keys])

Multiple sprints:
  For each sprint bin:
    moveIssueToSprint(sprints[i].id, [story keys in this bin])

API: POST /rest/agile/1.0/sprint/{sprintId}/issue
     { issues: ["ECP-2", "ECP-3", "ECP-5"] }
```

**Important:** Epics are NOT moved into sprints. Only stories go into sprints. Epics span across all sprints per Jira best practice.

---

### Step 7 — Start First Sprint

```
startSprint(sprints[0].id, startDate, endDate, boardId)
→ PUT /rest/agile/1.0/sprint/{sprintId}
→ { state: "active", startDate, endDate }

Pre-check: If another sprint is already active on this board,
  → Close it first (set state: "closed")
  → Then start the new sprint
  → Non-fatal if close fails (warning added)
```

This ensures the sprint appears on the Jira board and developers can start working immediately.

---

### Sync Response

```json
{
  "results": [
    {
      "epicId": "E1",
      "epicKey": "ECP-1",
      "stories": [
        { "storyId": "E1-US1", "storyKey": "ECP-2" },
        { "storyId": "E1-US2", "storyKey": "ECP-3" }
      ]
    }
  ],
  "sprintId": 123,
  "sprintName": "E-Commerce Platform - Sprint 1",
  "sprintCount": 3,
  "sprints": [
    { "id": 123, "name": "E-Commerce Platform - Sprint 1" },
    { "id": 124, "name": "E-Commerce Platform - Sprint 2" },
    { "id": 125, "name": "E-Commerce Platform - Sprint 3" }
  ],
  "totalIssues": 23,
  "jiraProjectKey": "ECP",
  "jiraBoardId": 456,
  "teamMembers": ["octocat", "torvalds"],
  "warnings": [
    "Developer 'ghost-user' not found in Jira — stories created without assignee",
    "Fuzzy match: 'octocat' matched to 'The Octocat (octocat@github.com)'"
  ]
}
```

**Frontend post-sync:**
1. Updates each epic and story with their Jira keys (`jiraKey` field)
2. Adds all developers to persistent roster
3. Saves project to localStorage with status `'synced'`
4. Stores `jiraSprintId`, `jiraProjectKey`, `jiraBoardId`
5. Displays success card with completed steps + warnings (if any)
6. Navigates to `/projects/:id`

---

## Phase 3: Sprint Monitoring & Management

### Project Detail Page

**Route:** `/projects/:id` — **File:** `frontend/src/pages/projects/ProjectDetailPage.jsx`

Renders one of two views based on project status:

#### LocalProjectView (Non-Synced)

For projects saved without Jira sync:

| Component | Content |
|-----------|---------|
| **Project Readiness** | Health score (0–100): epic approval 30% + assignments 30% + team readiness 20% + deadline pressure 20% |
| **Stat Cards** (6) | Epics, Stories, Story Points, Developers, Assignments, Approved % |
| **Developer Tiles** | Avatar + name + assignment count per dev |
| **Story Points Chart** | Horizontal bar chart: points per epic with animated bars |
| **Epics & Stories** | Collapsible list showing all epics with nested stories |

**Story Detail** (expandable per story):
- Title, description, story points, Jira key (if synced)
- **Acceptance Criteria** — shown in emerald-colored box with ClipboardCheck icon
- **Test Cases** — full breakdown: ID, description, preconditions, test data, steps, expected results

#### SyncedProjectView (Jira-Synced)

For projects synced to Jira — real-time data via SWR hooks:

| Component | Content | Refresh |
|-----------|---------|---------|
| **Sprint Health** | `calculateHealthScore()`: burndown deviation 40%, blockers 30%, bugs 20%, scope change 10% | 60s |
| **Sprint Velocity** | Tasks/day rate + estimated days to finish | 30s |
| **Jira Stat Cards** (8) | Issues, Completed, In Progress, To Do, Blockers, Bugs, Points Done, Developers | 30s |
| **Alert Banners** | Red banners for blockers/bugs/scope changes | 30s |
| **Burndown Chart** | Ideal vs Actual lines with day-by-day points | 60s |
| **Burnup Chart** | Cumulative done vs total scope | 60s |
| **Developer Workload** | Per-dev tiles with Jira progress bars (done/in-progress/todo) | 30s |
| **Blocked/Critical** | List of blocker and high-priority issues | 30s |
| **Interactive Kanban** | Mini drag-and-drop board (see below) | 30s |
| **Story Points Chart** | Points per epic | — |
| **Epics & Stories** | Collapsible list with AC + Test Cases per story | — |

---

### Interactive Kanban Board (2-Way Jira Sync)

Available in two places:
- **Mini board** inside ProjectDetailPage
- **Full board** at `/projects/:id/kanban` (`ProjectKanbanPage.jsx`)

#### Data Source

```
Primary: useProjectIssues(projectKey)
  → GET /api/jira/project/ECP/issues
  → JQL: project = "ECP" AND issuetype != Epic ORDER BY status ASC, key ASC
  → Returns ALL stories across ALL sprints

Fallback: useSprintIssues(sprintId)
  → GET /api/jira/sprint/123/issues
  → Returns stories from single sprint only
```

Project-level query is preferred because it shows the complete picture across all sprints, matching Jira's own board view.

#### Three Columns (Status Normalization)

```
normalizeStatus(jiraStatus):

  "Done", "Closed", "Resolved",
  "Complete", "Completed"          →  "Done"

  "In Progress", "Review",
  "In Review"                      →  "In Progress"

  Everything else                  →  "To Do"
```

#### Card Appearance

Each card shows:
- Issue key (e.g., `ECP-2`) in column color
- Priority flag icon
- Summary text
- Assignee avatar + name
- Story points badge in column color

**Column colors:** To Do = gray, In Progress = blue, Done = emerald. Cards have a colored left border accent matching their column.

#### Drag-and-Drop Flow (Optimistic Updates)

```
1. User drags "ECP-2" from "To Do" to "In Progress"
   │
   ├── IMMEDIATELY: Set pendingMoves["ECP-2"] = "In Progress"
   │   (Card visually moves to In Progress column instantly)
   │
   ├── FETCH: GET /api/jira/issue/ECP-2
   │   → Returns available transitions:
   │     [{ id: "21", name: "In Progress", to: "In Progress" },
   │      { id: "31", name: "Done", to: "Done" }]
   │
   ├── MATCH: Target column "In Progress" matches transition "21"
   │
   ├── EXECUTE: PUT /api/jira/issue/ECP-2 { transitionId: "21" }
   │   → Jira transitions the issue
   │
   ├── CONFIRM: await mutateIssues()
   │   → SWR fetches fresh data from Jira
   │
   └── CLEAR: Remove pendingMoves["ECP-2"]
       (Card now reflects real Jira state)

ON FAILURE:
   └── REVERT: Remove pendingMoves["ECP-2"]
       (Card snaps back to its real Jira position)
```

**Anti-Snapback Pattern:**

```javascript
// SWR issues refreshes freely every 30s
// pendingMoves always override stale server data:

mergedIssues = swrIssues.map(issue =>
  pendingMoves[issue.key]
    ? { ...issue, status: pendingMoves[issue.key] }
    : issue
);

// Pending move is ONLY cleared AFTER mutateIssues() returns fresh data
// This prevents the brief revert during API round-trip
```

#### Filters (Full Kanban Page)

- **Search**: by issue key or summary text
- **Assignee**: dropdown of all assignees
- **Priority**: dropdown of all priorities
- **Type**: dropdown of issue types
- **Clear All**: resets all filters

---

### Verify Page

**Route:** `/projects/:id/verify` — **File:** `frontend/src/pages/projects/VerifyPage.jsx`

| Feature | Detail |
|---------|--------|
| **Stats Grid** | Total items, Approved, Pending, Rejected counts |
| **Bulk Actions** | "Approve All" and "Reject All" buttons |
| **Epic Cards** | Expandable cards with approve/reject per epic |
| **Story Cards** | Nested inside epics, showing AC + Test Cases |
| **Edit Modal** | Edit title, description, acceptanceCriteria for any story |
| **Jira Sync** | SyncButton available for syncing reviewed projects |

Edit flow: Click edit on a story → modal with fields → save updates to localStorage → reflects in UI.

---

### Assign Page

**Route:** `/projects/:id/assign` — **File:** `frontend/src/pages/projects/AssignPage.jsx`

Full developer selection, analysis, auto-assignment, and Jira sync in one page:

| Section | Details |
|---------|---------|
| **Roster Selection** | Toggle existing developers from persistent roster |
| **Analyze New** | Enter GitHub usernames → analyze → add to selection |
| **Developer Cards** | Selected devs with avatar, expertise, skills, remove button |
| **Auto-Assign** | Triggers `/api/auto-assign` with selected devs + project epics |
| **Assignment Table** | Grouped by epic, each story row has reassign dropdown |
| **Sprint Config** | Deadline + sprint count + auto-suggest |
| **Jira Map** | Optional: map GitHub usernames to Jira emails |
| **SyncButton** | Passes `epics, assignments, dependencies, deadline, projectName, sprintCount, developerJiraMap` |

---

### Dashboard, Reports & Settings

| Page | Route | Purpose |
|------|-------|---------|
| **Dashboard** | `/dashboard` | Sprint health overview, burndown chart, alerts panel, sprint summary |
| **Kanban** | `/kanban` | Global kanban board across all Jira sprints |
| **Reports** | `/reports` | Sprint reports with PDF/CSV/JSON export (`jspdf`, `jspdf-autotable`) |
| **Settings** | `/settings` | Jira connection test, configuration display |

---

## Data Transforms & Naming Conventions

### Flask → Frontend (snake_case → camelCase)

Handled by `transformEpicsForProject()` in `ProjectWizardPage.jsx`:

```
Flask (Python snake_case)          Frontend (JS camelCase)
━━━━━━━━━━━━━━━━━━━━━━━          ━━━━━━━━━━━━━━━━━━━━━━
epic_id                     →     id
epic_title                  →     title
epic_description            →     description
user_stories                →     stories
  story_id                  →       id
  story_title               →       title
  story_description         →       description
  acceptance_criteria       →       acceptanceCriteria
  story_points              →       storyPoints (parseInt)
  test_cases                →       testCases
    test_case_id            →         id
    test_case_description   →         description
    input_preconditions     →         preconditions
    input_test_data         →         testData
    input_user_action       →         userAction
    expected_results        →         expectedResults
```

### Frontend → Auto-Assign (camelCase → snake_case)

`AssignPage.jsx` and `ProjectWizardPage.jsx` transform approved epics back:

```
Frontend (camelCase)               Backend (snake_case)
━━━━━━━━━━━━━━━━━━━              ━━━━━━━━━━━━━━━━━━━━
id                          →     epic_id
title                       →     epic_title
stories                     →     user_stories
  id                        →       story_id
  title                     →       story_title
  storyPoints               →       story_points
```

### Assignment Flattening

Backend returns nested assignments; frontend flattens for localStorage:

```
Backend response:                  Flattened for storage:
{                                  {
  epic: { epic_id, epic_title },     epic_id, epic_title,
  story: { story_id, ... },         story_id, story_title, story_points,
  developer: { username },           assigned_developer: username,
  score, confidence                  score, confidence
}                                  }
```

---

## Data Persistence

| Store | Key | Contents | Scope |
|-------|-----|----------|-------|
| `sessionStorage` | `focus-flow-auth` | `'true'` if logged in | Per tab, lost on close |
| `localStorage` | `focus-flow-projects` | Array of all projects (epics, stories, assignments, Jira keys) | Persistent |
| `localStorage` | `focus-flow-developers` | Developer roster (profiles, expertise, skills) shared across projects | Persistent |
| `localStorage` | `theme` | `'light'` or `'dark'` | Persistent |
| `localStorage` | `epic-workflow-state` | Standalone wizard state (WorkflowContext) | Persistent |

**SWR Cache** (in-memory, not persisted):
- Sprint lists (30s dedup)
- Sprint issues (30s refresh)
- Project issues (30s refresh)
- Burndown data (60s refresh)

---

## API Reference

### Epic Generation

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| POST | `/api/generate` | `{ description }` | `{ success, result: { epics }, raw_output }` |
| POST | `/api/regenerate` | `{ type, project_description, context }` | `{ success, type, data }` |
| POST | `/api/classify-epics` | `{ epics: [{ epic_title, epic_description }] }` | `{ success, classifications }` |

### Developer Analysis

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| POST | `/api/analyze-developers` | `{ developers: [{ username, owner?, repo? }] }` | `{ success, developers }` |

### Assignment

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| POST | `/api/auto-assign` | `{ epics, developers }` | `{ success, assignments, workloadDistribution, summary }` |
| POST | `/api/reassign` | `{ story_id, new_developer, developers }` | `{ success, story_id, assigned_developer, confidence: "manual" }` |

### Jira Data

| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/api/jira/test` | `{ ok, user: { name, email } }` |
| GET | `/api/jira/boards` | `[{ id, name, type }]` |
| GET | `/api/jira/sprints` | `[{ id, name, state, startDate, endDate }]` |
| GET | `/api/jira/sprint/:id` | `{ id, name, state, startDate, endDate, goal }` |
| GET | `/api/jira/sprint/:id/issues` | `[{ id, key, summary, status, assignee, storyPoints, ... }]` |
| GET | `/api/jira/sprint/:id/burndown` | `[{ day, date, ideal, actual }]` |
| GET | `/api/jira/project/:key/issues` | `[{ id, key, summary, status, ... }]` (excludes epics) |
| GET | `/api/jira/issue/:key` | `{ transitions: [{ id, name, to }] }` |
| PUT | `/api/jira/issue/:key` | `{ transitionId }` → executes Jira transition |

### Jira Sync

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| POST | `/api/ai/sync-jira` | `{ epics, assignments, dependencies, deadline, projectName, sprintCount, developerJiraMap }` | `{ results, sprintId, sprintCount, jiraProjectKey, jiraBoardId, warnings }` |

### Health Check

| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/api/health` | `{ status: 'running', service, version, timestamp }` |

---

## Technical Details & Configuration

### Jira Custom Field Discovery

The backend dynamically discovers custom field IDs at runtime instead of hardcoding them:

```
GET /rest/api/3/field → returns all fields on the Jira instance

Discovered fields:
  Story Points  → searches for "Story Points" or "Story Point Estimate" by name
  Epic Link     → searches for "Epic Link" or custom type "gh-epic-link"
  Epic Name     → searches for "Epic Name"

Fallback defaults (if discovery fails):
  Story Points  → customfield_10016
  Epic Link     → customfield_10014

Cache TTL: 10 minutes
```

This ensures compatibility across different Jira Cloud instances with varying custom field configurations.

### Error Handling

**Jira errors** are parsed by `parseJiraError()` which handles three Jira response formats:
- `{ errorMessages: ["..."] }` — array of error strings
- `{ errors: { field: "message" } }` — field-level errors
- `{ error_description: "..." }` — OAuth-style errors

**Sync warnings** are non-fatal issues collected in a `warnings[]` array:
- Unresolved Jira users
- Failed story assignments
- Sprint creation errors
- Board type mismatches
- Fuzzy user matches

Frontend displays warnings in an amber panel below the success message.

### Environment Variables

**Backend** (`epic-dev-assignment/backend/.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `FLASK_URL` | No | Flask service URL (default: `http://localhost:5000`) |
| `PORT` | No | Express port (default: `3003`) |
| `GITHUB_TOKEN` | No | GitHub PAT — increases rate limit from 60 to 5000 req/hr |
| `JIRA_DOMAIN` | For Jira | e.g., `mycompany.atlassian.net` |
| `JIRA_EMAIL` | For Jira | Atlassian account email |
| `JIRA_API_TOKEN` | For Jira | From https://id.atlassian.net/manage-profile/security/api-tokens |

**AI Generator** (`epic-generator/.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google AI Studio API key for Gemini 2.5 Flash |

### Key Timeouts & Limits

| Setting | Value | Location |
|---------|-------|----------|
| Vite proxy timeout | 120 seconds | `frontend/vite.config.js` |
| Flask proxy timeout | 120 seconds | `backend/services/flaskProxy.js` |
| SWR issue refresh | 30 seconds | `frontend/src/hooks/useSprintData.js` |
| SWR burndown refresh | 60 seconds | `frontend/src/hooks/useSprintData.js` |
| Field discovery cache | 10 minutes | `backend/services/jiraService.js` |
| Max sprint count | 10 | `backend/routes/sync.js` |
| Max developers per analysis | 10 | `frontend/src/components/steps/Step3_DeveloperAnalysis.jsx` |
| Workload capacity cap | 100 SP | `backend/services/assignmentService.js` |
| Jira issue query limit | 200 | `backend/services/jiraService.js` |
| Sprint pagination page size | 50 | `backend/services/jiraService.js` |
| Project key max length | 10 chars | `backend/services/jiraService.js` |
| Project key conflict retries | 5 | `backend/routes/sync.js` |
| JSON body size limit | 50 MB | `backend/server.js` |

### Frontend Routing

| Path | Component | Auth | Layout |
|------|-----------|------|--------|
| `/login` | Login | No | None |
| `/` | → `/projects` redirect | — | — |
| `/wizard` | WorkflowApp (standalone) | Yes | Header only |
| `/projects` | ProjectsPage | Yes | Sidebar |
| `/projects/new` | ProjectWizardPage | Yes | Sidebar |
| `/projects/:id` | ProjectDetailPage | Yes | Sidebar |
| `/projects/:id/verify` | VerifyPage | Yes | Sidebar |
| `/projects/:id/assign` | AssignPage | Yes | Sidebar |
| `/projects/:id/kanban` | ProjectKanbanPage | Yes | Sidebar |
| `/developers` | DevelopersPage | Yes | Sidebar |
| `/dashboard` | Dashboard | Yes | Sidebar |
| `/kanban` | Kanban | Yes | Sidebar |
| `/reports` | Reports | Yes | Sidebar |
| `/settings` | Settings | Yes | Sidebar |

### Styling & Theming

- **Tailwind CSS 3** with utility classes exclusively (no CSS modules)
- **Light theme default** — `useTheme` hook defaults to `'light'`
- Theme toggle in Header (sun/moon icon) persists to `localStorage('theme')`
- CSS custom properties: `:root` (light) and `.dark` (dark) define color tokens
- Semantic utilities: `text-heading`, `text-muted`, `bg-card-theme`, `border-default`
- Icons: `lucide-react`
- Animations: `framer-motion`
- PostCSS: no nesting plugin (all CSS selectors must be flat)
