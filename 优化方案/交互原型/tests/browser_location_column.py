import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':600},reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle');page.wait_for_function("typeof auditUploadPlan!=='undefined'")
 assert page.locator('.lib-table thead th').all_text_contents()==['','名称','文档状态','所有者','位置','上传时间','操作']
 assert page.locator('[data-file-id="d2"] .lib-location-cell').inner_text()=='项目空间 / 根目录'
 assert page.locator('tr[data-folder-path="合同资料"] .lib-location-cell').inner_text()=='项目空间 / 根目录'
 page.evaluate("state.libraryRecursive=true;render()")
 cells=page.locator('.lib-table .lib-location-cell');assert cells.count()>0
 for cell in cells.all():assert cell.inner_text()==cell.get_attribute('title')
 checks.append('固定位置列与原表顺序一致，文件和文件夹显示所属空间及父目录，长路径有完整提示')
 for w,h in [(1366,600),(1024,480),(390,600)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100);assert page.locator('.lib-col-location').is_visible();assert page.locator('.lib-location-cell').first.is_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight');page.screenshot(path=str(root/f'review/location-column-{w}.png'),animations='disabled')
 checks.append('低分辨率及手机保留位置列，使用表格内部横向滚动，不撑宽整页')
 assert not errors,errors;(root/'review/location-column-results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));b.close()
