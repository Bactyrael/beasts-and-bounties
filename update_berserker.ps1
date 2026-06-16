$content = Get-Content js/data.js -Raw -Encoding UTF8
$startIndex = $content.IndexOf("    // --- BERSERKER CLASS LIST ---")
$endIndex = $content.IndexOf("    // --- DISCIPLE CLASS LIST ---")

if ($startIndex -ne -1 -and $endIndex -ne -1) {
    $newBerserker = Get-Content new_berserker.txt -Raw -Encoding UTF8
    $newContent = $content.Substring(0, $startIndex) + $newBerserker + $content.Substring($endIndex)
    Set-Content -Path js/data.js -Value $newContent -Encoding UTF8
    Write-Host "Success"
} else {
    Write-Host "Markers not found. Start: $startIndex, End: $endIndex"
}
