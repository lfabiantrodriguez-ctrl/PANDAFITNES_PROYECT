@echo off
cd /d "%~dp0"
echo Instalando dependencias para Cable USB (zkemkeeper)...
pip install pywin32 requests
echo Iniciando agente ZKTeco por Cable USB...
python zk_usb_cable_agent.py
pause
