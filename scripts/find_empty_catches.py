import re, os, sys

app_dir = 'apps/web/src/app/api'
pattern = re.compile(r'catch\s*\([^)]*\)\s*\{', re.IGNORECASE)

def find_closing_brace(lines, start_idx):
    depth = 1
    i = start_idx
    while i < len(lines) and depth > 0:
        for ch in lines[i]:
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    return -1

def is_effectively_empty(body_lines):
    for line in body_lines:
        stripped = line.strip()
        if stripped and not stripped.startswith('//'):
            return False
    return True

empty_blocks = []

for root, _, files in os.walk(app_dir):
    for fname in files:
        if not fname.endswith('.ts') and not fname.endswith('.tsx'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            if pattern.search(line):
                close_idx = find_closing_brace(lines, i)
                if close_idx == -1:
                    continue
                body = lines[i+1:close_idx]
                if is_effectively_empty(body):
                    empty_blocks.append(f"{fpath}:{i+1}")

if empty_blocks:
    print(f"Found {len(empty_blocks)} truly empty catch block(s):\n")
    for b in empty_blocks:
        print(b)
else:
    print("No truly empty catch blocks found.")
