"""Start the local website, wait for readiness, then open the browser."""
from pathlib import Path
import subprocess, sys, time, urllib.request, webbrowser, os
root = Path(__file__).resolve().parent
server = root / 'server'
url = 'http://127.0.0.1:8000/'
def ready():
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return response.status == 200 and b'dawnsea' in response.read().lower()
    except Exception:
        return False
if not ready():
    try:
        import django, whitenoise, PIL
    except ImportError:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', str(server/'requirements.txt')], check=True)
    subprocess.run([sys.executable, 'manage.py', 'migrate', '--noinput'], cwd=server, check=True)
    log = open(root/'server.log', 'a', encoding='utf-8')
    subprocess.Popen([sys.executable, 'manage.py', 'runserver', '127.0.0.1:8000', '--noreload'], cwd=server, stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    for attempt in range(60):
        if ready(): break
        time.sleep(0.5)
    else:
        raise RuntimeError('Website did not start. See server.log in this folder.')
print('Website ready: ' + url)
webbrowser.open(url)
