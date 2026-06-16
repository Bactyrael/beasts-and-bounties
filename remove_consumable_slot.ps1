$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw
# Replace slot: "Consumable"
$c = [regex]::Replace($c, '(?i),\s*slot:\s*"Consumable"', '')
# Also if it's the only thing after type
$c = [regex]::Replace($c, '(?i)slot:\s*"Consumable",\s*', '')

Set-Content -Path $path -Value $c
