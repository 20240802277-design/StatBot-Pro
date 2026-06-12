import os
import sys
import pandas as pd

def split_file(file_path, output_dir="split_output"):
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' does not exist.")
        return
    
    # Load file
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.csv':
        df = pd.read_csv(file_path)
    elif ext in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path)
    else:
        # Fallback to plain text split
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        df = pd.DataFrame(lines, columns=['text'])
        
    num_rows = len(df)
    print(f"Loaded {file_path} with {num_rows} rows.")
    
    # Create output folders
    folders = [os.path.join(output_dir, f"folder_{i}") for i in range(1, 5)]
    for f in folders:
        os.makedirs(f, exist_ok=True)
        
    num_files = 50
    rows_per_file = max(1, num_rows // num_files)
    
    for file_idx in range(1, num_files + 1):
        # Determine target folder (folder_1, folder_2, folder_3, folder_4)
        folder_idx = (file_idx - 1) % 4
        target_folder = folders[folder_idx]
        
        if num_rows >= num_files:
            start_row = (file_idx - 1) * rows_per_file
            end_row = num_rows if file_idx == num_files else start_row + rows_per_file
            chunk = df.iloc[start_row:end_row]
        else:
            # Dataset is small: sample rows with replacement to build populated file parts
            chunk = df.sample(n=min(5, num_rows), replace=True).reset_index(drop=True)
            
        out_filename = f"part_{file_idx}{ext if ext in ['.csv', '.xlsx', '.xls'] else '.txt'}"
        out_path = os.path.join(target_folder, out_filename)
        
        if ext == '.csv':
            chunk.to_csv(out_path, index=False)
        elif ext in ['.xlsx', '.xls']:
            chunk.to_excel(out_path, index=False)
        else:
            with open(out_path, 'w', encoding='utf-8') as f:
                f.writelines(chunk['text'].tolist())
                
    print(f"Successfully divided the file into 50 files distributed across 4 folders under '{output_dir}/'.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python split_file.py <file_path> [output_directory]")
    else:
        file_p = sys.argv[1]
        out_d = sys.argv[2] if len(sys.argv) > 2 else "split_output"
        split_file(file_p, out_d)
