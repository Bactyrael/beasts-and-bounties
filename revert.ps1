$lines = Get-Content .\js\data.js
$inItem = $false
$itemStart = 0
$hasFocusOrImplement = $false
$hasRarity = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match '^\s*\{') {
        $inItem = $true
        $itemStart = $i
        $hasFocusOrImplement = $false
        $hasRarity = $false
    }
    
    if ($inItem) {
        if ($line -match 'type:\s*"(Focus|Implement)"') { $hasFocusOrImplement = $true }
        if ($line -match 'rarity:') { $hasRarity = $true }
        
        if ($line -match '^\s*\},?') {
            $inItem = $false
            if ($hasRarity -and -not $hasFocusOrImplement) {
                for ($j = $itemStart; $j -le $i; $j++) {
                    $lines[$j] = $lines[$j] -replace 'Gold Pieces \(GP\)', 'Crystal Pieces (CP)'
                }
            }
        }
    }
}
$lines | Set-Content .\js\data.js
