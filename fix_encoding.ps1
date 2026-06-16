$content = Get-Content 'js\character-sheet.js' -Raw -Encoding UTF8

$content = $content -replace 'Ã¢Å¡Â«', '⚫'
$content = $content -replace 'Ã¢Å¡Âª', '⚪'
$content = $content -replace 'Ã°Å¸Å¸Â¡', '🟡'
$content = $content -replace 'Ã°Å¸Âªâ„¢', '🪙'
$content = $content -replace 'Ã°Å¸â€™Å½', '💎'
$content = $content -replace 'Ãƒâ€”', '×'
$content = $content -replace 'Ã°Å¸â€ â€œ', '🔓'
$content = $content -replace 'Ã°Å¸â€ ', '🔒'
$content = $content -replace 'Ã¢â€“Â¼', '▼'
$content = $content -replace 'BowmenÃ¢â‚¬â„¢s', "Bowmen's"
$content = $content -replace 'PickpocketÃ¢â‚¬â„¢s', "Pickpocket's"
$content = $content -replace 'MyrlockÃ¢â‚¬â„¢s', "Myrlock's"

Set-Content -Path 'js\character-sheet.js' -Value $content -Encoding UTF8
Write-Host "Success"
