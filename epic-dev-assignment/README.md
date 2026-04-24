# Epic & Developer Assignment System

A comprehensive AI-powered web application that generates project epics, analyzes developer expertise from GitHub commits, and intelligently assigns work based on skill matching and workload balancing.

## Overview

This system combines two powerful applications into a unified workflow:
- **Epic Generator** - AI-powered epic, user story, and test case generation using Google Gemini 2.5 Flash
- **GitHub Commit Analyzer** - Developer expertise detection and experience level calculation from commit history
- **Smart Assignment** - Multi-factor scoring algorithm that matches epics to developers based on expertise, experience, and workload

## Features

### ✨ Epic Generation
- Generate 5 comprehensive epics from natural language project descriptions
- Each epic includes user stories, acceptance criteria, and test cases
- Powered by Google Gemini 2.5 Flash API

### ✅ Granular Approval Workflow
- Approve/reject at multiple levels: Epic → Story → Acceptance Criteria → Test Cases
- Visual indicators for approval status
- Collapsible epic cards for easy navigation

### 👥 Developer Analysis
- Analyze GitHub commit history to detect expertise in 7 areas:
  - Mobile Development, Frontend, Backend, DevOps, Data Science, Database, Game Development, Full Stack
- Calculate experience levels: Senior, Mid-Level, Junior, Beginner
- Multi-developer support (up to 10 developers)
- Detailed metrics: commits, work patterns, code quality, consistency

### 🎯 Intelligent Assignment
- Hybrid epic classification (rule-based + AI)
- Multi-factor scoring algorithm (100 points):
  - Expertise Match (50 pts)
  - Experience Level (30 pts)
  - Workload Balance (20 pts)
- Confidence indicators (high/medium/low)
- Manual reassignment capability
- Alternative developer suggestions
- Workload visualization

### 📊 Export & Reporting
- CSV export of assignments
- Workload distribution charts
- Assignment confidence metrics

## Architecture

```
┌─────────────────────────────────────────┐
│   Frontend (React + Vite + Tailwind)    │
│           Port 5173                      │
└──────────────┬──────────────────────────┘
               │ HTTP/REST API
               ▼
┌─────────────────────────────────────────┐
│   Node.js Express Gateway (Port 3003)   │
│   - Epic classification                 │
│   - Developer analysis                  │
│   - Assignment algorithm                │
└──────────────┬──────────────────────────┘
               │               │
               ▼               ▼
┌──────────────────┐  ┌──────────────┐
│ Flask Service    │  │  GitHub API  │
│ (Port 5000)      │  │              │
│ - Epic generation│  │              │
└──────────────────┘  └──────────────┘
```

## Prerequisites

