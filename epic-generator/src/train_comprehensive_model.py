"""
Train T5 Model with Comprehensive Format
Trains the model to generate detailed epics, user stories, and test cases
matching the Autonomous Solar Vehicle PDF format
"""

import torch
from transformers import (
    T5Tokenizer,
    T5ForConditionalGeneration,
    TrainingArguments,
    Trainer,
    DataCollatorForSeq2Seq
)
from datasets import load_dataset
import json
from pathlib import Path


class ComprehensiveModelTrainer:
    """
    Trains T5 model to generate comprehensive project documentation
    """

    def __init__(
        self,
        model_name: str = "t5-base",  # Larger model for more detail
        max_input_length: int = 512,
        max_output_length: int = 512  # Longer output for comprehensive format
    ):
        """
        Initialize trainer

        Args:
            model_name: T5 model to use (t5-small, t5-base, t5-large)
            max_input_length: Max tokens for input
            max_output_length: Max tokens for output (needs to be longer for detailed format)
        """
        self.model_name = model_name
        self.max_input_length = max_input_length
        self.max_output_length = max_output_length

        # Check GPU
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")

        if torch.cuda.is_available():
            print(f"GPU: {torch.cuda.get_device_name(0)}")
            print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")

        # Load tokenizer and model
        print(f"\nLoading {model_name}...")
        self.tokenizer = T5Tokenizer.from_pretrained(model_name)
        self.model = T5ForConditionalGeneration.from_pretrained(model_name)
        self.model.to(self.device)

        param_count = sum(p.numel() for p in self.model.parameters()) / 1e6
        print(f"Model parameters: {param_count:.1f}M")

    def load_data(self, data_file: str):
        """Load and prepare comprehensive training data"""
        print(f"\nLoading data from: {data_file}")

        # Load JSON data
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        print(f"Loaded {len(data)} examples")

        # Convert to HuggingFace dataset format
        dataset = load_dataset('json', data_files={'train': data_file})['train']

        # Split into train/val/test
        train_test = dataset.train_test_split(test_size=0.2, seed=42)
        test_val = train_test['test'].train_test_split(test_size=0.5, seed=42)

        splits = {
            'train': train_test['train'],
            'validation': test_val['train'],
            'test': test_val['test']
        }

        print(f"Train: {len(splits['train'])}")
        print(f"Validation: {len(splits['validation'])}")
        print(f"Test: {len(splits['test'])}")

        return splits

    def preprocess_function(self, examples):
        """Preprocess examples for T5"""
        # Add T5 prefix for text-to-text format
        inputs = [
            "generate comprehensive project documentation: " + text
            for text in examples['input']
        ]

        # Tokenize inputs
        model_inputs = self.tokenizer(
            inputs,
            max_length=self.max_input_length,
            truncation=True,
            padding=False
        )

        # Tokenize targets
        labels = self.tokenizer(
            text_target=examples['output'],
            max_length=self.max_output_length,
            truncation=True,
            padding=False
        )

        model_inputs["labels"] = labels["input_ids"]

        return model_inputs

    def train(
        self,
        train_dataset,
        val_dataset,
        output_dir: str = "d:/epic model/models/comprehensive-model",
        num_epochs: int = 5,  # More epochs for complex format
        batch_size: int = 2,  # Smaller batch for larger outputs
        learning_rate: float = 3e-4
    ):
        """
        Train the model

        Args:
            train_dataset: Training dataset
            val_dataset: Validation dataset
            output_dir: Where to save the model
            num_epochs: Number of training epochs
            batch_size: Batch size (smaller for larger model/outputs)
            learning_rate: Learning rate
        """
        print("\n" + "="*80)
        print("STARTING COMPREHENSIVE MODEL TRAINING")
        print("="*80)

        # Tokenize datasets
        print("\nTokenizing datasets...")
        tokenized_train = train_dataset.map(
            self.preprocess_function,
            batched=True,
            remove_columns=train_dataset.column_names
        )

        tokenized_val = val_dataset.map(
            self.preprocess_function,
            batched=True,
            remove_columns=val_dataset.column_names
        )

        # Data collator
        data_collator = DataCollatorForSeq2Seq(
            tokenizer=self.tokenizer,
            model=self.model,
            padding=True
        )

        # Training arguments
        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=batch_size,
            gradient_accumulation_steps=4,  # Effective batch size = 8
            learning_rate=learning_rate,
            weight_decay=0.01,
            eval_strategy="steps",
            eval_steps=500,
            save_strategy="steps",
            save_steps=500,
            logging_steps=100,
            fp16=torch.cuda.is_available(),  # Mixed precision
            save_total_limit=3,
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            report_to="none",
            push_to_hub=False
        )

        # Trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=tokenized_train,
            eval_dataset=tokenized_val,
            data_collator=data_collator,
        )

        # Train
        print("\nStarting training...")
        print(f"Total steps: {len(tokenized_train) // (batch_size * training_args.gradient_accumulation_steps) * num_epochs}")
        print(f"Checkpoints every 500 steps")
        print("\n" + "="*80)

        trainer.train()

        # Save final model
        print("\nSaving final model...")
        final_model_path = f"{output_dir}/final"
        trainer.save_model(final_model_path)
        self.tokenizer.save_pretrained(final_model_path)

        print(f"Model saved to: {final_model_path}")

        return trainer

    def evaluate(self, test_dataset, trainer):
        """Evaluate on test set"""
        print("\nEvaluating on test set...")

        tokenized_test = test_dataset.map(
            self.preprocess_function,
            batched=True,
            remove_columns=test_dataset.column_names
        )

        results = trainer.evaluate(tokenized_test)

        print("\nTest Results:")
        for key, value in results.items():
            print(f"  {key}: {value:.4f}")

        return results


