"""
Comprehensive Data Preprocessor for T5 Model
Generates training data in the detailed format
"""

import pandas as pd
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple
import random


class ComprehensivePreprocessor:
    """
    Creates comprehensive training examples with:
    - Epics with stakeholder perspectives
    - User Stories with Given/When/Then acceptance criteria
    - Test Cases with detailed expected results
    """

    def __init__(self):
        # Epic categories with stakeholder roles
        self.epic_categories = {
            "Backend API": {
                "role": "system administrator",
                "benefit": "ensure reliable and scalable backend operations"
            },
            "Frontend UI": {
                "role": "product manager",
                "benefit": "provide an intuitive user experience"
            },
            "Authentication": {
                "role": "security officer",
                "benefit": "protect user data and ensure secure access"
            },
            "Data Management": {
                "role": "data analyst",
                "benefit": "maintain data integrity and accessibility"
            },
            "Integration": {
                "role": "integration architect",
                "benefit": "enable seamless communication between systems"
            },
            "Mobile": {
                "role": "mobile product owner",
                "benefit": "deliver a responsive mobile experience"
            },
            "Performance": {
                "role": "performance engineer",
                "benefit": "ensure optimal system performance"
            },
            "Testing": {
                "role": "QA manager",
                "benefit": "maintain high quality standards"
            }
        }

        # User roles for stories
        self.user_roles = [
            "user", "admin", "customer", "operator", "manager",
            "developer", "tester", "analyst", "visitor", "member"
        ]

        # Test preconditions templates
        self.test_preconditions = [
            "System initialized, all services running",
            "User authenticated, session active",
            "Database populated with test data",
            "All dependencies available",
            "Network connectivity established",
            "Required permissions granted"
        ]

    def process_csv_to_comprehensive_format(
        self,
        csv_dir: str,
        output_file: str,
        max_examples: int = 10000
    ) -> Dict:
        """
        Process CSV files and create comprehensive training examples

        Args:
            csv_dir: Directory containing CSV files
            output_file: Output JSON file path
            max_examples: Maximum number of examples to generate

        Returns:
            Statistics dictionary
        """
        csv_path = Path(csv_dir)
        csv_files = list(csv_path.glob("*.csv"))

        print(f"Found {len(csv_files)} CSV files")

        all_examples = []
        processed = 0

        for csv_file in csv_files:
            print(f"Processing: {csv_file.name}")

            try:
                df = pd.read_csv(csv_file)

                for _, row in df.iterrows():
                    if processed >= max_examples:
                        break

                    # Extract data
                    title = str(row.get('title', '')).strip()
                    description = str(row.get('description', '')).strip()
                    story_points = row.get('storypoints', 0)

                    if not title or len(title) < 5:
                        continue

                    # Generate comprehensive example
                    example = self._create_comprehensive_example(
                        title, description, story_points, processed + 1
                    )

                    if example:
                        all_examples.append(example)
                        processed += 1

                        if processed % 100 == 0:
                            print(f"  Generated {processed} examples...")

            except Exception as e:
                print(f"Error processing {csv_file.name}: {e}")
                continue

        # Save to JSON
        print(f"\nSaving {len(all_examples)} examples to {output_file}")

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_examples, f, indent=2, ensure_ascii=False)

        stats = {
            "total_examples": len(all_examples),
            "csv_files_processed": len(csv_files),
            "output_file": output_file
        }

        return stats

    def _create_comprehensive_example(
        self,
        title: str,
        description: str,
        story_points: float,
        example_id: int
    ) -> Dict:
        """
        Create a single comprehensive training example

        Returns:
            Dictionary with input and output
        """
        # Clean text
        title_clean = self._clean_text(title)
        desc_clean = self._clean_text(description)

        # Categorize into epic
        epic_category = self._categorize_epic(title_clean, desc_clean)
        epic_info = self.epic_categories.get(epic_category, self.epic_categories["Backend API"])

        # Extract or generate components
        user_role = self._extract_user_role(desc_clean)
        epic_num = (example_id % 4) + 1  # E1-E4
        story_num = (example_id % 3) + 1  # US1-US3
        tc_num = 1

        # Create epic
        epic_title = self._generate_epic_title(title_clean)
        epic_desc = f"As a {epic_info['role']}, I want {self._extract_capability(title_clean)} so that {epic_info['benefit']}"

        # Create user story
        story_title = self._generate_story_title(title_clean)
        story_desc = f"As a {user_role}, I want to {title_clean.lower()} so that {self._generate_benefit(title_clean)}"

        # Create acceptance criteria
        acceptance_criteria = self._generate_acceptance_criteria(title_clean, desc_clean)

        # Create test case
        test_case = self._generate_test_case(
            f"E{epic_num}-US{story_num}-TC{tc_num}",
            title_clean,
            desc_clean,
            story_points
        )

        # Format output
        output = f"""Epic E{epic_num}: {epic_title}
Description: {epic_desc}

User Story E{epic_num}-US{story_num}: {story_title}
Description: {story_desc}
Story Points: {int(story_points) if story_points > 0 else random.randint(2, 8)}
Acceptance Criteria: {acceptance_criteria}

{test_case}"""

        return {
            "input": f"{title}. {description}",
            "output": output
        }

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        text = re.sub(r'<[^>]+>', '', text)  # Remove HTML
        text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
        text = re.sub(r'[^\w\s\-.,;:!?()\[\]]', '', text)  # Remove special chars
        return text.strip()

    def _categorize_epic(self, title: str, description: str) -> str:
        """Categorize into epic category"""
        text = f"{title} {description}".lower()

        keywords = {
            "Backend API": ["api", "endpoint", "backend", "server", "service", "database"],
            "Frontend UI": ["ui", "frontend", "interface", "screen", "page", "view"],
            "Authentication": ["auth", "login", "signup", "password", "security", "token"],
            "Data Management": ["data", "export", "import", "report", "analytics"],
            "Integration": ["integrate", "sync", "webhook", "notification", "email"],
            "Mobile": ["mobile", "app", "ios", "android", "responsive"],
            "Performance": ["performance", "optimize", "speed", "cache", "load"],
            "Testing": ["test", "validation", "verify", "check"]
        }

        for category, kw_list in keywords.items():
            if any(kw in text for kw in kw_list):
                return category

        return "Backend API"

    def _extract_user_role(self, text: str) -> str:
        """Extract or assign user role"""
        text_lower = text.lower()

        for role in self.user_roles:
            if role in text_lower:
                return role

        return random.choice(self.user_roles[:5])  # Default roles

    def _generate_epic_title(self, title: str) -> str:
        """Generate epic title"""
        # Capitalize and clean
        words = title.split()[:5]  # First 5 words
        return ' '.join(words).title()

    def _extract_capability(self, title: str) -> str:
        """Extract capability from title"""
        return title.lower()

    def _generate_story_title(self, title: str) -> str:
        """Generate user story title"""
        return title.title()

    def _generate_benefit(self, title: str) -> str:
        """Generate user benefit"""
        benefits = [
            "I can accomplish my goals efficiently",
            "I can save time and effort",
            "I can complete my tasks successfully",
            "I can achieve better results",
            "I can work more productively"
        ]
        return random.choice(benefits)

    def _generate_acceptance_criteria(self, title: str, description: str) -> str:
        """Generate Given/When/Then acceptance criteria"""
        # Extract action
        action_words = ["click", "enter", "select", "submit", "upload", "download"]
        action = "perform the action"

        for word in action_words:
            if word in description.lower():
                action = word
                break

        given = random.choice([
            "the user is logged in and on the main page",
            "the system is in ready state",
            "all prerequisites are met",
            "the user has necessary permissions"
        ])

        when = f"the user {action}s the required input"

        then = random.choice([
            "the system should process the request successfully",
            "the expected output should be displayed",
            "the operation should complete within 3 seconds",
            "the user should see a confirmation message"
        ])

        return f"Given {given}, When {when}, Then {then}"

    def _generate_test_case(
        self,
        test_id: str,
        title: str,
        description: str,
        story_points: float
    ) -> str:
        """Generate comprehensive test case"""

        test_desc = f"Verify that {title.lower()} functions correctly"

        # Generate preconditions
        preconditions = random.sample(self.test_preconditions, 2)

        # Generate expected results (6 detailed outcomes)
        expected_results = [
            f"1. System accepts input and validates format within 500ms",
            f"2. Processing completes successfully with no errors",
            f"3. Expected output displayed with correct data",
            f"4. Success notification shown to user",
            f"5. System state updated correctly in database",
            f"6. Operation logged with timestamp and user details"
        ]

        test_case = f"""Test Case ID: {test_id}
Test Case Description: {test_desc}
Input:
  - Preconditions: {', '.join(preconditions)}
  - Test Data: Valid input matching requirements
  - User Action: Execute primary function
Expected Result:
{chr(10).join(expected_results)}"""

        return test_case


def main():
    """Generate comprehensive training data"""
    preprocessor = ComprehensivePreprocessor()

    print("="*80)
    print("COMPREHENSIVE TRAINING DATA GENERATOR")
    print("Generating data in format matching Autonomous Solar Vehicle PDF")
    print("="*80)

    csv_dir = "d:/epic model/csv"
    output_file = "d:/epic model/data/comprehensive_training_data.json"

    # Create comprehensive dataset
    stats = preprocessor.process_csv_to_comprehensive_format(
        csv_dir=csv_dir,
        output_file=output_file,
        max_examples=5000  # Generate 5000 comprehensive examples
    )

    print("\n" + "="*80)
    print("GENERATION COMPLETE")
    print("="*80)
    print(f"Total examples generated: {stats['total_examples']}")
    print(f"Output file: {stats['output_file']}")
    print("\nNext step: Train T5 model with this comprehensive data")
    print("Run: py -3.12 src/train_comprehensive_model.py")


if __name__ == "__main__":
    main()
