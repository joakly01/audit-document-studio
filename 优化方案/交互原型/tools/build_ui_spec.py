"""Build the offline reading edition and printable PDF from the canonical UI rules."""
from pathlib import Path
import base64,hashlib,html,json,re
from markdown_it import MarkdownIt
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];NORM=ROOT.parent/'UI界面规范'
files=['01-UI界面规范.md','16-UI交互规范核对记录.md'];source='\n\n'.join((NORM/n).read_text() for n in files);digest=hashlib.sha256((source+(NORM/'03-设计变量.json').read_text()).encode()).hexdigest()
md=MarkdownIt('commonmark',{'html':True}).enable('table');tokens=md.parse(source);toc=[];count=0
for i,t in enumerate(tokens):
 if t.type=='heading_open':
  if t.tag=='h1':t.tag='h2';tokens[i+2].tag='h2'
  count+=1;key='section-'+str(count);t.attrSet('id',key)
  if t.tag=='h2':toc.append((key,tokens[i+1].content))
body=md.renderer.render(tokens,md.options,{})
body=body.replace('<table>','<div class="table-scroll"><table>').replace('</table>','</table></div>')
def embed(m):
 path=NORM/m[1]
 if not path.is_file():return m[0]
 mime='image/svg+xml' if path.suffix=='.svg' else 'image/png'
 return 'src="data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()+'"'
