@echo off
setlocal
title Panda Fitness - Local
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js en esta computadora.
  pause
  exit /b 1
)
node "%~dp0iniciar-panda.cjs"
pause
