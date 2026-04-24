
import os
import json
import random
from datetime import datetime
from src.data_collector import TrainingDataCollector
from src.train_model import EpicStoryTrainer
from datasets import Dataset


def retrain_t5_model(min_examples: int = 10):
    """
    Retrain T5 model using collected Gemini API training data

    Args:
        min_examples: Minimum number of examples required for retraining
    """
    print("=" * 80)
    print("T5 MODEL RETRAINING")
    print("Using Gemini API outputs as training data")
    print("=" * 80)

    # Step 1: Load collected training data
    print("\n[1/5] Loading collected training data...")
    collector = TrainingDataCollector()
    stats = collector.get_stats()
    examples = collector.load_training_examples()

    # Actual count from file (stats may be out of sync)
    actual_count = len(examples)
    print(f"  Examples in file: {actual_count}")
    print(f"  Stats total: {stats['total_examples']}")
    print(f"  Last updated: {stats['last_updated']}")

    if actual_count < min_examples:
        print(f"\n[ERROR] Not enough training examples!")
        print(f"  Required: {min_examples}")
        print(f"  Collected: {actual_count}")
        print(f"  Please generate more examples before retraining.")
        return False

    # Also load approved examples if available
    approved_file = os.path.join(collector.data_dir, "pm_approved_examples.jsonl")
    if os.path.exists(approved_file):
        with open(approved_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    ex = json.loads(line)
                    examples.append(ex)
                except:
                    continue
        print(f"  + Approved examples loaded, total now: {len(examples)}")

    # Step 2: Prepare data splits
    print(f"\n[2/5] Preparing {len(examples)} examples for training...")
    random.seed(42)
    random.shuffle(examples)

    # 80/10/10 split
    n = len(examples)
    train_end = int(n * 0.8)
    val_end = int(n * 0.9)

    train_data = examples[:train_end]
    val_data = examples[train_end:val_end]
    test_data = examples[val_end:]

    # Ensure at least 1 example in each split
    if len(val_data) == 0:
        val_data = [train_data.pop()]
    if len(test_data) == 0:
        test_data = [train_data.pop()]

    print(f"  Train: {len(train_data)} examples")
    print(f"  Validation: {len(val_data)} examples")
    print(f"  Test: {len(test_data)} examples")

    # Step 3: Initialize trainer
    print("\n[3/5] Initializing T5 trainer...")
    trainer_obj = EpicStoryTrainer(
        model_name="t5-small",
        max_input_length=512,
        max_output_length=512  # Longer output for comprehensive documentation
    )

    # Step 4: Create datasets and train
    print("\n[4/5] Fine-tuning T5 model on collected data...")

    # Build data dict in the format EpicStoryTrainer expects
    data = {
        'train': [{'input': ex['input'], 'output': ex['output']} for ex in train_data],
        'validation': [{'input': ex['input'], 'output': ex['output']} for ex in val_data],
        'test': [{'input': ex['input'], 'output': ex['output']} for ex in test_data],
    }

    train_dataset, val_dataset = trainer_obj.create_datasets(data)

    model_name = f"t5-retrained-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    output_dir = f"d:/epic model/models/{model_name}"

    try:
        trainer = trainer_obj.train(
            train_dataset=train_dataset,
            val_dataset=val_dataset,
            output_dir=output_dir,
            num_epochs=3,
            batch_size=4,
            learning_rate=1e-4,
            save_steps=100
        )

        # Step 5: Evaluate
        print("\n[5/5] Evaluating on test set...")
        metrics = trainer_obj.evaluate(trainer, data['test'])

        print(f"\n{'=' * 80}")
        print(f"Retraining complete!")
        print(f"  Model saved to: {output_dir}/final")
        print(f"  Examples used: {len(examples)}")
        print(f"  Test loss: {metrics.get('eval_loss', 'N/A')}")
        print(f"\nTo use the retrained model:")
        print(f"  1. Update web_app.py to point to: {output_dir}/final")
        print(f"  2. Restart the web server")

        return True

    except Exception as e:
        print(f"\n[ERROR] Training failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function - no interactive prompt for automated execution"""
    print("\n" + "=" * 80)
    print("T5 MODEL RETRAINING UTILITY")
    print("=" * 80)
    print("\nRetraining T5 model using Gemini API outputs...")

    success = retrain_t5_model(min_examples=10)

    if success:
        print("\n" + "=" * 80)
        print("SUCCESS: T5 model has been retrained!")
        print("=" * 80)
    else:
        print("\n" + "=" * 80)
        print("FAILED: Retraining did not complete successfully")
        print("=" * 80)


if __name__ == "__main__":
    main()
