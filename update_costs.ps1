$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw
$c = [regex]::Replace($c, '(?i)\b(\d+)\s*bp\b', '$1 Bronze Pieces (BP)')
$c = [regex]::Replace($c, '(?i)\b(\d+)\s*sp\b', '$1 Silver Pieces (SP)')
$c = [regex]::Replace($c, '(?i)\b(\d+)\s*gp\b', '$1 Gold Pieces (GP)')
$c = [regex]::Replace($c, '(?i)\b(\d+)\s*pp\b', '$1 Platinum Pieces (PP)')
$c = [regex]::Replace($c, '(?i)\b(\d+)\s*cp\b', '$1 Crystal Pieces (CP)')
Set-Content -Path $path -Value $c
