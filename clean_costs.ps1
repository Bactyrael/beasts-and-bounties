$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw

# Clean up malformed pluralizations like "Gold Pieces (GP)s (GP)" -> "Gold Pieces (GP)"
$c = [regex]::Replace($c, '(?i)(Bronze|Silver|Gold|Platinum|Crystal)\s+Pieces?\s*\(([BSGPC]P)\)s\s*\(\2\)', '$1 Pieces ($2)')

# Clean up any other weird ones like "Pieces (GP)s"
$c = [regex]::Replace($c, '(?i)(Bronze|Silver|Gold|Platinum|Crystal)\s+Pieces?\s*\(([BSGPC]P)\)s', '$1 Pieces ($2)')

# Clean up double abbreviations like "Gold Pieces (GP) (GP)"
$c = [regex]::Replace($c, '(?i)(Bronze|Silver|Gold|Platinum|Crystal)\s+Pieces?\s*\(([BSGPC]P)\)\s*\(\2\)', '$1 Pieces ($2)')

Set-Content -Path $path -Value $c
