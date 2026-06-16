$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw
# Fix singular Piece for value 1
$c = [regex]::Replace($c, '(?i)\b1\s+(Bronze|Silver|Gold|Platinum|Crystal)\s+Pieces?\s*\(([BSGPC]P)\)', '1 $1 Piece ($2)')
# Fix plural Pieces for values >= 2
$c = [regex]::Replace($c, '(?i)\b([2-9]|\d{2,})\s+(Bronze|Silver|Gold|Platinum|Crystal)\s+Piece\s*\(([BSGPC]P)\)', '$1 $2 Pieces ($3)')
# Also fix any ones that don't have the abbreviation if they exist (just in case)
$c = [regex]::Replace($c, '(?i)\b1\s+(Bronze|Silver|Gold|Platinum|Crystal)\s+Pieces?([^A-Za-z(])', '1 $1 Piece$2')
Set-Content -Path $path -Value $c
