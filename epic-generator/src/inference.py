"""
T5 Model Inference Script for Epic/Story Generation
Loads the trained model and generates structured output from project descriptions
"""

import torch
from transformers import T5Tokenizer, T5ForConditionalGeneration
import json
from pathlib import Path


class EpicStoryGenerator:
    """
    Inference pipeline for generating epics, user stories, story points, tasks, and acceptance criteria
    """

    def __init__(self, model_path="d:/epic model/models/epic-story-model/final"):
        """
        Load the trained T5 model and tokenizer

        Args:
            model_path: Path to the saved model directory
        """
        print("="*80)
        print("LOADING EPIC/STORY GENERATION MODEL")
        print("="*80)

        # Check if model exists
        if not Path(model_path).exists():
            raise FileNotFoundError(
                f"Model not found at {model_path}\n"
                "Please train the model first using train_model.py"
            )

        # Check GPU availability
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")
        if torch.cuda.is_available():
            print(f"GPU: {torch.cuda.get_device_name(0)}")

        # Load tokenizer and model
        print(f"\nLoading model from: {model_path}")
        self.tokenizer = T5Tokenizer.from_pretrained(model_path)
        self.model = T5ForConditionalGeneration.from_pretrained(model_path)
        self.model.to(self.device)
        self.model.eval()  # Set to evaluation mode

        print(f"Model loaded successfully!")
        print(f"Model parameters: {sum(p.numel() for p in self.model.parameters()) / 1e6:.1f}M")
        print("="*80)

    def generate(
        self,
        project_description: str,
        max_length: int = 256,
        num_beams: int = 4
    ) -> str:
        """
        Generate structured output from a project description

        Args:
            project_description: Input project description
            max_length: Maximum length of generated output
            num_beams: Number of beams for beam search (higher = better quality, slower)

        Returns:
            Structured output string with epic, user story, story points, tasks, and acceptance criteria
        """
        # Prepare input with T5 prefix
        input_text = f"generate project details: {project_description}"

        # Tokenize
        inputs = self.tokenizer(
            input_text,
            max_length=512,
            truncation=True,
            return_tensors="pt"
        )
        inputs = inputs.to(self.device)

        # Generate with beam search (deterministic)
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_length=max_length,
                num_beams=num_beams,
                do_sample=False,
                early_stopping=True
            )

        # Decode
        generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        return generated_text

    def parse_output(self, generated_text: str) -> dict:
        """
        Parse the generated text into structured components
        Handles both newline-separated and space-separated formats

        Args:
            generated_text: Raw generated text from model

        Returns:
            Dictionary with parsed components
        """
        import re

        result = {
            "epic": "",
            "user_story": "",
            "story_points": "",
            "tasks": [],
            "acceptance_criteria": []
        }

        # Extract EPIC
        epic_match = re.search(r'EPIC:\s*([^U]*?)(?=USER_STORY:|$)', generated_text)
        if epic_match:
            result["epic"] = epic_match.group(1).strip()

        # Extract USER_STORY
        story_match = re.search(r'USER_STORY:\s*([^S]*?)(?=STORY_POINTS:|$)', generated_text)
        if story_match:
            result["user_story"] = story_match.group(1).strip()

        # Extract STORY_POINTS
        points_match = re.search(r'STORY_POINTS:\s*(\d+)', generated_text)
        if points_match:
            result["story_points"] = points_match.group(1).strip()

        # Extract TASKS
        tasks_match = re.search(r'TASKS:\s*([^A]*?)(?=ACCEPTANCE_CRITERIA:|$)', generated_text)
        if tasks_match:
            tasks_str = tasks_match.group(1).strip()
            result["tasks"] = [t.strip() for t in tasks_str.split('|') if t.strip()]

        # Extract ACCEPTANCE_CRITERIA
        criteria_match = re.search(r'ACCEPTANCE_CRITERIA:\s*(.+?)$', generated_text, re.DOTALL)
        if criteria_match:
            criteria_str = criteria_match.group(1).strip()
            result["acceptance_criteria"] = [c.strip() for c in criteria_str.split('|') if c.strip()]

        return result

    def generate_and_parse(self, project_description: str, **kwargs) -> dict:
        """
        Generate and parse output in one step

        Args:
            project_description: Input project description
            **kwargs: Additional generation parameters

        Returns:
            Parsed dictionary with structured components
        """
        generated_text = self.generate(project_description, **kwargs)
        return self.parse_output(generated_text)

    def print_formatted_output(self, result: dict):
        """
        Print the parsed result in a nice formatted way

        Args:
            result: Parsed dictionary from parse_output()
        """
        print("\n" + "="*80)
        print("GENERATED PROJECT STRUCTURE")
        print("="*80)

        print(f"\nEPIC: {result['epic']}")
        print(f"\nUSER STORY:\n   {result['user_story']}")
        print(f"\nSTORY POINTS: {result['story_points']}")

        if result['tasks']:
            print(f"\nTASKS:")
            for i, task in enumerate(result['tasks'], 1):
                print(f"   {i}. {task}")

        if result['acceptance_criteria']:
            print(f"\nACCEPTANCE CRITERIA:")
            for i, criterion in enumerate(result['acceptance_criteria'], 1):
                print(f"   {i}. {criterion}")

        print("\n" + "="*80)


def main():
    """
    Example usage of the inference pipeline
    """
    # Initialize generator
    generator = EpicStoryGenerator()

    # Example project descriptions
    examples = [
        "Build a real-time chat application with user authentication and message history",
        "Create a mobile app for restaurant reservations with real-time availability",
        "Develop an e-commerce platform with product catalog, shopping cart, and checkout",
        "Build a task management system with teams, projects, and deadlines"
    ]

    print("\n" + "="*80)
    print("RUNNING EXAMPLE GENERATIONS")
    print("="*80)

    for i, description in enumerate(examples, 1):
        print(f"\n{'='*80}")
        print(f"Example {i}: {description}")
        print("="*80)

        # Generate and parse
        result = generator.generate_and_parse(description)

        # Print formatted output
        generator.print_formatted_output(result)

        # Save to JSON
        output_file = f"d:/epic model/output/example_{i}.json"
        Path(output_file).parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        print(f"\nSaved to: {output_file}")

    print("\n" + "="*80)
    print("INFERENCE COMPLETE!")
    print("="*80)

    # Interactive mode
    print("\n" + "="*80)
    print("INTERACTIVE MODE")
    print("="*80)
    print("Enter your project description (or 'quit' to exit):\n")

    while True:
        try:
            user_input = input("> ").strip()

            if user_input.lower() in ['quit', 'exit', 'q']:
                print("\nExiting interactive mode. Goodbye!")
                break

            if not user_input:
                print("Please enter a project description.")
                continue

            # Generate and display
            result = generator.generate_and_parse(user_input)
            generator.print_formatted_output(result)

            print("\nEnter another project description (or 'quit' to exit):\n")

        except KeyboardInterrupt:
            print("\n\nExiting interactive mode. Goodbye!")
            break


if __name__ == "__main__":
    main()
