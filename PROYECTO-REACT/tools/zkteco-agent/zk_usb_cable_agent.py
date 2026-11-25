"""
Agente para relojes ZKTeco con puerto USB-Client directo a PC usando zkemkeeper.dll.
Requisitos en Windows:
  1. Instalar SDK de ZKTeco (zkemkeeper.dll) y registrarlo con regsvr32.
  2. pip install pywin32 requests
"""
import configparser
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests

try:
    import win32com.client
except ImportError:
    print("[ERROR] Instala pywin32: pip install pywin32")
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.ini"


def main():
    cfg = configparser.ConfigParser()
    cfg.read(CONFIG_PATH, encoding="utf-8")

    device_name = cfg.get("zkteco", "device_name", fallback="ZKTECO_USB_CABLE").strip()
    days = cfg.getint("zkteco", "sincronizar_ultimos_dias", fallback=7)
    interval = cfg.getfloat("zkteco", "intervalo_segundos", fallback=3.0)
    server_url = cfg.get("servidor", "server_url").strip()
    zk_token = cfg.get("servidor", "zk_token").strip()

    if not zk_token or "REEMPLAZA" in zk_token:
        print("[AVISO] Configura 'zk_token' en config.ini antes de iniciar.")
        sys.exit(1)

    zk = win32com.client.Dispatch("zkemkeeper.CZKEM")
    if not zk.Connect_USB(1):
        print("[ERROR] No se pudo conectar por USB al reloj ZKTeco (Connect_USB(1) falló).")
        sys.exit(1)

    print(f"[CONECTADO] Reloj ZKTeco por cable USB -> {server_url}")
    sent_cache = set()
    first_sync = True

    while True:
        try:
            cutoff = datetime.now() - timedelta(days=days)
            origen = "ZK_SYNC" if first_sync else "ZK_USB"
            pending = []

            if zk.ReadGeneralLogData(1):
                while True:
                    ret = zk.SSR_GetGeneralLogData(1)
                    # ret puede variar según versión del COM wrapper: (ok, enrollNumber, verifyMode, inOutMode, year, month, day, hour, minute, second, workCode)
                    if not ret or not ret[0]:
                        break
                    enroll_num = str(ret[1]).strip()
                    yr, mo, dy, hr, mn, sc = ret[4], ret[5], ret[6], ret[7], ret[8], ret[9]
                    ts = datetime(yr, mo, dy, hr, mn, sc)
                    if ts < cutoff:
                        continue
                    fh = ts.strftime("%Y-%m-%d %H:%M:%S")
                    key = (enroll_num, fh)
                    if key in sent_cache:
                        continue
                    pending.append({
                        "dni": enroll_num,
                        "fechaHora": fh,
                        "origen": origen,
                        "dispositivo": f"{device_name}_USB_CABLE",
                    })

            if pending:
                headers = {"Content-Type": "application/json", "X-ZK-Token": zk_token}
                for i in range(0, len(pending), 200):
                    chunk = pending[i:i + 200]
                    resp = requests.post(
                        server_url,
                        json={"origen": origen, "dispositivo": device_name, "marcaciones": chunk},
                        headers=headers,
                        timeout=15,
                    )
                    resp.raise_for_status()
                    for item in chunk:
                        sent_cache.add((item["dni"], item["fechaHora"]))
                    print(f"[{origen}] Enviadas {len(chunk)} marcas -> {resp.json()}")
            first_sync = False
        except Exception as exc:
            print(f"[USB CABLE ERROR] {exc}")

        time.sleep(interval)


if __name__ == "__main__":
    main()
