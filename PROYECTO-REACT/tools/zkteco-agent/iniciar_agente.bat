@echo off
cd /d "%~dp0"
echo Instalando dependencias del agente ZKTeco...
pip install -r requirements.txt
echo Iniciando agente ZKTeco (LAN/Wi-Fi + Pendrive USB)...
python zk_live_agent.py
pause
