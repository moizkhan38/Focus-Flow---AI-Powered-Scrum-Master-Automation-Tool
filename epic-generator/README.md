# Epic/Story Generator - AI-Powered Project Documentation

An intelligent system that automatically generates comprehensive project documentation including Epics, User Stories, Acceptance Criteria, and Test Cases using AI.

## Features

- **Multi-Epic Generation**: Analyzes project descriptions and breaks them into 5 distinct major feature areas (Epics)
- **Comprehensive Documentation**: Each Epic contains detailed User Stories with Story Points, Acceptance Criteria, and Test Cases
- **Dual AI System**:
  - Primary: Google Gemini API (2.5 Flash) for high-quality, specific generation
  - Fallback: Fine-tuned T5 Model for offline capability
- **Continuous Learning**: Automatically collects Gemini outputs to retrain T5 model for improved performance
- **Web Interface**: Beautiful, responsive web UI for easy interaction
- **Hierarchical Display**: Visual organization showing Epic → User Stories → Test Cases relationship

## Setup

### Prerequisites

- Python 3.12+
- pip package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/abdulahadd002/epic-generator.git
cd epic-generator
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure Google Gemini API Key:
   - Copy `.env.example` to `.env`
   - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Add your key to `.env`:
   ```
   GEMINI_API_KEY=your-actual-api-key-here
   ```

4. Set environment variable (Windows):
```bash
set GEMINI_API_KEY=your-actual-api-key-here
```

Or (Linux/Mac):
```bash
export GEMINI_API_KEY=your-actual-api-key-here
```

### Running the Web Application

```bash
python web_app.py
```

Then open your browser at: `http://localhost:5000`

## Usage

1. Enter your project description in the text area
2. Click "Generate Comprehensive Documentation"
3. View the generated Epics, User Stories, and Test Cases
4. The system will generate 5 Epics, each with 2 User Stories and detailed Test Cases

## Example Input

```
Create a modern, responsive fitness tracking web application that helps users monitor
their daily health and exercise activities. The app should include user authentication,
dashboard with daily stats, workout logging, nutrition tracking, and progress analytics.
```

## Example Output Structure

- **Epic E1**: User Authentication and Profile Management
  - User Story E1-US1: User Registration
  - User Story E1-US2: User Login
- **Epic E2**: Dashboard and Daily Overview
  - User Story E2-US1: Daily Stats Display
  - User Story E2-US2: Quick Action Buttons
- **Epic E3**: Workout Logging and Tracking
- **Epic E4**: Nutrition Tracking System
- **Epic E5**: Progress Analytics and Reporting

Each User Story includes:
- Story Points (1-13)
- Acceptance Criteria (Given/When/Then format)
- Test Cases with Expected Results

## Technology Stack

- **Backend**: Flask (Python)
- **AI Models**:
  - Google Gemini API (2.5 Flash) - Primary
  - T5-Small (Fine-tuned on 5000+ examples) - Fallback
- **Continuous Learning**: Automatic data collection and model retraining
- **Frontend**: HTML/CSS/JavaScript
- **Training**: PyTorch, Transformers

## Model Information

- **Primary Model**: Google Gemini 2.5 Flash via Google AI API
- **Fallback Model**: T5-Small Comprehensive (60.5M parameters)
- **Training Data**: 5000+ project requirement examples + Continuous learning from Gemini outputs
- **Format**: Based on Autonomous Solar Vehicle project documentation

## Continuous Learning System

The system automatically collects every Gemini API output as training data for the T5 model:
- **Automatic Collection**: Each successful generation is saved
- **Data Storage**: `training_data/gemini_training_examples.jsonl`
- **Retraining**: Run `python retrain_t5.py` after collecting 10+ examples
- **Benefits**: T5 model continuously improves and learns from high-quality Gemini outputs

See [TRAINING_GUIDE.md](TRAINING_GUIDE.md) for detailed instructions on retraining the T5 model.

## Project Structure

```
epic-generator/
├── web_app.py                    # Flask web server
├── src/
│   ├── inference.py              # T5 model inference
│   ├── gemini_generator.py       # Gemini API integration
│   ├── data_collector.py         # Training data collection
│   ├── train_model.py            # Model training scripts
│   └── comprehensive_preprocessor.py
├── templates/
│   └── index.html                # Web UI
├── training_data/                # Collected Gemini outputs (auto-generated)
├── models/                       # Trained models (not in repo)
├── retrain_t5.py                 # T5 retraining utility
├── requirements.txt              # Python dependencies
├── TRAINING_GUIDE.md             # Guide for model retraining
└── README.md                     # This file
```

## API Endpoints

- `GET /` - Web interface
- `POST /api/generate` - Generate documentation
  - Request: `{"description": "project description"}`
  - Response: Structured JSON with epics, stories, test cases
- `GET /api/health` - Health check and model status
- `GET /api/examples` - Get example project descriptions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License

## Authors

- Sardar Shahzeb Khan (BSE221059)
- Saqib Nawaz Khan (BSE223175)
- Shehriyar Ali Rustam (BSE223190)

Supervised By: Syed Awais Haider
Department of Software Engineering
Capital University of Science & Technology, Islamabad

## Acknowledgments

- Based on research in automated software requirement generation
- Inspired by the Autonomous Solar Vehicle project documentation format
- Powered by Anthropic Claude API and Hugging Face Transformers