def main():
    """Main training function"""
    import sys

    print("="*80)
    print("COMPREHENSIVE T5 MODEL TRAINING")
    print("Training T5 to generate detailed epics, stories, and test cases")
    print("="*80)

    # Check GPU memory
    if torch.cuda.is_available():
        gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
        print(f"\nGPU Memory: {gpu_memory:.2f} GB")

        # Recommend model size based on memory
        if gpu_memory < 8:
            print("WARNING: Using t5-small (60M) - limited GPU memory")
            print("For better results, use t5-base (220M) with 8GB+ GPU")
            model_name = "t5-small"
            batch_size = 4
        else:
            print("SUCCESS: Using t5-base (220M) - sufficient GPU memory")
            model_name = "t5-base"
            batch_size = 2
    else:
        print("WARNING: No GPU detected - training will be very slow!")
        model_name = "t5-small"
        batch_size = 2

    # Check if comprehensive training data exists
    data_file = "d:/epic model/data/comprehensive_training_data.json"
    if not Path(data_file).exists():
        print(f"\nERROR: Training data not found at {data_file}")
        print("\nPlease run the data generator first:")
        print("  py -3.12 src/comprehensive_preprocessor.py")
        sys.exit(1)

    # Initialize trainer
    trainer = ComprehensiveModelTrainer(
        model_name=model_name,
        max_input_length=512,
        max_output_length=512  # Longer for comprehensive format
    )

    # Load data
    datasets = trainer.load_data(data_file)

    # Train
    print("\nTraining will take 2-4 hours depending on your GPU")
    print("You can monitor progress in the output")
    print("\nStarting training now...\n")

    trained_model = trainer.train(
        train_dataset=datasets['train'],
        val_dataset=datasets['validation'],
        output_dir="d:/epic model/models/comprehensive-model",
        num_epochs=5,  # More epochs for complex output
        batch_size=batch_size,
        learning_rate=3e-4
    )

    # Evaluate
    trainer.evaluate(datasets['test'], trained_model)

    print("\n" + "="*80)
    print("TRAINING COMPLETE!")
    print("="*80)
    print("\nModel saved to: d:/epic model/models/comprehensive-model/final")
    print("\nNext steps:")
    print("1. Test the model with: py -3.12 test_comprehensive_model.py")
    print("2. Update web app to use the new model")


if __name__ == "__main__":
    main()
