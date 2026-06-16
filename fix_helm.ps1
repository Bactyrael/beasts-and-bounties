$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw
# Replace type: "Helm" with type: "Head"
$c = [regex]::Replace($c, '(?i)type:\s*"Helm",', 'type: "Head",')
Set-Content -Path $path -Value $c
