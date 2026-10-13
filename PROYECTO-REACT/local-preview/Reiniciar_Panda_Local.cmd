@echo off
setlocal
cd /d "%~dp0..\backend"
if not exist "src\server.js" (
  echo No se encontro el backend de Panda Fitness.
  pause
  exit /b 1
)
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; try { $listeners=@(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue); $ids=@($listeners | Select-Object -ExpandProperty OwningProcess -Unique); foreach($serverId in $ids) { $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$serverId); if($proc.Name -ne 'node.exe' -or $proc.CommandLine -notmatch 'src[\\/]server\.js') { throw 'El puerto 3000 pertenece a otro proceso. No se modifico.' }; $health=Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 5; if($health.ok -ne $true) { throw 'El servicio del puerto 3000 no responde como el backend esperado.' }; $parent=Get-CimInstance Win32_Process -Filter ('ProcessId='+$proc.ParentProcessId); if($parent.Name -eq 'node.exe' -and $parent.CommandLine -match 'nodemon' -and $parent.CommandLine -match 'src[\\/]server\.js') { Stop-Process -Id $parent.ProcessId -ErrorAction SilentlyContinue }; Stop-Process -Id $serverId -ErrorAction SilentlyContinue }; exit 0 } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo No se pudo reiniciar automaticamente. No se inicio otro servidor.
  pause
  exit /b 1
)
echo Iniciando Panda Fitness local. Deja esta ventana abierta.
echo Pagina: http://localhost:8081/app/mi-pandita
node src\server.js
pause
