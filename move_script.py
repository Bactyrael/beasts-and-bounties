import sys

with open('js/character-sheet.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if "<!-- Right side: Combat Stats -->" in line:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find start_idx")
    sys.exit(1)

div_count = 0
end_idx = -1
for i in range(start_idx, len(lines)):
    line = lines[i]
    if "<div" in line: div_count += line.count("<div")
    if "</div" in line: div_count -= line.count("</div")
    if div_count == 0:
        end_idx = i
        break

if end_idx == -1:
    print("Could not find end_idx")
    sys.exit(1)

moved_lines = lines[start_idx:end_idx+1]
del lines[start_idx:end_idx+1]

spells_return_idx = -1
for i, line in enumerate(lines):
    if 'return `' in line and 'class="spells-tab-view"' in lines[i+1]:
        spells_return_idx = i
        break

if spells_return_idx == -1:
    print("Could not find spells_return_idx")
    sys.exit(1)

spells_end_idx = -1
for i in range(spells_return_idx, len(lines)):
    if '`;' in lines[i] and '}' in lines[i+1]:
        spells_end_idx = i
        break

if spells_end_idx == -1:
    print("Could not find spells_end_idx")
    sys.exit(1)

lines[spells_return_idx] = '      return `\n        <div style="display:flex; gap:20px; justify-content:center; align-items:flex-start;">\n          <div style="flex:1; max-width:500px;">\n'

insert_idx = spells_end_idx
lines.insert(insert_idx, '          </div>\n')
insert_idx += 1

for line in moved_lines:
    lines.insert(insert_idx, line)
    insert_idx += 1

lines.insert(insert_idx, '        </div>\n')

with open('js/character-sheet.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Successfully moved Combat Stats!")
