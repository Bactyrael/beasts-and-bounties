$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw
# Replace 'slot: "Shield",' with 'type: "Shield",\n      slot: "Shield",'
# Make sure we don't duplicate it if it already exists, so only if 'type' is missing around it.
# Actually, if we just do a regex replace over 'slot: "Shield",' and add 'type: "Shield",' it will work. Let's just remove existing type: "Shield" first if it exists to avoid duplicates.
$c = [regex]::Replace($c, '(?i)\s*type:\s*"Shield",\r?\n', "`n")
$c = [regex]::Replace($c, '(?i)(slot:\s*"Shield",)', 'type: "Shield",`n      $1')

Set-Content -Path $path -Value $c
