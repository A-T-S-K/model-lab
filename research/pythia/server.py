"""Explicitly launched, loopback-only, bounded read-only inference bridge."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit
from adapter import NativePythia, validate_request


def serve(port, origin):
    u=urlsplit(origin)
    if u.scheme!='http' or u.hostname!='127.0.0.1' or not u.port or u.path or u.query or u.fragment or u.username:
        raise ValueError('Expected exact loopback application origin')
    model=NativePythia()
    epochs={}
    class Handler(BaseHTTPRequestHandler):
        def gate(self):
            return self.headers.get('Host')==f'127.0.0.1:{port}' and self.headers.get('Origin')==origin
        def reply(self,code,value):
            data=json.dumps(value,allow_nan=False,separators=(',',':')).encode()
            if len(data)>4_000_000: code,data=413,b'{"error":"Evidence byte budget"}'
            self.send_response(code)
            if self.gate():self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Vary','Origin');self.send_header('Cache-Control','no-store')
            self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        def do_OPTIONS(self):
            if not self.gate() or self.path!='/execute':return self.reply(403,{'error':'Origin/host/path refused'})
            self.send_response(204);self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Access-Control-Allow-Methods','POST');self.send_header('Access-Control-Allow-Headers','Content-Type');self.end_headers()
        def do_POST(self):
            self.connection.settimeout(10)
            if not self.gate() or self.path!='/execute':return self.reply(403,{'error':'Origin/host/path refused'})
            if self.headers.get('Content-Type')!='application/json' or self.headers.get('Transfer-Encoding'):
                return self.reply(415,{'error':'Only bounded JSON requests supported'})
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 1<=length<=4096:raise ValueError('Request byte budget')
                r=validate_request(json.loads(self.rfile.read(length)))
                old=epochs.get(r['sessionId'],(-1,set()))
                if r['epoch']<old[0] or r['requestId'] in old[1]:raise ValueError('Stale epoch or duplicate request')
                if r['sessionId'] not in epochs and len(epochs)>=128:raise ValueError('Session budget; restart bridge explicitly')
                ids=set() if r['epoch']>old[0] else old[1]
                if len(ids)>=128:raise ValueError('Request budget per epoch')
                ids.add(r['requestId']);epochs[r['sessionId']]=(r['epoch'],ids)
                self.reply(200,model.capture(r))
            except (ValueError,TypeError,KeyError,json.JSONDecodeError) as e:self.reply(400,{'error':str(e)})
            except Exception as e:self.reply(500,{'error':type(e).__name__+': native execution failed; no fallback'})
        def do_GET(self):self.reply(405,{'error':'Only explicit POST /execute is supported'})
    print(json.dumps({'ready':True,'port':port,'origin':origin,'runtime':model.runtime}),flush=True)
    HTTPServer(('127.0.0.1',port),Handler).serve_forever()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,required=True);parser.add_argument('--origin',required=True)
    args=parser.parse_args();serve(args.port,args.origin)
