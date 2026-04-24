
import json
import os
from datetime import datetime
from typing import Dict


class TrainingDataCollector:
    """Collects and saves training examples for T5 model fine-tuning"""

    def __init__(self, data_dir: str = "d:/epic model/training_data"):
        """
        Initialize data collector

        Args:
            data_dir: Directory to store training data
        """
        self.data_dir = data_dir
        self.examples_file = os.path.join(data_dir, "gemini_training_examples.jsonl")
        self.stats_file = os.path.join(data_dir, "collection_stats.json")

        # Create directory if it doesn't exist
        os.makedirs(data_dir, exist_ok=True)

        # Initialize stats if file doesn't exist
        if not os.path.exists(self.stats_file):
            self._save_stats({
                "total_examples": 0,
                "last_updated": None,
                "started_collection": datetime.now().isoformat()
            })

    def save_training_example(
        self,
        project_description: str,
        generated_output: str,
        generator_used: str = "Gemini API"
    ) -> bool:
        """
        Save a training example (input + output pair)

        Args:
            project_description: Input project description
            generated_output: Generated documentation from Gemini
            generator_used: Which generator produced this output

        Returns:
            True if saved successfully
        """
        try:
            # Create training example
            example = {
                "timestamp": datetime.now().isoformat(),
                "input": project_description,
                "output": generated_output,
                "generator": generator_used,
                "metadata": {
                    "input_length": len(project_description),
                    "output_length": len(generated_output)
                }
            }

            # Append to JSONL file
            with open(self.examples_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(example) + '\n')

            # Update stats
            stats = self._load_stats()
            stats["total_examples"] += 1
            stats["last_updated"] = datetime.now().isoformat()
            self._save_stats(stats)

            print(f"[DATA COLLECTOR] Saved training example #{stats['total_examples']}")
            return True

        except Exception as e:
            print(f"[DATA COLLECTOR ERROR] Failed to save training example: {e}")
            return False

    def get_stats(self) -> Dict:
        """Get collection statistics"""
        return self._load_stats()

    def _load_stats(self) -> Dict:
        """Load statistics from file"""
        try:
            with open(self.stats_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {
                "total_examples": 0,
                "last_updated": None,
                "started_collection": datetime.now().isoformat()
            }

    def _save_stats(self, stats: Dict):
        """Save statistics to file"""
        with open(self.stats_file, 'w', encoding='utf-8') as f:
            json.dump(stats, f, indent=2)

    def load_training_examples(self, limit: int = None) -> list:
        """
        Load training examples from file

        Args:
            limit: Maximum number of examples to load (None = all)

        Returns:
            List of training examples
        """
        examples = []

        if not os.path.exists(self.examples_file):
            return examples

        with open(self.examples_file, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if limit and i >= limit:
                    break
                try:
                    examples.append(json.loads(line))
                except:
                    continue

        return examples

    def prepare_for_training(self, output_dir: str = "d:/epic model/training_data/processed"):
        """
        Prepare collected data for T5 training
        Creates source.txt and target.txt files

        Args:
            output_dir: Directory to save processed training files
        """
        os.makedirs(output_dir, exist_ok=True)

        examples = self.load_training_examples()

        source_file = os.path.join(output_dir, "source.txt")
        target_file = os.path.join(output_dir, "target.txt")

        with open(source_file, 'w', encoding='utf-8') as src, \
             open(target_file, 'w', encoding='utf-8') as tgt:

            for example in examples:
                # Write input (project description)
                src.write(example['input'].strip() + '\n')

                # Write output (generated documentation)
                tgt.write(example['output'].strip() + '\n')

        print(f"[DATA COLLECTOR] Prepared {len(examples)} examples for training")
        print(f"  Source file: {source_file}")
        print(f"  Target file: {target_file}")

        return source_file, target_file


if __name__ == "__main__":
    # Test the data collector
    collector = TrainingDataCollector()

    # Example usage
    test_description = "Build a fitness tracking app with workout logging and progress charts"
    test_output = "Epic E1: User Authentication\nDescription: As a user, I want to authenticate...\n\nUser Story E1-US1: User Registration..."

    collector.save_training_example(test_description, test_output, "Test")

    stats = collector.get_stats()
    print(f"\nCollection Stats:")
    print(f"  Total Examples: {stats['total_examples']}")
    print(f"  Last Updated: {stats['last_updated']}")
    print(f"  Started: {stats['started_collection']}")
