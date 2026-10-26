"""Check that deliverable rules and design tokens no longer contradict the current interaction choices."""
from pathlib import Path
import hashlib,json,re
root=Path(__file__).resolve().parents[1];norm=root.parent/'UI界面规范';main=(norm/'01-UI界面规范.md').read_text();report=(norm/'16-UI交互规范核对记录.md').read_text();tokens=json.loads((norm/'03-设计变量.json').read_text());reading=(norm/'04-UI规范阅读版.html').read_text();checks=[]
assert '版本：1.3' in main and tokens['metadata']['version']=='1.3';assert tokens['responsive']['textSearchPlacement']=='more-first';assert all('textSearch' not in tokens['responsive'][key] for key in ['wide','medium','narrow']);assert tokens['selection']['listSortPlacement']=='removed';assert not tokens['workspace']['locationLockIcon'] and not tokens['workspace']['libraryTaskCenter'] and not tokens['workspace']['directoryFooterCreate'];assert tokens['workspace']['uploadLabel']=='上传';assert tokens['spaceOrder']==['公共空间','项目空间','个人空间'];assert tokens['font']['size']['body']==16 and tokens['font']['size']['caption']==14 and tokens['font']['size']['tool']==18 and tokens['font']['size']['dialog']==20
checks.append('主规范与变量：版本、检索、排序、新建、锁/任务入口、上传文案、空间顺序与字号一致')
source=main+'\n\n'+report;digest=hashlib.sha256((source+(norm/'03-设计变量.json').read_text()).encode()).hexdigest();assert 'content="'+digest+'"' in reading;assert 'v1.3' in reading and 'UI界面规范-v1.3.pdf' in reading;assert all(x in reading for x in ['本页','用户新词','七部分','1024','普通内容18px']);assert (norm/'UI界面规范-v1.3.pdf').read_bytes().startswith(b'%PDF-')
checks.append('HTML源内容指纹对应主规范/核对记录/设计变量，PDF链接、最新业务规则与中文内容齐全')
registry=json.loads((norm/'07-图标注册表.json').read_text());assert registry['version']=='1.3';assert len([i['id'] for i in registry['icons']])==len(set(i['id'] for i in registry['icons']));assert all((norm/i['asset']).is_file() for i in registry['icons']);assert {'list','copy','more','plus'}.issubset({i['id'] for i in registry['icons']})
checks.append('图标登记无重名，SVG资产齐全，清单/复制/更多/添加语义分开')
for i in range(8,16):
 p=next(norm.glob(f'{i:02d}-*.md'));assert '有效规则已合并至v1.3主规范' in p.read_text()
checks.append('08–15增补统一标注追溯及主规范优先，不再存在互相竞争的执行口径')
result={'date':'2026-10-19','version':'1.3','checks':checks,'source_sha256':digest};(root/'review/ui-spec-consistency.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));(norm/'review/ui-spec-consistency.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))