- **Node.js** 18+ (for frontend and backend)
- **Python** 3.12+ (for Flask epic-generator service)
- **npm** or **yarn**
- **Google Gemini API Key** ([Get one here](https://makersuite.google.com/app/apikey))
- **GitHub Token** (optional, increases API rate limit)

## Installation

### 1. Clone the Repository

```bash
cd d:/integration
# The epic-dev-assignment directory should already exist
```

### 2. Setup Flask Epic Generator Service

```bash
cd epic-generator

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements_webapp.txt

# Configure environment
copy .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 3. Setup Node.js Backend

```bash
cd ../epic-dev-assignment/backend

# Install dependencies
npm install

# Configure environment
copy .env.example .env
# Edit .env if needed (optional: GITHUB_TOKEN)
```

### 4. Setup React Frontend

```bash
cd ../frontend

# Install dependencies
npm install
```

## Configuration

### Flask Service (epic-generator/.env)

```bash
GEMINI_API_KEY=your-gemini-api-key-here
```

### Node.js Backend (backend/.env)

```bash
FLASK_URL=http://localhost:5000
PORT=3003
GITHUB_TOKEN=your-github-token  # Optional but recommended
```

## Running the Application

### Development Mode

You need **3 terminal windows**:

**Terminal 1: Flask Service**
```bash
cd epic-generator
venv\Scripts\activate
python web_app.py
# Server running on http://localhost:5000
```

**Terminal 2: Node.js Backend**
```bash
cd epic-dev-assignment/backend
npm start
# Server running on http://localhost:3003
```

**Terminal 3: React Frontend**
```bash
cd epic-dev-assignment/frontend
npm run dev
# App running on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

## Usage Guide

### Step 1: Generate Epics

1. Enter a project description (or select an example)
2. Click "Generate Epics"
3. Wait 10-20 seconds for AI generation
4. 5 epics with user stories, ACs, and test cases will appear

### Step 2: Review & Approve

1. Expand epics to view details
2. Approve at granular levels:
   - **Approve Epic** - Approves entire epic with all children
   - **Approve Story** - Approves story with its AC and test cases
   - **Approve AC** - Approves acceptance criteria only
   - **Approve Test Case** - Approves individual test case
3. Remove unwanted epics using "Remove Epic" button
4. Click "Proceed to Developer Analysis" when done

### Step 3: Analyze Developers

1. Enter GitHub usernames (required)
2. Optionally specify owner/repo (if blank, analyzes top repos)
3. Add multiple developers (up to 10)
4. Click "Analyze Developers"
5. Wait for commit analysis to complete
6. Review developer expertise and experience levels
7. Click "Proceed to Assignment"

### Step 4: Auto-Assign & Export

1. Click "Auto-Assign Epics"
2. Review assignments with confidence scores
3. Manually reassign if needed using dropdown
4. View workload distribution chart
5. Export to CSV for external use

## API Documentation

### Backend API (Port 3003)

#### POST /api/generate
Generate epics from project description (proxies to Flask).

**Request:**
```json
{
  "description": "Build a fitness tracking app..."
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "epics": [...]
  },
  "generator_used": "Gemini API"
}
```

#### POST /api/classify-epics
Classify epic types using hybrid algorithm.

**Request:**
```json
{
  "epics": [
    {
      "epic_id": "E1",
      "epic_title": "...",
      "epic_description": "..."
    }
  ]
}
```

#### POST /api/analyze-developers
Analyze GitHub commits for developers.

**Request:**
```json
{
  "developers": [
    { "username": "john-doe", "owner": "company", "repo": "project" }
  ]
}
```

#### POST /api/auto-assign
Auto-assign epics to developers.

**Request:**
```json
{
  "epics": [...],
  "developers": [...]
}
```

## Technology Stack

### Frontend
- React 19.2
- Vite 7.2.5
- Tailwind CSS 3.4.19
- Lucide React (icons)
- Recharts (charts)
- Framer Motion (animations)

### Backend
- Node.js with Express 5.1.0
- CORS support
- Node Fetch 3.3.2

### Epic Generator Service
- Flask 3.0.0
- Google Generative AI (Gemini 2.5 Flash)
- Python 3.12+

### Developer Analysis
- GitHub REST API v3
- Custom expertise detection algorithm
- Multi-factor experience calculation

## Project Structure

```
epic-dev-assignment/
├── frontend/                    # React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── steps/          # 4-step wizard components
│   │   │   ├── shared/         # Reusable components
│   │   │   └── layout/         # Header, footer
│   │   ├── context/            # React Context (state management)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── utils/              # Utilities (expertise, experience)
│   │   ├── App.jsx             # Main app component
│   │   └── main.jsx            # Entry point
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/                     # Node.js Express API
│   ├── routes/                 # API route handlers
│   ├── services/               # Business logic
│   │   ├── flaskProxy.js      # Flask service proxy
│   │   ├── githubService.js   # GitHub API integration
│   │   ├── epicClassifier.js  # Epic classification
│   │   └── assignmentService.js # Assignment algorithm
│   ├── utils/                  # Utilities
│   ├── server.js               # Express server
│   └── package.json
│
└── README.md                    # This file
```

## Key Algorithms

### Epic Classification

**Hybrid Approach:**
1. **Rule-based**: Keyword matching against 7 epic types
2. **AI-based**: Gemini API for ambiguous cases
3. **Default**: "Full Stack" if no matches

### Assignment Algorithm

**Multi-Factor Scoring (100 points):**

```javascript
Score = Expertise Match (50) + Experience Level (30) + Workload Balance (20)

Expertise Match:
- Direct match: Up to 50 points based on developer's expertise score
- Full Stack: 25 points bonus

Experience Level:
- Senior: 30 points
- Mid-Level: 20 points
- Junior: 10 points
- Beginner: 5 points

Workload Balance:
- Favors developers with lower current workload
- Up to 20 points
```

**Confidence Levels:**
- High: Score ≥ 70
- Medium: Score ≥ 50
- Low: Score < 50

## Troubleshooting

### Port Already in Use
If ports 5000, 3003, or 5173 are in use:
- Change ports in `.env` files
- Update `vite.config.js` proxy settings
- Restart all services

### Flask Service Not Starting
- Ensure Python 3.12+ is installed
- Activate virtual environment
- Install dependencies: `pip install -r requirements_webapp.txt`
- Check GEMINI_API_KEY in `.env`

### GitHub Rate Limiting
- Add GITHUB_TOKEN to backend/.env
- Unauthenticated: 60 requests/hour
- Authenticated: 5000 requests/hour

### Epic Generation Fails
- Verify GEMINI_API_KEY is valid
- Check Flask service is running on port 5000
- Check backend can reach Flask (FLASK_URL in .env)

## Future Enhancements

- [ ] PostgreSQL database for persistence
- [ ] User authentication (OAuth)
- [ ] Jira bidirectional sync
- [ ] Real-time collaboration (Socket.io)
- [ ] PDF export with charts
- [ ] Machine learning model for assignment (train on historical data)
- [ ] Advanced analytics dashboard
- [ ] Email notifications for assignments

## License

This project integrates code from:
- [epic-generator](https://github.com/abdulahadd002/epic-generator)
- [github-commit-analyzer](https://github.com/abdulahadd002/github-commit-analyzer)

## Support

For issues, questions, or contributions:
- Review the plan file: `C:\Users\USER\.claude\plans\sparkling-inventing-treasure.md`
- Check the architecture documentation above
- Verify all services are running on correct ports

---

**Built with ❤️ using React, Node.js, Flask, and Google Gemini AI**
