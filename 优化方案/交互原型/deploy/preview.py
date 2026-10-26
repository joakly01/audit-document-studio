#!/usr/bin/env python3
"""Local package preview; static files are served from dist only."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
import argparse

parser = argparse.ArgumentParser(description='Preview the packaged front end')
parser.add_argument('--host', default='127.0.0.1')
parser.add_argument('--port', default=8080, type=int)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent / 'dist'

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.mjs': 'application/javascript', '.js': 'application/javascript'}
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(root), **kw)
    def list_directory(self, path):
        self.send_error(404)
        return None
    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if any(part.startswith('.') for part in path.split('/')):
            self.send_error(404)
            return
        if path == '/healthz':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', '3')
            self.end_headers()
            self.wfile.write(b'ok\n')
            return
        super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

class Server(ThreadingHTTPServer):
    request_queue_size = 128

if not (root / 'index.html').is_file():
    parser.error('dist/index.html is missing')
print(f'Preview: http://{args.host}:{args.port}/#library', flush=True)
with Server((args.host, args.port), Handler) as server:
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
