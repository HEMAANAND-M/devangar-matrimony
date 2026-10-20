# Dumps the database to backups\devangar-YYYYMMDD-HHMMSS.sql.gz and keeps the newest 14 copies.
# Usage:  $env:DATABASE_URL = "postgresql://..."; .\scripts\backup.ps1 [-Dir backups]
# Schedule daily with Task Scheduler (powershell -File scripts\backup.ps1).
param([string]$Dir = "backups", [int]$Keep = 14)
$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) { throw "DATABASE_URL must be set" }
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) { throw "pg_dump not found; add PostgreSQL's bin folder to PATH" }
New-Item -ItemType Directory -Force $Dir | Out-Null

# pg_dump does not understand Prisma's ?schema= parameter.
$url = $env:DATABASE_URL.Split("?")[0]
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$sql = Join-Path $Dir "devangar-$stamp.sql"
$gz = "$sql.gz"

& pg_dump --no-owner --no-privileges --file $sql $url
if ($LASTEXITCODE -ne 0) { Remove-Item $sql -ErrorAction SilentlyContinue; throw "pg_dump failed ($LASTEXITCODE)" }

$in = [IO.File]::OpenRead($sql)
$out = [IO.File]::Create($gz)
$zip = New-Object IO.Compression.GZipStream($out, [IO.Compression.CompressionLevel]::Optimal)
try { $in.CopyTo($zip) } finally { $zip.Dispose(); $out.Dispose(); $in.Dispose() }
Remove-Item $sql
Write-Output ("Backup written: {0} ({1:N1} MB)" -f $gz, ((Get-Item $gz).Length / 1MB))

Get-ChildItem $Dir -Filter "devangar-*.sql.gz" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep | Remove-Item
