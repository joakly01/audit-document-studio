import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];expected=['公共空间','项目空间','个人空间'];checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox']);page=b.new_page(viewport={'width':1366,'height':768},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/#library',wait_until='networkidle')
 assert page.locator('[data-lib-change="space"] option').all_text_contents()==expected
 page.evaluate("state.librarySelected=['d1','d2'];render()")
 assert page.locator('.lib-pagination .lib-header-selection [data-action="library-selected"]').inner_text()=='已选 2 份'
 assert page.locator('.lib-selection').count()==0
 svg=page.locator('.lib-table [data-action="lib-folder-menu"] svg').first
 assert svg.locator('circle').count()==3 and svg.locator('g').get_attribute('fill')=='currentColor' and svg.locator('g').get_attribute('stroke')=='none'
 page.locator('.lib-overflow>summary').click();page.locator('[data-lib-change="sort"]').select_option('name')
 assert page.evaluate("librarySort==='name'")
 page.locator('.lib-overflow>summary').click();page.locator('[data-action="lib-move-selected"]').click();assert page.locator('#lib-move-space option').all_text_contents()==expected;page.keyboard.press('Escape')
 page.locator('.lib-header-selection [data-action="library-clear"]').click();assert not page.evaluate('state.librarySelected.length')
 checks.append('资料空间与移动目标统一排序；选择提示在标题行；排序移入更多仍可用；实心三点')
 page.goto('http://127.0.0.1:8765/#tool/extract');page.locator('[data-action="add-tool-materials"]').click();assert page.locator('[data-change="picker-space"] option').all_text_contents()==expected;page.keyboard.press('Escape')
 page.evaluate("ws().ids=['d13','d1','d14'];render()")
 assert page.locator('.work-space').all_text_contents()==expected
 checks.append('工具添加资料与本次资料分组统一空间顺序')
 assert not errors,errors
 (root/'review/space-icons-checks.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));b.close()
