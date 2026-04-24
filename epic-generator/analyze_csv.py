
import pandas as pd
import os
from pathlib import Path
import json

def analyze_csv_files():
    csv_dir = Path("d:/epic model/csv")
    csv_files = list(csv_dir.glob("*.csv"))

    print(f"Found {len(csv_files)} CSV files")
    print("=" * 80)

    all_data = []
    stats = {
        'total_issues': 0,
        'with_storypoints': 0,
        'avg_title_length': 0,
        'avg_description_length': 0,
        'storypoint_distribution': {},
        'missing_data': {'title': 0, 'description': 0, 'storypoints': 0}
    }

    title_lengths = []
    desc_lengths = []

    # Analyze each CSV file
    for csv_file in csv_files:
        try:
            df = pd.read_csv(csv_file)

            print(f"\nFile: {csv_file.name}")
            print(f"  Rows: {len(df)}")
            print(f"  Columns: {list(df.columns)}")

            # Collect all data
            all_data.append(df)
            stats['total_issues'] += len(df)

            # Check for missing data
            if 'title' in df.columns:
                stats['missing_data']['title'] += df['title'].isna().sum()
                title_lengths.extend(df['title'].dropna().str.len().tolist())

            if 'description' in df.columns:
                stats['missing_data']['description'] += df['description'].isna().sum()
                desc_lengths.extend(df['description'].dropna().str.len().tolist())

            if 'storypoints' in df.columns:
                non_null_sp = df['storypoints'].dropna()
                stats['with_storypoints'] += len(non_null_sp)
                stats['missing_data']['storypoints'] += df['storypoints'].isna().sum()

                # Story point distribution
                for sp in non_null_sp:
                    sp_str = str(int(sp)) if pd.notna(sp) else 'None'
                    stats['storypoint_distribution'][sp_str] = stats['storypoint_distribution'].get(sp_str, 0) + 1

            # Show sample data
            if len(df) > 0:
                print(f"  Sample title: {df['title'].iloc[0][:80] if 'title' in df.columns else 'N/A'}...")

        except Exception as e:
            print(f"Error reading {csv_file.name}: {e}")

    # Calculate averages
    if title_lengths:
        stats['avg_title_length'] = sum(title_lengths) / len(title_lengths)
    if desc_lengths:
        stats['avg_description_length'] = sum(desc_lengths) / len(desc_lengths)

    # Combine all dataframes
    combined_df = pd.concat(all_data, ignore_index=True)

    print("\n" + "=" * 80)
    print("OVERALL STATISTICS")
    print("=" * 80)
    print(f"Total Issues: {stats['total_issues']}")
    print(f"Issues with Story Points: {stats['with_storypoints']}")
    print(f"Average Title Length: {stats['avg_title_length']:.1f} characters")
    print(f"Average Description Length: {stats['avg_description_length']:.1f} characters")

    print("\nMissing Data:")
    print(f"  Missing Titles: {stats['missing_data']['title']}")
    print(f"  Missing Descriptions: {stats['missing_data']['description']}")
    print(f"  Missing Story Points: {stats['missing_data']['storypoints']}")

    print("\nStory Point Distribution:")
    sorted_sp = sorted(stats['storypoint_distribution'].items(), key=lambda x: float(x[0]) if x[0].replace('.','').isdigit() else 0)
    for sp, count in sorted_sp:
        print(f"  {sp} points: {count} issues ({count/stats['total_issues']*100:.1f}%)")

    # Analyze description patterns
    print("\n" + "=" * 80)
    print("DESCRIPTION CONTENT ANALYSIS")
    print("=" * 80)

    descriptions = combined_df['description'].dropna()

    # Look for structured content
    patterns = {
        'has_goals': descriptions.str.contains('Goals?:', case=False, na=False).sum(),
        'has_tasks': descriptions.str.contains('Tasks?:', case=False, na=False).sum(),
        'has_acceptance': descriptions.str.contains('Acceptance|Criteria', case=False, na=False).sum(),
        'has_steps': descriptions.str.contains('Steps? to', case=False, na=False).sum(),
        'has_checklist': descriptions.str.contains(r'\[.\]', regex=True, na=False).sum(),
        'has_bug_template': descriptions.str.contains('bug behavior|expected behavior', case=False, na=False).sum(),
        'has_implementation': descriptions.str.contains('Implementation', case=False, na=False).sum(),
    }

    print("Structured Content Found:")
    for pattern, count in patterns.items():
        print(f"  {pattern}: {count} issues ({count/stats['total_issues']*100:.1f}%)")

    # Sample some issues with good structure
    print("\n" + "=" * 80)
    print("SAMPLE WELL-STRUCTURED ISSUES")
    print("=" * 80)

    structured = combined_df[
        combined_df['description'].str.contains('Goals?:|Tasks?:|Acceptance', case=False, na=False)
    ].head(3)

    for idx, row in structured.iterrows():
        print(f"\nIssue: {row['issuekey']}")
        print(f"Title: {row['title']}")
        print(f"Story Points: {row['storypoints']}")
        print(f"Description Preview: {row['description'][:200]}...")
        print("-" * 80)

    # Export summary
    summary = {
        'total_files': len(csv_files),
        'statistics': stats,
        'patterns': patterns
    }

    with open('d:/epic model/data_analysis_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"\nSummary saved to: data_analysis_summary.json")
    print(f"Total usable training examples: {stats['with_storypoints']}")

    return combined_df, stats

if __name__ == "__main__":
    df, stats = analyze_csv_files()
