$lines = Get-Content "js\data.js"
$inTarget = $false
for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'type:\s*"(Focus|Martial|Great)"') {
        $inTarget = $true
    }
    
    if ($lines[$i] -match 'type:\s*"(Simple|Implement|Shield|Ammunition|Armor)"') {
        $inTarget = $false
    }

    if ($inTarget -and $lines[$i] -match 'rarity:\s*"Common"') {
        $lines[$i] = $lines[$i] -replace '"Common"', '"Uncommon"'
        $inTarget = $false
    }
}
Set-Content "js\data.js" -Value $lines
Write-Host "Done"
