$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw

# Replace type: "Potion" with type: "Medicine"
$c = [regex]::Replace($c, '(?i)type:\s*"Potion"', 'type: "Medicine"')

Set-Content -Path $path -Value $c
