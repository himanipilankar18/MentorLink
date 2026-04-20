param(
  [Parameter(Mandatory = $false)]
  [string]$SourcePath = "public/uploads",

  [Parameter(Mandatory = $false)]
  [string]$BackupRoot = "_local_backups/uploads"
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$sourceRoot = if ([System.IO.Path]::IsPathRooted($SourcePath)) { $SourcePath } else { Join-Path $repoRoot $SourcePath }
$backupBase = if ([System.IO.Path]::IsPathRooted($BackupRoot)) { $BackupRoot } else { Join-Path $repoRoot $BackupRoot }

if (-not (Test-Path $sourceRoot)) {
  throw "Uploads source path not found: $sourceRoot"
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dest = Join-Path $backupBase "uploads-$stamp"

New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -Path $sourceRoot -Destination $dest -Recurse -Force

$fileCount = (Get-ChildItem -Path (Join-Path $dest 'uploads') -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "Backup created at: $dest"
Write-Host "Backed up files: $fileCount"
