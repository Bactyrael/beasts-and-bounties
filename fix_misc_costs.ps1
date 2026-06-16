$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw

# Replace "<Number> <Material>" with "<Number> <Material> Pieces (<Abbrev>)"
$c = [regex]::Replace($c, '(?i)\b([2-9]|\d{2,})\s+Bronze(?![\w\s]*Piece)', '$1 Bronze Pieces (BP)')
$c = [regex]::Replace($c, '(?i)\b([2-9]|\d{2,})\s+Silver(?![\w\s]*Piece)', '$1 Silver Pieces (SP)')
$c = [regex]::Replace($c, '(?i)\b([2-9]|\d{2,})\s+Gold(?![\w\s]*Piece)', '$1 Gold Pieces (GP)')
$c = [regex]::Replace($c, '(?i)\b([2-9]|\d{2,})\s+Platinum(?![\w\s]*Piece)', '$1 Platinum Pieces (PP)')
$c = [regex]::Replace($c, '(?i)\b([2-9]|\d{2,})\s+Crystal(?![\w\s]*Piece)', '$1 Crystal Pieces (CP)')

# Replace singular ones
$c = [regex]::Replace($c, '(?i)\b1\s+Bronze(?![\w\s]*Piece)', '1 Bronze Piece (BP)')
$c = [regex]::Replace($c, '(?i)\b1\s+Silver(?![\w\s]*Piece)', '1 Silver Piece (SP)')
$c = [regex]::Replace($c, '(?i)\b1\s+Gold(?![\w\s]*Piece)', '1 Gold Piece (GP)')
$c = [regex]::Replace($c, '(?i)\b1\s+Platinum(?![\w\s]*Piece)', '1 Platinum Piece (PP)')
$c = [regex]::Replace($c, '(?i)\b1\s+Crystal(?![\w\s]*Piece)', '1 Crystal Piece (CP)')

Set-Content -Path $path -Value $c
