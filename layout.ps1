$content = Get-Content 'js\character-sheet.js' -Raw
$lines = $content -split "\r?\n"

$skillsStart = -1
$skillsEnd = -1

for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'if \(activeTab === "skills"\) \{') {
        $skillsStart = $i
    }
    if ($lines[$i] -match 'else if \(activeTab === "equipment"\) \{') {
        $skillsEnd = $i
        break
    }
}

if ($skillsStart -ne -1 -and $skillsEnd -ne -1) {
    $skillsLines = $lines[$skillsStart..($skillsEnd-1)]
    $skillsLines[0] = "  function renderLeftSidebar(char) {"
    
    # Remove skills lines from original array
    $lines = $lines[0..($skillsStart-1)] + $lines[$skillsEnd..($lines.Length-1)]
    
    # Make replacements
    for ($i=0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match 'let activeTab = localStorage.getItem\("bb_sheet_tab"\) \|\| "skills";') {
            $lines[$i] = $lines[$i] -replace '"skills"', '"spells"'
        }
        if ($lines[$i] -match 'data-tab="skills">Character') {
            $lines[$i] = ""
        }
        if ($lines[$i] -match '<div class="sheet-grid">') {
            $lines[$i] = '        <div class="sheet-grid" style="display:flex; gap:20px;">' + "`r`n" + '          ${renderLeftSidebar(char)}'
        }
        if ($lines[$i] -match 'else if \(activeTab === "equipment"\) \{') {
            $lines[$i] = '    if (activeTab === "equipment") {'
        }
    }
    
    # Find insertion point for renderLeftSidebar
    $insertIdx = -1
    for ($i=0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match 'function renderTabContent\(char\)') {
            $insertIdx = $i
            break
        }
    }
    
    if ($insertIdx -ne -1) {
        $newLines = $lines[0..($insertIdx-1)] + $skillsLines + $lines[$insertIdx..($lines.Length-1)]
        $newLines -join "`n" | Set-Content 'js\character-sheet.js' -Encoding UTF8
        Write-Host "Success"
    } else {
        Write-Host "Failed to find renderTabContent"
    }
} else {
    Write-Host "Failed to find skills block"
}
