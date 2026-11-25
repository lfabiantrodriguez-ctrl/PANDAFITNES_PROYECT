@echo off
cd /d "%~dp0"
echo Instalando dependencias del puente USB...
pip install -r requirements.txt
echo Iniciando puente local de lector USB en http://127.0.0.1:9090 ...
python usb_reader_bridge.py
pause
