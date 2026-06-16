$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw
# The previous script did: $c = [regex]::Replace($c, '(?i)type:\s*"Helm",', 'type: "Head",')
# Let's replace type: "Head" with type: "Helm" if the item also has slot: "Head"
# A simple regex to find type: "Head" followed shortly by slot: "Head"
$c = [regex]::Replace($c, '(?i)type:\s*"Head",(\s*rarity:\s*"[^"]*",\s*)?slot:\s*"Head",', 'type: "Helm",$1slot: "Head",')
# And if slot is before type:
$c = [regex]::Replace($c, '(?i)slot:\s*"Head",(\s*rarity:\s*"[^"]*",\s*)?type:\s*"Head",', 'slot: "Head",$1type: "Helm",')

Set-Content -Path $path -Value $c
