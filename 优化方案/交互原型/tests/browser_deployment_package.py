"""Extract the delivered archive into a clean directory and test that exact payload."""
from pathlib import Path
from tempfile import TemporaryDirectory
import os,hashlib,json,socket,subprocess,sys,time,urllib.request,zipfile
from playwright.sync_api import sync_playwright

app=Path(__file__).resolve().parents[1]
package_date=os.environ.get('AUDIT_PACKAGE_DATE','20261021')
archive=app.parent/f'部署交付/文档挖掘助手-前端部署包-{package_date}.zip'
checks=[];errors=[]
with TemporaryDirectory(prefix='audit-deploy-package-') as temporary:
    target=Path(temporary)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert all(not Path(n).is_absolute() and '..' not in Path(n).parts for n in z.namelist())
        assert not any('/.git/' in n or '/node_modules/' in n or '/.openai/' in n for n in z.namelist())
        z.extractall(target)
    release=target/f'audit-document-studio-{package_date}'
    def verify():
        return subprocess.run([sys.executable,str(release/'deploy/verify-package.py')],capture_output=True,text=True)
    result=verify();assert result.returncode==0,result.stderr
    subprocess.run(['bash','-n',str(release/'deploy/local-deploy.sh')],check=True)
    result=subprocess.run(['bash',str(release/'deploy/local-deploy.sh'),'--check'],capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    assert not (release/'.git').exists()
    original=(release/'dist/tool-workspaces.js').read_bytes()
    (release/'dist/tool-workspaces.js').write_bytes(original+b'\n// changed\n')
    assert verify().returncode!=0
    (release/'dist/tool-workspaces.js').write_bytes(original)
    raw=(release/'dist/source-files/d1.pdf').read_bytes()
    (release/'dist/source-files/d1.pdf').unlink()
    assert verify().returncode!=0
    (release/'dist/source-files/d1.pdf').write_bytes(raw)
    assert verify().returncode==0
    for f in (app/'dist').rglob('*'):
        if f.is_file():assert f.read_bytes()==(release/'dist'/f.relative_to(app/'dist')).read_bytes()
    checks.append(f'ZIP完整解压，{len((release/"SHA256SUMS").read_text().splitlines())}项文件指纹、所有页面依赖及原格式资料通过校验；篡改文件/缺失原件均被识别；无需Git即可预检部署')
    with socket.socket() as s:
        s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    server=subprocess.Popen([sys.executable,str(release/'deploy/preview.py'),'--port',str(port)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    base=f'http://127.0.0.1:{port}'
    try:
        for i in range(100):
            try:
                if urllib.request.urlopen(base+'/healthz',timeout=1).status==200:break
            except OSError:time.sleep(.05)
        else:raise AssertionError('preview server did not start')
        with sync_playwright() as p:
            b=p.chromium.launch(args=['--no-sandbox'])
            g=b.new_page(viewport={'width':1366,'height':768})
            g.on('pageerror',lambda e:errors.append(str(e)))
            assert g.request.get(base+'/vendor/pdfjs/pdf.min.mjs').headers['content-type'].startswith('application/javascript')
            assert g.request.get(base+'/README-部署说明.md').status==404
            assert g.request.get(base+'/.git/config').status==404
            g.goto(base+'/#library',wait_until='load');g.wait_for_function("typeof twBase!=='undefined'");g.evaluate('async()=>{await libraryStatusDataReady;return true}')
            for route in ['library','tasks','templates']:
                g.evaluate('v=>nav(v)',route)
                assert g.evaluate('state.view')==route
            for tool in g.evaluate('TOOLS.map(t=>t.id)'):
                g.evaluate("id=>{nav('tool',id);render()}",tool)
                assert g.evaluate('state.toolId')==tool
                assert g.locator('.ew-workspace').is_visible(),tool
            for fid,kind in [('d1','pdf'),('d3','docx'),('d10','table')]:
                g.evaluate("id=>{nav('tool','extract');ws().ids=[id];ws().preview=id;render()}",fid)
                g.wait_for_function("kind=>document.querySelector('#ef-raw-content')?.dataset.rawReady===kind",arg=kind,timeout=25000)
            g.screenshot(path=str(app/'review/deployment-package-preview.png'),animations='disabled')
            assert not errors,errors
            b.close()
        checks.append('从干净解压目录启动预览，资料/任务/模板及11工具可进入，PDF/Word/Excel实际预览通过；正文和原件均来自包内资源')
        checks.append('解压预览仅发布dist，模块MIME正确，部署说明/Git目录不可通过网站访问')
    finally:
        server.terminate();server.wait(timeout=5)
result={'archive':str(archive),'sizeBytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'checks':checks,'errors':errors}
(app/'review/deployment-package-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False))
