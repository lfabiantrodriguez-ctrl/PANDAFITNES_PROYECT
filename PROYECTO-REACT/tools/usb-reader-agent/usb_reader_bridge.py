"""
Puente local HTTP (http://127.0.0.1:9090) para lectores USB de escritorio:
  - ZKTeco ZK4500 / ZK9500 (ZKFinger SDK)
  - DigitalPersona U.are.U 4500 (OneTouch SDK)

Permite desde el navegador en Panda Fitness:
  1. GET  /health   -> verificar si el puente y lector USB están activos
  2. POST /capture  -> capturar una huella y devolver su plantilla Base64
  3. POST /identify -> identificar 1:N comparando contra las huellas de MySQL
"""
import configparser
import json
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.ini"


def load_config():
    cfg = configparser.ConfigParser()
    cfg.read(CONFIG_PATH, encoding="utf-8")
    return cfg


class UsbBiometricDriver:
    def __init__(self, mode="auto"):
        self.mode = mode
        self.driver_name = "none"
        self.zk_engine = None
        self.dp_capture = None
        self._init_driver()

    def _init_driver(self):
        try:
            import win32com.client  # type: ignore
        except ImportError:
            self.driver_name = "no_pywin32"
            return

        if self.mode in ("auto", "zkfcom"):
            for prog_id in ("ZKFPEngXControl.ZKFPEngX", "zkemkeeper.CZKEM"):
                try:
                    eng = win32com.client.Dispatch(prog_id)
                    if hasattr(eng, "InitEngine") and eng.InitEngine() == 0:
                        self.zk_engine = eng
                        self.driver_name = "ZKFINGER"
                        return
                except Exception:
                    pass

        if self.mode in ("auto", "dp_com"):
            try:
                cap = win32com.client.Dispatch("DPFPCtlX.DPFPCapture")
                self.dp_capture = cap
                self.driver_name = "DIGITALPERSONA"
                return
            except Exception:
                pass

        self.driver_name = "no_sdk_detected"

    @property
    def connected(self):
        return self.driver_name in ("ZKFINGER", "DIGITALPERSONA")

    def capture_template(self):
        if self.driver_name == "ZKFINGER" and self.zk_engine:
            # Lectura sincrónica de plantilla si el SDK ZKFinger está activo
            tpl = self.zk_engine.GetTemplateAsString()
            if tpl:
                return {"template": str(tpl), "formato": "ZKFINGER"}
            raise RuntimeError("Coloca el dedo en el lector ZKTeco e inténtalo de nuevo.")
        raise RuntimeError(
            "No se detectó un lector USB físico activo (instala ZKFinger SDK o DigitalPersona SDK + pywin32)."
        )

    def match_template(self, live_template, stored_templates):
        if self.driver_name == "ZKFINGER" and self.zk_engine:
            for item in stored_templates:
                try:
                    if self.zk_engine.VerFingerFromStr(live_template, item["template"], False, False):
                        return item
                except Exception:
                    continue
            return None

        # Comparación exacta para plantillas capturadas con el mismo puente
        for item in stored_templates:
            if item.get("template") == live_template:
                return item
        return None


CFG = load_config()
DRIVER = UsbBiometricDriver(CFG.get("lector", "driver", fallback="auto").strip())
TEMPLATE_CACHE = []
CACHE_LOCK = threading.Lock()


def sync_templates_loop():
    base_url = CFG.get("servidor", "base_url").strip().rstrip("/")
    zk_token = CFG.get("servidor", "zk_token").strip()
    interval = CFG.getint("servidor", "sync_templates_seconds", fallback=30)

    while True:
        if zk_token and "REEMPLAZA" not in zk_token:
            try:
                resp = requests.get(
                    f"{base_url}/usb/huellas",
                    headers={"X-ZK-Token": zk_token},
                    timeout=10,
                )
                if resp.ok:
                    data = resp.json()
                    with CACHE_LOCK:
                        TEMPLATE_CACHE[:] = data.get("huellas", [])
            except Exception as exc:
                print(f"[SYNC USB] {exc}")
        time.sleep(interval)


class Handler(BaseHTTPRequestHandler):
    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            with CACHE_LOCK:
                count = len(TEMPLATE_CACHE)
            self._json(200, {
                "ok": True,
                "driver": DRIVER.driver_name,
                "readerConnected": DRIVER.connected,
                "deviceName": CFG.get("lector", "device_name", fallback="LECTOR_USB"),
                "cachedTemplates": count,
            })
            return
        self._json(404, {"ok": False, "message": "Ruta no encontrada"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            body = json.loads(raw.decode("utf-8"))
        except Exception:
            body = {}

        if self.path == "/capture":
            try:
                result = DRIVER.capture_template()
                self._json(200, {
                    "ok": True,
                    "dispositivo": CFG.get("lector", "device_name", fallback="LECTOR_USB"),
                    **result,
                })
            except Exception as exc:
                self._json(400, {"ok": False, "message": str(exc)})
            return

        if self.path == "/identify":
            try:
                live = body.get("template")
                if not live:
                    cap = DRIVER.capture_template()
                    live = cap["template"]
                with CACHE_LOCK:
                    candidates = list(TEMPLATE_CACHE)
                matched = DRIVER.match_template(live, candidates)
                if not matched:
                    self._json(404, {"ok": False, "message": "Huella no reconocida en la base de datos."})
                    return

                base_url = CFG.get("servidor", "base_url").strip().rstrip("/")
                zk_token = CFG.get("servidor", "zk_token").strip()
                if zk_token and "REEMPLAZA" not in zk_token:
                    requests.post(
                        f"{base_url}/marcaciones",
                        headers={"Content-Type": "application/json", "X-ZK-Token": zk_token},
                        json={
                            "origen": "USB_LECTOR",
                            "dispositivo": CFG.get("lector", "device_name", fallback="LECTOR_USB"),
                            "marcaciones": [{
                                "dni": matched["dni"],
                                "fechaHora": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                "origen": "USB_LECTOR",
                            }],
                        },
                        timeout=10,
                    )

                self._json(200, {
                    "ok": True,
                    "dni": matched["dni"],
                    "nombre": f"{matched.get('nombre', '')} {matched.get('apellido', '')}".strip(),
                })
            except Exception as exc:
                self._json(400, {"ok": False, "message": str(exc)})
            return

        self._json(404, {"ok": False, "message": "Ruta no encontrada"})

    def log_message(self, fmt, *args):
        return


def main():
    port = CFG.getint("lector", "listen_port", fallback=9090)
    threading.Thread(target=sync_templates_loop, daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"[USB BRIDGE] http://127.0.0.1:{port} (driver={DRIVER.driver_name}, connected={DRIVER.connected})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[USB BRIDGE] Detenido.")
        sys.exit(0)


if __name__ == "__main__":
    main()
