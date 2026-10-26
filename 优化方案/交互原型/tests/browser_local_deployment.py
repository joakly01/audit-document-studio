"""Verify the deployed IP/HTTP site, including module MIME and preview tokens."""
import argparse
import hashlib
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://43.128.232.108')
base=parser.parse_args().url.rstrip('/')
root=Path(__file__).resolve().parents[1]
checks=[]
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1366,'height':768})
 page.on('pageerror',lambda e:errors.append(str(e)))
 health=page.request.get(base+'/healthz')
 assert health.status==200 and health.text().strip()=='ok'
 module=page.request.get(base+'/vendor/pdfjs/pdf.min.mjs')
 assert module.status==200 and 'javascript' in module.headers['content-type']
 assert page.request.get(base+'/.git/config').status==404
 assert page.request.get(base+'/missing-asset.js').status==404
 pdf_range=page.request.get(base+'/source-files/d1.pdf',headers={'Range':'bytes=0-99'})
 assert pdf_range.status==206 and len(pdf_range.body())==100
 checks.append({'health':True,'moduleMime':True,'sourceTreeNotServed':True,'pdfRange':True})
 for route,selector in [('library','.lib-workspace'),('tool/extract','.ef-preparing'),('tasks','.tc-page'),('templates','.xt-page')]:
  response=page.goto(base+'/#'+route,wait_until='networkidle')
  page.wait_for_load_state('load')
  page.wait_for_function("typeof twBase!=='undefined'")
  page.evaluate('async()=>{await libraryStatusDataReady;return true}')
  actual=page.evaluate('state.view')
  assert actual==route.split('/')[0],(route,actual)
  if route!='library':assert page.locator(selector).is_visible(),route
  checks.append({'route':route,'http':response.status if response else 200,'view':actual})
 page.goto(base+'/#tool/extract',wait_until='networkidle')
 page.wait_for_load_state('load')
 page.wait_for_function("typeof twBase!=='undefined'")
 page.evaluate('async()=>{await libraryStatusDataReady;return true}')
 assert page.locator('.ef-config').is_visible()
 assert page.evaluate('ewConfig().fieldDefs.length')==0
 assert page.evaluate("(()=>{const ids=Array.from({length:1000},()=>crypto.randomUUID());return ids.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))&&new Set(ids).size===1000})()")
 checks.append({'uuidFormatAndUniqueness':True,'secureContext':page.evaluate('isSecureContext')})
 for ext,ready in [('pdf','pdf'),('docx','docx'),('xlsx','table')]:
  target=page.evaluate("ext=>state.docs.find(d=>d.name.toLowerCase().endsWith('.'+ext)&&AUDIT_SOURCE_ASSETS[d.id]&&ewAllowed(d))?.id",ext)
  assert target,ext
  page.evaluate("id=>{ws().ids=[id];ws().preview=id;render()}",target)
  page.wait_for_function("type=>document.querySelector('#ef-raw-content')?.dataset.rawReady===type",arg=ready,timeout=20000)
  checks.append({'preview':ext,'fileId':target,'rendered':True})
 page.screenshot(path=str(root/'review/local-deployment-extract.png'),animations='disabled')
 assert not errors,errors
 output={'baseUrl':base,'indexSha256':hashlib.sha256((root/'dist/index.html').read_bytes()).hexdigest(),'checks':checks,'errors':errors}
 (root/'review/local-deployment-checks.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
 print(json.dumps(output,ensure_ascii=False))
 browser.close()
