"""
Data Preprocessing Pipeline for Epic/Story Generation Model
Converts CSV project data into training format for T5 model
"""

import pandas as pd
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple
import random

class ProjectDataPreprocessor:
    """
    NLP preprocessing pipeline to convert raw CSV data into structured training examples
    """

    def __init__(self, csv_dir: str = "d:/epic model/csv"):
        self.csv_dir = Path(csv_dir)
        self.data = []

    def load_all_csvs(self) -> pd.DataFrame:
        """Load and combine all CSV files"""
        print("Loading CSV files...")
        csv_files = list(self.csv_dir.glob("*.csv"))

        all_dfs = []
        for csv_file in csv_files:
            try:
                df = pd.read_csv(csv_file)
                all_dfs.append(df)
            except Exception as e:
                print(f"Error loading {csv_file.name}: {e}")

        combined_df = pd.concat(all_dfs, ignore_index=True)
        print(f"Loaded {len(combined_df)} total issues from {len(csv_files)} files")

        return combined_df

    def clean_text(self, text: str) -> str:
        """Clean and normalize text (NLP preprocessing)"""
        if pd.isna(text):
            return ""

        # Convert to string
        text = str(text)

        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)

        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)

        # Remove special characters but keep basic punctuation
        text = re.sub(r'[^\w\s\.,!?\-:\[\]()#@]', '', text)

        return text.strip()

    def extract_tasks_from_description(self, description: str) -> List[str]:
        """Extract task list from description using NLP patterns"""
        if pd.isna(description):
            return []

        tasks = []

        # Pattern 1: Checkbox items [x] or [ ]
        checkbox_pattern = r'\[.\]\s*(.+?)(?:\n|$)'
        checkboxes = re.findall(checkbox_pattern, description)
        tasks.extend([self.clean_text(task) for task in checkboxes if task.strip()])

        # Pattern 2: Numbered lists
        numbered_pattern = r'\d+\.\s*(.+?)(?:\n|$)'
        numbered = re.findall(numbered_pattern, description)
        tasks.extend([self.clean_text(task) for task in numbered if task.strip()])

        # Pattern 3: Bullet points
        bullet_pattern = r'[-*]\s*(.+?)(?:\n|$)'
        bullets = re.findall(bullet_pattern, description)
        tasks.extend([self.clean_text(task) for task in bullets if task.strip()])

        # Remove duplicates while preserving order
        seen = set()
        unique_tasks = []
        for task in tasks:
            if task not in seen and len(task) > 10:  # Filter very short tasks
                seen.add(task)
                unique_tasks.append(task)

        return unique_tasks[:10]  # Limit to top 10 tasks

    def extract_acceptance_criteria(self, description: str) -> List[str]:
        """Extract acceptance criteria using NLP pattern matching"""
        if pd.isna(description):
            return []

        criteria = []

        # Look for acceptance criteria section
        ac_pattern = r'(?:Acceptance Criteria|Acceptance|AC):\s*(.+?)(?:\n\n|\Z)'
        ac_match = re.search(ac_pattern, description, re.IGNORECASE | re.DOTALL)

        if ac_match:
            ac_text = ac_match.group(1)
            # Extract individual criteria
            items = re.findall(r'[-*\d.]\s*(.+?)(?:\n|$)', ac_text)
            criteria = [self.clean_text(item) for item in items if item.strip()]

        # If no explicit AC section, look for "should" statements
        if not criteria:
            should_pattern = r'(?:user|system|application)\s+should\s+(.+?)(?:\.|$)'
            should_items = re.findall(should_pattern, description, re.IGNORECASE)
            criteria = [self.clean_text(item) for item in should_items if item.strip()]

        return criteria[:5]  # Limit to top 5 criteria

    def categorize_epic(self, title: str, description: str, story_points: float) -> str:
        """Categorize issue into epic using NLP keyword extraction"""
        text = f"{title} {description}".lower()

        # Define epic categories based on keywords
        epic_keywords = {
            "User Interface": ["ui", "frontend", "design", "layout", "css", "html", "button", "form"],
            "Backend API": ["api", "endpoint", "backend", "server", "database", "query"],
            "Authentication": ["auth", "login", "signup", "password", "security", "token"],
            "Testing": ["test", "testing", "qa", "quality", "bug", "fix"],
            "DevOps": ["deploy", "ci/cd", "pipeline", "docker", "kubernetes"],
            "Database": ["database", "sql", "migration", "schema", "data model"],
            "Documentation": ["docs", "documentation", "readme", "guide"],
            "Performance": ["performance", "optimize", "speed", "cache", "lazy"],
            "Mobile": ["mobile", "android", "ios", "app"],
            "Integration": ["integration", "third-party", "webhook", "external"]
        }

        # Score each category
        scores = {}
        for category, keywords in epic_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text)
            if score > 0:
                scores[category] = score

        # Return top category or default
        if scores:
            return max(scores, key=scores.get)

        # Fallback based on story points
        if story_points >= 10:
            return "Major Feature"
        elif story_points >= 5:
            return "Feature Enhancement"
        else:
            return "Bug Fix / Small Task"

    def generate_user_story(self, title: str, description: str) -> str:
        """Generate user story format from title and description"""
        # If title already in user story format, return it
        if "as a" in title.lower():
            return title

        # Extract action verbs and context using NLP
        # Simple heuristic: convert title to user story format
        title_clean = self.clean_text(title)

        # Try to identify user role from description
        user_pattern = r'(?:as a|as an)\s+(\w+)'
        user_match = re.search(user_pattern, description, re.IGNORECASE)
        user_role = user_match.group(1) if user_match else "user"

        # Generate user story
        return f"As a {user_role}, I want to {title_clean.lower()}"

    def create_training_example(self, row: pd.Series) -> Dict:
        """Create a single training example with NLP feature extraction"""
        description = str(row['description']) if pd.notna(row['description']) else ""
        title = str(row['title']) if pd.notna(row['title']) else ""
        story_points = float(row['storypoints']) if pd.notna(row['storypoints']) else 1

        # Extract features using NLP
        tasks = self.extract_tasks_from_description(description)
        acceptance_criteria = self.extract_acceptance_criteria(description)
        epic = self.categorize_epic(title, description, story_points)
        user_story = self.generate_user_story(title, description)

        # Clean inputs
        input_text = self.clean_text(description[:1000])  # Limit input length

        # Format output as structured text for T5
        output_parts = []
        output_parts.append(f"EPIC: {epic}")
        output_parts.append(f"USER_STORY: {user_story}")
        output_parts.append(f"STORY_POINTS: {int(story_points)}")

        if tasks:
            output_parts.append(f"TASKS: {' | '.join(tasks[:5])}")

        if acceptance_criteria:
            output_parts.append(f"ACCEPTANCE_CRITERIA: {' | '.join(acceptance_criteria[:3])}")

        output_text = "\n".join(output_parts)

        return {
            'input': input_text,
            'output': output_text,
            'metadata': {
                'original_title': title,
                'story_points': story_points,
                'has_tasks': len(tasks) > 0,
                'has_criteria': len(acceptance_criteria) > 0
            }
        }

    def prepare_dataset(self, output_file: str = "d:/epic model/data/training_data.json"):
        """Prepare complete training dataset"""
        print("\n" + "="*80)
        print("PREPARING TRAINING DATASET")
        print("="*80)

        # Load data
        df = self.load_all_csvs()

        # Filter out issues without descriptions or story points
        df_filtered = df[
            (df['description'].notna()) &
            (df['storypoints'].notna()) &
            (df['description'].str.len() > 50)  # Minimum description length
        ].copy()

        print(f"Filtered to {len(df_filtered)} issues with valid data")

        # Create training examples
        print("\nCreating training examples...")
        training_data = []

        for idx, row in df_filtered.iterrows():
            try:
                example = self.create_training_example(row)
                if example['input'] and example['output']:
                    training_data.append(example)
            except Exception as e:
                print(f"Error processing row {idx}: {e}")

        print(f"Created {len(training_data)} training examples")

        # Shuffle data
        random.shuffle(training_data)

        # Split into train/val/test
        n = len(training_data)
        train_size = int(0.8 * n)
        val_size = int(0.1 * n)

        train_data = training_data[:train_size]
        val_data = training_data[train_size:train_size + val_size]
        test_data = training_data[train_size + val_size:]

        print(f"\nDataset Split:")
        print(f"  Training: {len(train_data)}")
        print(f"  Validation: {len(val_data)}")
        print(f"  Test: {len(test_data)}")

        # Save datasets
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        datasets = {
            'train': train_data,
            'validation': val_data,
            'test': test_data
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(datasets, f, indent=2, ensure_ascii=False)

        print(f"\nDataset saved to: {output_path}")

        # Show sample
        print("\n" + "="*80)
        print("SAMPLE TRAINING EXAMPLE")
        print("="*80)
        sample = train_data[0]
        print(f"\nINPUT:\n{sample['input'][:300]}...\n")
        print(f"OUTPUT:\n{sample['output']}\n")
        print("="*80)

        return datasets

if __name__ == "__main__":
    preprocessor = ProjectDataPreprocessor()
    datasets = preprocessor.prepare_dataset()
