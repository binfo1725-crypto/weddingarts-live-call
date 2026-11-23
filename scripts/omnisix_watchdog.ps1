# OmniSix AI - 24/7 Local Windows Watchdog Daemon
# Pings https://omnisix-ai.onrender.com every 5 minutes to prevent Render idle sleep

$TargetUrl = "https://omnisix-ai.onrender.com/ping"
$FallbackUrl = "https://omnisix-ai.onrender.com/health"
$IntervalSec = 300 # 5 minutes

Write-Host "🚀 [OmniSix 24/7 Watchdog] Started. Pinging $TargetUrl every 5 minutes..." -ForegroundColor Cyan

while ($true) {
    $Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    try {
        $Response = Invoke-WebRequest -Uri $TargetUrl -Method GET -TimeoutSec 15 -UseBasicParsing
        if ($Response.StatusCode -eq 200) {
            Write-Host "[$Timestamp] ✅ Server ALIVE (Status 200 OK)" -ForegroundColor Green
        } else {
            Write-Host "[$Timestamp] ⚠️ Non-200 Status ($($Response.StatusCode)). Pinging fallback..." -ForegroundColor Yellow
            $null = Invoke-WebRequest -Uri $FallbackUrl -Method GET -TimeoutSec 20 -UseBasicParsing
        }
    } catch {
        Write-Host "[$Timestamp] ⚠️ Server waking up or cold start: $($_.Exception.Message)" -ForegroundColor Red
        try {
            $null = Invoke-WebRequest -Uri $FallbackUrl -Method GET -TimeoutSec 30 -UseBasicParsing
            Write-Host "[$Timestamp] ✅ Fallback health check succeeded." -ForegroundColor Green
        } catch {}
    }
    Start-Sleep -Seconds $IntervalSec
}
