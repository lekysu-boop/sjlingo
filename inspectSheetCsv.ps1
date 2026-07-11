$url = 'https://docs.google.com/spreadsheets/d/1nb5gkJcjacVIvY1U2bVnZKnaDv6bCT_NNEM6IM-MpN0/gviz/tq?tqx=out:csv&gid=1932163322'
try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -Headers @{ 'User-Agent'='Mozilla/5.0' } -ErrorAction Stop
    Write-Host "STATUS: $($r.StatusCode)"
    $text = $r.Content
    $lines = $text -split '\r?\n'
    Write-Host "LINES: $($lines.Count)"
    $lines[0..([math]::Min(49,$lines.Count-1))] | ForEach-Object { Write-Host $_ }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
