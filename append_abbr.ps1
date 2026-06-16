$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw
$c = [regex]::Replace($c, '(?i)\b(\d+)\s+Bronze\s+Pieces?(?!\s*\()', '$1 Bronze Pieces (BP)')
$c = [regex]::Replace($c, '(?i)\b(\d+)\s+Silver\s+Pieces?(?!\s*\()', '$1 Silver Pieces (SP)')
$c = [regex]::Replace($c, '(?i)\b(\d+)\s+Gold\s+Pieces?(?!\s*\()', '$1 Gold Pieces (GP)')
$c = [regex]::Replace($c, '(?i)\b(\d+)\s+Platinum\s+Pieces?(?!\s*\()', '$1 Platinum Pieces (PP)')
$c = [regex]::Replace($c, '(?i)\b(\d+)\s+Crystal\s+Pieces?(?!\s*\()', '$1 Crystal Pieces (CP)')

# Fix singular Piece for value 1 just in case
$c = [regex]::Replace($c, '(?i)\b1\s+(Bronze|Silver|Gold|Platinum|Crystal)\s+Pieces\s*\(([BSGPC]P)\)', '1 $1 Piece ($2)')
Set-Content -Path $path -Value $c
