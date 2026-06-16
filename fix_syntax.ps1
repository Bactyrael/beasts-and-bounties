$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw
# Replace literal backtick-n string with actual newline
$c = $c.Replace('type: "Shield",`n      slot: "Shield",', "type: `"Shield`",`n      slot: `"Shield`",")
Set-Content -Path $path -Value $c
