@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 20 or newer to preview this website.
  pause
  exit /b 1
)
if exist "%~dp0..\Soft 99.9\release\Soft-99.9-Windows-Free.zip" set "SOFT999_PREVIEW_RELEASE=%~dp0..\Soft 99.9\release\Soft-99.9-Windows-Free.zip"
node scripts/serve.mjs --open
pause
