#!/usr/bin/env python3
"""
Find TRULY empty catch blocks in TypeScript API route files.
"""
import os, re

app_dir = 'apps/web/src/app/api'

def find_truly_empty_catches(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Match catch blocks: catch (anything) { ... }
    # We use a line-by-line approach
    lines = content.split('\n')
    empties = []
    catch_pattern = re.compile(r'^\s*catch\s*\([^)]*\)\s*\{\s*$')

    i = 0
    while i < len(lines):
        if catch_pattern.match(lines[i]):
            # Found catch with opening brace on same line
            brace_depth = 1
            j = i + 1
            has_content = False
            while j < len(lines) and brace_depth > 0:
                stripped = lines[j].strip()
                # Count braces on this line
                for idx, ch in enumerate(lines[j]):
                    if ch == '{':
                        brace_depth += 1
                    elif ch == '}':
                        brace_depth -= 1
                        if brace_depth == 0:
                            break
                else:
                    # Did not hit closing brace
                    if stripped and not stripped.startswith('//') and not stripped.startswith('/*') and not stripped.startswith('*'):
                        has_content = True
                    j += 1
                    continue
                # We found the closing brace
                # Check if there was any meaningful content in lines before this one
                if lines[j].strip() != '}':
                    # There's something on the closing brace line
                    line_before_brace = lines[j][:lines[j].rfind('}')].strip()
                    if line_before_brace and not line_before_brace.startswith('//') and not line_before_brace.startswith('/*'):
                        has_content = True
                j += 1
                break

            if not has_content:
                empties.append(f"{filepath}:{i+1}")
            i = j
        else:
            i += 1

    return empties

all_empties = []
for root, _, files in os.walk(app_dir):
    for fname in files:
        if not fname.endswith('.ts') and not fname.endswith('.tsx'):
            continue
        all_empties.extend(find_truly_empty_catches(os.path.join(root, fname)))

if all_empties:
    print(f"Found {len(all_empties)} truly empty catch block(s):\n")
    for e in all_empties:
        print(e)
else:
    print("No truly empty catch blocks found.")
