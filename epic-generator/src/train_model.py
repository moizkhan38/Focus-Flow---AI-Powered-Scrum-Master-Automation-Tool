"""
T5 Model Training Script for Epic/Story Generation
Uses GPU acceleration for NLP+ML training
"""

import torch
from transformers import (
    T5Tokenizer,
    T5ForConditionalGeneration,
    Trainer,
    TrainingArguments,
    DataCollatorForSeq2Seq
)
from datasets import Dataset
import json
from pathlib import Path
import numpy as np

class EpicStoryTrainer:
    """
    ML/NLP Training Pipeline for T5 Model
    """

    def __init__(
        self,
        model_name="t5-small",  # 60M params, fits in 6GB VRAM
        max_input_length=512,
        max_output_length=256
    ):
        self.model_name = model_name
        self.max_input_length = max_input_length
        self.max_output_length = max_output_length

        # Check GPU availability
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")
        if torch.cuda.is_available():
            print(f"GPU: {torch.cuda.get_device_name(0)}")
            print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")

        # Initialize tokenizer (NLP component)
        print(f"\nLoading T5 tokenizer...")
        self.tokenizer = T5Tokenizer.from_pretrained(model_name)

        # Initialize model (ML component)
        print(f"Loading T5 model: {model_name}...")
        self.model = T5ForConditionalGeneration.from_pretrained(model_name)
        self.model.to(self.device)

        print(f"Model parameters: {sum(p.numel() for p in self.model.parameters()) / 1e6:.1f}M")

    def load_data(self, data_file="d:/epic model/data/training_data.json"):
        """Load preprocessed training data"""
        print(f"\nLoading training data from {data_file}...")

        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        print(f"Train: {len(data['train'])} examples")
        print(f"Validation: {len(data['validation'])} examples")
        print(f"Test: {len(data['test'])} examples")

        return data

    def preprocess_function(self, examples):
        """
        NLP Preprocessing: Tokenize inputs and outputs
        Converts text to numerical tensors for ML model
        """
        # Add task prefix for T5
        inputs = ["generate project details: " + text for text in examples['input']]

        # Tokenize inputs (NLP)
        model_inputs = self.tokenizer(
            inputs,
            max_length=self.max_input_length,
            truncation=True,
            padding=False  # Will be done by data collator
        )

        # Tokenize outputs (labels)
        labels = self.tokenizer(
            text_target=examples['output'],
            max_length=self.max_output_length,
            truncation=True,
            padding=False
        )

        model_inputs["labels"] = labels["input_ids"]
        return model_inputs

    def create_datasets(self, data):
        """Create HuggingFace datasets for training"""
        print("\nCreating datasets...")

        # Convert to HuggingFace Dataset format
        train_dict = {
            'input': [ex['input'] for ex in data['train']],
            'output': [ex['output'] for ex in data['train']]
        }
        val_dict = {
            'input': [ex['input'] for ex in data['validation']],
            'output': [ex['output'] for ex in data['validation']]
        }

        train_dataset = Dataset.from_dict(train_dict)
        val_dataset = Dataset.from_dict(val_dict)

        # Apply NLP preprocessing (tokenization)
        print("Tokenizing data...")
        train_tokenized = train_dataset.map(
            self.preprocess_function,
            batched=True,
            remove_columns=train_dataset.column_names
        )
        val_tokenized = val_dataset.map(
            self.preprocess_function,
            batched=True,
            remove_columns=val_dataset.column_names
        )

        return train_tokenized, val_tokenized

    def train(
        self,
        train_dataset,
        val_dataset,
        output_dir="d:/epic model/models/epic-story-model",
        num_epochs=3,
        batch_size=4,
        learning_rate=3e-4,
        save_steps=500
    ):
        """
        ML Training Loop using GPU acceleration
        """
        print("\n" + "="*80)
        print("STARTING MODEL TRAINING")
        print("="*80)

        # Create output directory
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        # Auto-calculate eval/save steps for small datasets
        grad_accum = 2
        steps_per_epoch = max(1, len(train_dataset) // (batch_size * grad_accum))
        total_steps = steps_per_epoch * num_epochs

        # Use epoch-based eval/save for small datasets, step-based for large
        if total_steps < save_steps:
            eval_strategy = "epoch"
            save_strategy = "epoch"
            eval_steps_val = None
            save_steps_val = None
            logging_steps = max(1, steps_per_epoch)
            warmup_steps = min(50, total_steps // 3)
        else:
            eval_strategy = "steps"
            save_strategy = "steps"
            eval_steps_val = save_steps
            save_steps_val = save_steps
            logging_steps = 100
            warmup_steps = 500

        # Training arguments (ML hyperparameters)
        training_args_kwargs = dict(
            output_dir=output_dir,
            eval_strategy=eval_strategy,
            save_strategy=save_strategy,
            learning_rate=learning_rate,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=batch_size,
            num_train_epochs=num_epochs,
            weight_decay=0.01,
            save_total_limit=3,
            fp16=torch.cuda.is_available(),
            logging_dir=f"{output_dir}/logs",
            logging_steps=logging_steps,
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            greater_is_better=False,
            push_to_hub=False,
            report_to=["none"],
            warmup_steps=warmup_steps,
            gradient_accumulation_steps=grad_accum,
        )
        if eval_steps_val is not None:
            training_args_kwargs["eval_steps"] = eval_steps_val
            training_args_kwargs["save_steps"] = save_steps_val

        training_args = TrainingArguments(**training_args_kwargs)

        # Data collator for dynamic padding
        data_collator = DataCollatorForSeq2Seq(
            tokenizer=self.tokenizer,
            model=self.model,
            padding=True
        )

        # Initialize Trainer (ML training orchestrator)
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            data_collator=data_collator,
        )

        # Train the model (ML + NLP)
        print("\nTraining on GPU...")
        print(f"Total training steps: {len(train_dataset) * num_epochs // (batch_size * 2)}")
        print(f"Batch size: {batch_size} (effective: {batch_size * 2} with gradient accumulation)")
        print(f"Learning rate: {learning_rate}")
        print(f"Epochs: {num_epochs}\n")

        trainer.train()

        # Save final model
        print("\nSaving model...")
        trainer.save_model(f"{output_dir}/final")
        self.tokenizer.save_pretrained(f"{output_dir}/final")

        print(f"\nModel saved to: {output_dir}/final")
        print("="*80)
        print("TRAINING COMPLETE!")
        print("="*80)

        return trainer

    def evaluate(self, trainer, test_data):
        """Evaluate model on test set"""
        print("\nEvaluating on test set...")

        test_dict = {
            'input': [ex['input'] for ex in test_data],
            'output': [ex['output'] for ex in test_data]
        }
        test_dataset = Dataset.from_dict(test_dict)
        test_tokenized = test_dataset.map(
            self.preprocess_function,
            batched=True,
            remove_columns=test_dataset.column_names
        )

        metrics = trainer.evaluate(test_tokenized)

        print("\nTest Results:")
        for key, value in metrics.items():
            print(f"  {key}: {value:.4f}")

        return metrics

def main():
    """Main training pipeline"""
    print("="*80)
    print("EPIC/STORY GENERATION MODEL TRAINING")
    print("NLP + ML Pipeline with GPU Acceleration")
    print("="*80)

    # Initialize trainer
    trainer_obj = EpicStoryTrainer(
        model_name="t5-small",  # Can also try "t5-base" if GPU allows
        max_input_length=512,
        max_output_length=256
    )

    # Load data
    data = trainer_obj.load_data()

    # Create datasets
    train_dataset, val_dataset = trainer_obj.create_datasets(data)

    # Train model
    trainer = trainer_obj.train(
        train_dataset=train_dataset,
        val_dataset=val_dataset,
        output_dir="d:/epic model/models/epic-story-model",
        num_epochs=3,  # Adjust based on time available
        batch_size=4,  # Fits in 6GB VRAM
        learning_rate=3e-4,
        save_steps=500
    )

    # Evaluate
    metrics = trainer_obj.evaluate(trainer, data['test'])

    print("\nTraining complete! Model ready for inference.")
    print(f"Model location: d:/epic model/models/epic-story-model/final")

if __name__ == "__main__":
    main()
