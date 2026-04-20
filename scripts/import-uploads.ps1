param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,

  [Parameter(Mandatory = $false)]
  [string]$TargetPath = "public/uploads"
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$targetRoot = if ([System.IO.Path]::IsPathRooted($TargetPath)) { $TargetPath } else { Join-Path $repoRoot $TargetPath }
$backupRoot = if ([System.IO.Path]::IsPathRooted($BackupPath)) { $BackupPath } else { Join-Path $repoRoot $BackupPath }

if (-not (Test-Path $backupRoot)) {
  throw "Backup path not found: $backupRoot"
}

# Allow backup root to either be the uploads folder itself or its parent.
$sourceRoot = if (Test-Path (Join-Path $backupRoot 'uploads')) {
  Join-Path $backupRoot 'uploads'
} else {
  $backupRoot
}

$subdirs = @('profiles', 'posts', 'communities', 'groups')

if (-not (Test-Path $targetRoot)) {
  New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
}

$copiedTotal = 0

foreach ($sub in $subdirs) {
  $src = Join-Path $sourceRoot $sub
  $dst = Join-Path $targetRoot $sub

  if (-not (Test-Path $dst)) {
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
  }

  if (Test-Path $src) {
    Copy-Item -Path (Join-Path $src '*') -Destination $dst -Recurse -Force -ErrorAction SilentlyContinue
    $count = (Get-ChildItem -Path $dst -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
    $copiedTotal += $count
    Write-Host "Restored $sub -> $dst (files now: $count)"
  } else {
    Write-Host "Skipped $sub (not found in backup)"
  }
}

Write-Host "Restore complete. Total files now present across upload folders: $copiedTotal"
