
while ($true) {
    Start-Sleep -Seconds 5

    $status = git status --porcelain

    if ($status) {
        Write-Host "Changes detected. Waiting for edits to finish..."
        Start-Sleep -Seconds 10

        $status = git status --porcelain

        if ($status) {
            git add -A

            git commit -m "Auto update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

            if ($LASTEXITCODE -eq 0) {
                git push
            }

            if ($LASTEXITCODE -ne 0) {
                Write-Host "Push failed. Check GitHub connection."
            }
        }
    }
}
