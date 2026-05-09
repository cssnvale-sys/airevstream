import os
app_dir = 'apps/web/src/app'
for root, dirs, files in os.walk(app_dir):
    for f in files:
        if f.endswith('route.ts'):
            fp = os.path.join(root, f)
            with open(fp, 'r') as fh:
                content = fh.read()
            if 'export const dynamic' in content:
                continue
            lines = content.split('\n')
            last_import_idx = -1
            for i, line in enumerate(lines):
                if line.startswith('import '):
                    last_import_idx = i
            insert_idx = last_import_idx + 1 if last_import_idx >= 0 else 0
            lines.insert(insert_idx, "\nexport const dynamic = 'force-dynamic';")
            with open(fp, 'w') as fh:
                fh.write('\n'.join(lines))
            print(fp)
