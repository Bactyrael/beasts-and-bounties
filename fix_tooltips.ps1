$compendiumPath = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\compendium.js'
$c = Get-Content $compendiumPath -Raw

$c = [regex]::Replace($c, '(<p>\$\{item\.description[^}]*\}</p>\s*</div>)', '$1`n          ${item.use ? `<div class="detail-section"><h4>Use</h4><p>${item.use}</p></div>` : ""}')

Set-Content -Path $compendiumPath -Value $c

$charSheetPath = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\character-sheet.js'
$cs = Get-Content $charSheetPath -Raw

$cs = [regex]::Replace($cs, '(<p>\$\{item\.description\}</p>)', '$1`n                ${item.use ? `<h4>Use</h4><p>${item.use}</p>` : ""}')

Set-Content -Path $charSheetPath -Value $cs
