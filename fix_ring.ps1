$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw

# Remove any existing type: "Ring" to prevent duplicates
$c = $c.Replace('type: "Ring",`n      ', '')
$c = $c.Replace('type: "Ring",`r`n      ', '')
$c = $c.Replace("type: `"Ring`",`n      ", '')
$c = $c.Replace("type: `"Ring`",`r`n      ", '')

# Replace slot: "Finger" with type: "Ring" + slot: "Finger"
$c = [regex]::Replace($c, '(?i)(slot:\s*"Finger",)', "type: `"Ring`",`n      `$1")

Set-Content -Path $path -Value $c
