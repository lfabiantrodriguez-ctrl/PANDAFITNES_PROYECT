import argparse
import configparser
import hashlib
import os
import string
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
from zk import ZK

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.ini"


def load_config():
    cfg = configparser.ConfigParser()
    if not CONFIG_PATH.exists():
        print(f"[ERROR] No existe {CONFIG_PATH}")
        sys.exit(1)
    cfg.read(CONFIG_PATH, encoding="utf-8")
    return cfg


def send_batch(server_url, zk_token, batch, origen, device_name):
    headers = {
        "Content-Type": "application/json",
        "X-ZK-Token": zk_token,
    }
    payload = {
        "origen": origen,
        "dispositivo": device_name,
        "marcaciones": batch,
    }
    resp = requests.post(server_url, json=payload, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()


def parse_attlog_file(file_path, device_name):
    marks = []
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.replace(",", "\t").replace(";", "\t").split("\t") if p.strip()]
            if len(parts) < 2:
                continue
            dni = "".join(ch for ch in parts[0] if ch.isdigit())
            fh = parts[1]
            if not dni or len(fh) < 16:
                continue
            if len(fh) == 16:
                fh = f"{fh}:00"
            marks.append({
                "dni": dni,
                "fechaHora": fh,
                "origen": "ZK_ARCHIVO",
                "dispositivo": device_name,
            })
    return marks


def scan_usb_drives(server_url, zk_token, filenames, seen_hashes, device_name):
    if os.name != "nt":
        return
    for letter in string.ascii_uppercase:
        if letter in ("C", "D"):
            continue
        root = Path(f"{letter}:\\")
        if not root.exists():
            continue
        for name in filenames:
            candidate = root / name
            if not candidate.is_file():
                continue
            try:
                content = candidate.read_bytes()
                digest = hashlib.sha256(content).hexdigest()
                if seen_hashes.get(str(candidate)) == digest:
                    continue
                marks = parse_attlog_file(candidate, f"{device_name}_USB")
                if not marks:
                    seen_hashes[str(candidate)] = digest
                    continue
                for i in range(0, len(marks), 200):
                    res = send_batch(server_url, zk_token, marks[i:i + 200], "ZK_ARCHIVO", f"{device_name}_USB")
                    print(f"[USB {candidate}] Enviado lote: {res}")
                seen_hashes[str(candidate)] = digest
            except Exception as exc:
                print(f"[USB ERROR] {candidate}: {exc}")


def run_agent(usb_only=False):
    cfg = load_config()
    ip = cfg.get("zkteco", "ip", fallback="192.168.1.201").strip()
    port = cfg.getint("zkteco", "port", fallback=4370)
    password = cfg.getint("zkteco", "password", fallback=0)
    device_name = cfg.get("zkteco", "device_name", fallback="ZKTECO_K20").strip()
    days = cfg.getint("zkteco", "sincronizar_ultimos_dias", fallback=7)
    interval = cfg.getfloat("zkteco", "intervalo_segundos", fallback=2.0)

    server_url = cfg.get("servidor", "server_url").strip()
    zk_token = cfg.get("servidor", "zk_token").strip()

    usb_enabled = cfg.getboolean("usb_pendrive", "habilitado", fallback=True)
    usb_files = [
        x.strip()
        for x in cfg.get("usb_pendrive", "archivo_nombres", fallback="attlog.dat,1_attlog.dat").split(",")
        if x.strip()
    ]

    if not zk_token or "REEMPLAZA" in zk_token:
        print("[AVISO] Configura 'zk_token' en config.ini antes de iniciar.")
        sys.exit(1)

    sent_cache = set()
    usb_hashes = {}
    first_sync = True

    print(f"[INICIO] Panda Fitness ZKTeco Agent -> {server_url}")
    if not usb_only:
        print(f"[RELOJ] Escuchando {ip}:{port} cada {interval}s")
    if usb_enabled:
        print(f"[USB] Vigilando pendrives ({', '.join(usb_files)})")

    while True:
        if usb_enabled or usb_only:
            scan_usb_drives(server_url, zk_token, usb_files, usb_hashes, device_name)

        if not usb_only:
            conn = None
            try:
                zk = ZK(ip, port=port, timeout=8, password=password, force_udp=False, ommit_ping=True)
                conn = zk.connect()
                attendances = conn.get_attendance() or []
                cutoff = datetime.now() - timedelta(days=days)
                origen = "ZK_SYNC" if first_sync else "ZK_LIVE"

                pending = []
                for att in attendances:
                    ts = att.timestamp
                    if ts < cutoff:
                        continue
                    fh_str = ts.strftime("%Y-%m-%d %H:%M:%S")
                    dni = str(att.user_id).strip()
                    key = (dni, fh_str)
                    if key in sent_cache:
                        continue
                    pending.append({
                        "dni": dni,
                        "fechaHora": fh_str,
                        "origen": origen,
                        "dispositivo": device_name,
                    })

                if pending:
                    for i in range(0, len(pending), 200):
                        chunk = pending[i:i + 200]
                        res = send_batch(server_url, zk_token, chunk, origen, device_name)
                        for item in chunk:
                            sent_cache.add((item["dni"], item["fechaHora"]))
                        print(f"[{origen}] +{len(chunk)} marcas -> entradas={res.get('entradas')} salidas={res.get('salidas')}")

                first_sync = False
            except Exception as exc:
                print(f"[RELOJ ERROR] {exc}")
            finally:
                if conn:
                    try:
                        conn.disconnect()
                    except Exception:
                        pass

        time.sleep(interval)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agente ZKTeco LAN/Wi-Fi + Pendrive USB para Panda Fitness")
    parser.add_argument("--usb-only", action="store_true", help="Solo vigilar memorias USB sin conectar por TCP")
    args = parser.parse_args()
    run_agent(usb_only=args.usb_only)