body=re.sub(r'src="([^\"]+)"',embed,body)
shots=[]
for name,label in [('extract-no-template-1024.png','信息提取：Step 1 添加资料、Step 2 核对原文、Step 3 配置提取字段，1024×480工作区'),('task-center-1024.png','任务中心：工具成果、分析阶段与独立结果入口，1024×480'),('ui-conformance-meeting-1024.png','会议纪要分析：1024×480工作区'),('ui-conformance-word-390.png','词云分析：窄屏操作栏与配置')]:
 path=ROOT/'review'/name
 if path.exists():shots.append('<figure><img alt="'+label+'" src="data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()+'"><figcaption>'+label+'</figcaption></figure>')
css='''
:root{font-family:"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",Arial,sans-serif;color:#1e3046;background:#f4f6f9;font-size:16px;--muted:#596b80}*{box-sizing:border-box}body{margin:0;line-height:1.8}a{color:#2458c2;text-decoration:none}a:hover{text-decoration:underline}a:focus-visible,button:focus-visible{outline:3px solid #7aa8ff;outline-offset:3px}.skip{position:absolute;top:-100px;left:12px;background:#fff;padding:8px}.skip:focus{top:8px}.side{position:fixed;inset:0 auto 0 0;width:260px;padding:26px 20px;background:#fff;border-right:1px solid #dce3ed;display:flex;flex-direction:column;gap:15px}.side strong{font-size:18px}.side p,.side footer{font-size:14px;color:var(--muted)}.side nav{overflow:auto;flex:1}.side nav a{display:block;font-size:14px;line-height:1.6;padding:7px 4px}main{margin-left:260px;max-width:1500px;padding:32px 40px 64px;min-width:0}.hero{padding-bottom:24px}.hero h1{font-size:30px;line-height:1.4;margin:8px 0 12px}.hero p{color:var(--muted);margin:0}.version{display:inline-block;color:#2458c2;background:#eef4ff;font-size:14px;padding:3px 9px;border-radius:5px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.actions a,.actions button{border:1px solid #dce3ed;border-radius:7px;min-height:36px;background:#fff;color:#1e3046;padding:6px 12px;font:inherit;cursor:pointer}article{background:#fff;border:1px solid #e6ebf1;border-radius:10px;padding:26px 30px}h2{font-size:22px;line-height:1.5;border-top:1px solid #e6ebf1;margin:34px 0 14px;padding-top:22px;scroll-margin-top:15px}h3{font-size:18px;line-height:1.5;margin:24px 0 10px}h4{font-size:16px}p,li{overflow-wrap:anywhere}p{margin:12px 0}ul,ol{padding-left:24px}.table-scroll{overflow:auto;border:1px solid #dce3ed;border-radius:7px;margin:16px 0}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.8;text-align:left}td,th{padding:10px 12px;border-bottom:1px solid #e6ebf1;vertical-align:top;min-width:100px;overflow-wrap:anywhere}th{color:#52657b;background:#f5f7fa;font-weight:600}code{font:14px/1.7 ui-monospace,Consolas,monospace;background:#f5f7fa;padding:2px 4px;border-radius:3px;overflow-wrap:anywhere}blockquote{border-left:3px solid #b7cbe9;padding:8px 15px;margin:15px 0;color:var(--muted);background:#f7f9fc}figure{margin:20px 0}figure img{display:block;max-width:100%;height:auto;border:1px solid #dce3ed;border-radius:6px}figcaption{font-size:14px;color:var(--muted);margin-top:6px}td img{width:24px;height:24px;vertical-align:middle}.pagefoot{font-size:14px;color:var(--muted);margin-top:22px}
@media(max-width:1100px){.side{width:225px}main{margin-left:225px;padding:24px}article{padding:20px}}@media(max-width:760px){.side{position:static;width:auto;padding:16px}.side nav,.side footer{display:none}.side p{margin:0}main{margin:0;padding:16px}.hero h1{font-size:24px}article{padding:16px}h2{font-size:20px}}
@media print{*{print-color-adjust:exact;-webkit-print-color-adjust:exact}.side,.skip,.actions,.pagefoot{display:none}body{background:#fff;font-size:11pt}main{margin:0;padding:0;max-width:none}.hero h1{font-size:20pt}.hero p,.version{font-size:10pt}article{border:0;padding:0}h2{font-size:14pt;margin-top:18pt;padding-top:10pt;break-after:avoid}h3{font-size:12pt;break-after:avoid}.table-scroll{overflow:visible;border:0}table{font-size:10pt}td,th{padding:5pt 6pt;min-width:0}thead{display:table-header-group}tr,figure{break-inside:avoid}code{font-size:9pt}a{color:#1e3046}figcaption{font-size:9pt}@page{size:A4;margin:16mm 14mm}}
'''
nav=''.join('<a href="#'+k+'">'+html.escape(title)+'</a>' for k,title in toc)
doc='<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="source-sha256" content="'+digest+'"><title>UI交互规范 v1.3 · 审计文档挖掘助手</title><style>'+css+'</style></head><body><a class="skip" href="#content">跳转正文</a><aside class="side"><strong>文档挖掘助手</strong><p>UI与交互规范 · v1.3<br>核对日期：2026-10-19</p><nav aria-label="规范章节">'+nav+'</nav><footer>主规范为统一基线<br>规范要求与验收结论分开记录</footer></aside><main id="content"><header class="hero"><span class="version">v1.3 · 已合并最新交互规则</span><h1>UI与交互规范</h1><p>资料管理、提取模板、11项分析工具，以及配置、执行、核验和导出的统一规则。</p><div class="actions"><a href="UI界面规范-v1.3.pdf">下载PDF</a><button onclick="window.print()">打印</button><a href="02-界面验收清单.md">验收清单</a><a href="06-图标速查.html">图标速查</a></div></header><article>'+body+'<h2 id="screenshots">本轮界面对照</h2>'+''.join(shots)+'</article><p class="pagefoot">离线可阅读。外部参考链接仅在打开原站时联网；当前浏览器交互验收不替代正式后台联调或全系统无障碍认证。</p></main></body></html>'
output=NORM/'04-UI规范阅读版.html';output.write_text(doc)
with sync_playwright() as p:
 browser=p.chromium.launch(args=['--no-sandbox']);page=browser.new_page();page.route('http**://**',lambda route:route.abort());page.goto(output.as_uri(),wait_until='networkidle');page.evaluate('document.fonts.ready');page.pdf(path=str(NORM/'UI界面规范-v1.3.pdf'),format='A4',print_background=True,prefer_css_page_size=True);browser.close()
print(json.dumps({'html':str(output),'pdf':str(NORM/'UI界面规范-v1.3.pdf'),'source_sha256':digest},ensure_ascii=False))
