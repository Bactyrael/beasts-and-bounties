$content = Get-Content 'js\character-sheet.js' -Raw
$lines = $content -split "\r?\n"

for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '<div class="sheet-page">') {
        $lines[$i] = $lines[$i] -replace '<div class="sheet-page">', '<div class="sheet-page glass">'
    }
    elseif ($lines[$i] -match '<div class="details-tab-bar glass">') {
        $lines[$i] = $lines[$i] -replace '<div class="details-tab-bar glass">', '<div class="details-tab-bar">'
    }
    elseif ($lines[$i] -match '<div class="tab-content-container glass">') {
        $lines[$i] = $lines[$i] -replace '<div class="tab-content-container glass">', '<div class="tab-content-container">'
    }
    elseif ($lines[$i] -match '<div class="card attributes-card glass">') {
        $lines[$i] = $lines[$i] -replace '<div class="card attributes-card glass">', '<div class="card attributes-card">'
    }
}

$lines -join "`n" | Set-Content 'js\character-sheet.js' -Encoding UTF8

$css = Get-Content 'css\styles.css' -Raw
$cssLines = $css -split "\r?\n"

for ($i=0; $i -lt $cssLines.Length; $i++) {
    if ($cssLines[$i] -match '\.sheet-page \{') {
        # we know .sheet-page { is at line 853. We want to add border-radius.
        # let's just replace the exact block
    }
}
$css = $css -replace '\.sheet-page \{\s*max-width: 1400px;\s*margin: 0 auto;\s*padding: 24px;\s*\}', ".sheet-page {`n  max-width: 1400px;`n  margin: 40px auto;`n  padding: 30px;`n  border-radius: 16px;`n}"
$css | Set-Content 'css\styles.css' -Encoding UTF8
