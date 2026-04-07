$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "node"
$psi.Arguments = "api/index.js"
$psi.WorkingDirectory = "D:\LLM code\offerdoctor-max-app"
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$p = [System.Diagnostics.Process]::Start($psi)
Start-Sleep -Seconds 3
$p.Refresh()
Write-Host "Running PID:" $p.Id
$stdout = $p.StandardOutput.ReadToEnd()
$stderr = $p.StandardError.ReadToEnd()
Write-Host "STDOUT:" $stdout.Substring(0, [Math]::Min(500, $stdout.Length))
Write-Host "STDERR:" $stderr.Substring(0, [Math]::Min(500, $stderr.Length))