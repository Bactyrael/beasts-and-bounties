$path1 = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\compendium.js'
$c1 = Get-Content -Path $path1 -Raw
$c1 = $c1.Replace('`n', "`r`n")
Set-Content -Path $path1 -Value $c1

$path2 = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\character-sheet.js'
$c2 = Get-Content -Path $path2 -Raw
$c2 = $c2.Replace('`n', "`r`n")
Set-Content -Path $path2 -Value $c2
