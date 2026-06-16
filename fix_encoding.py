import sys

with open('js/character-sheet.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('ðŸ”“', '🔓')
content = content.replace('ðŸ”’', '🔒')
content = content.replace('â–¼', '▼')

# Let's also handle the weird dY"' thing just in case it was a different sequence
content = content.replace('dY"\'', '🔒')
content = content.replace('â–-', '▼')
content = content.replace('dY"', '🔒')

with open('js/character-sheet.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
