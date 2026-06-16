$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw
# First remove any existing type: "Necklace" just in case, to prevent duplicates
$c = $c.Replace('type: "Necklace",`n      ', '')
$c = $c.Replace('type: "Necklace",`r`n      ', '')
$c = $c.Replace("type: `"Necklace`",`n      ", '')
$c = $c.Replace("type: `"Necklace`",`r`n      ", '')

# Now replace slot: "Neck" with type: "Necklace" + slot: "Neck"
$c = [regex]::Replace($c, '(?i)(slot:\s*"Neck",)', "type: `"Necklace`",`n      `$1")

Set-Content -Path $path -Value $c
