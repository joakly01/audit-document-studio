import {readFile,writeFile} from 'node:fs/promises'

// Build a portable review artifact from actual browser captures, not mock layouts.
const root='review/ui-restore'
const before=JSON.parse(await readFile(`${root}/before.json`,'utf8'))
const after=JSON.parse(await readFile(`${root}/after.json`,'utf8'))
if(after.errors.length||after.checks.some(check=>!check.passed))throw Error('UI checks must pass before generating the comparison')
const definitions=[
 ['extract','信息提取','tool-extract'],['theme','主题归纳','tool-theme'],
 ['bidding','招投标分析','tool-bidding'],['library','资料管理','library'],
 ['templates','提取模板','templates'],['tasks','任务中心','tasks']
]
const pages=[]
for(const [id,title,file]of definitions){
 const images={}
 for(const state of ['reference','before','after']){
  const path=`${root}/${state}/${file}${state==='reference'?'':'-1366'}.png`
  images[state]='data:image/png;base64,'+(await readFile(path)).toString('base64')
 }
 pages.push({id,title,images})
}
const metric=report=>report.metrics.find(item=>item.key==='tool/extract'&&item.viewport?.width===1366)
const b=metric(before),a=metric(after)
const numbers={beforePanel:Math.round(b.left.height),afterPanel:Math.round(a.left.height),beforeCommand:Number(b.heading.height.toFixed(1)),afterCommand:a.heading.height,beforeSource:b.sourceHeader.height,afterSource:a.sourceHeader.height,checks:after.checks.length}
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>文档挖掘助手 · UI 还原对照</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f6f9;color:#1e3046;font:16px/1.6 "Microsoft YaHei","PingFang SC",Arial,sans-serif}main{max-width:1700px;margin:auto;padding:24px}h1{font-size:24px;margin:0 0 8px}p{margin:0 0 16px;color:#596b80}strong{font-weight:600}header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.status{color:#1d735b;background:#eaf7f2;border:1px solid #bcded0;border-radius:8px;padding:8px 14px;white-space:nowrap}.toolbar{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:16px}select,button{font:inherit;min-height:38px;background:white;border:1px solid #ccd7e6;border-radius:6px;padding:5px 12px;color:#1e3046}button{cursor:pointer}button:hover{border-color:#3269db;color:#245ec5}button:focus-visible,select:focus-visible{outline:2px solid #3269db;outline-offset:3px}select{min-width:160px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;background:white;border:1px solid #dce3ed;border-radius:10px;overflow:hidden}figcaption{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #e6ebf1}figure img{display:block;width:100%;height:auto}figure small{font-size:14px;color:#596b80}table{border-collapse:collapse;background:white;width:100%;margin:20px 0}th,td{padding:10px 14px;border:1px solid #e6ebf1;text-align:left}th{font-size:14px;background:#f5f7fa;color:#52657b}td strong{color:#245ec5}.note{background:#fff;padding:16px;border:1px solid #e6ebf1;border-radius:8px;font-size:14px}dialog{width:calc(100vw - 28px);height:calc(100dvh - 28px);max-width:none;max-height:none;border:0;border-radius:8px;padding:0}dialog::backdrop{background:#182f41b3}dialog header{padding:10px 14px;position:sticky;top:0;background:white;border-bottom:1px solid #e6ebf1}dialog img{display:block;margin:auto;max-width:100%;height:auto}dialog .zoom-area{overflow:auto;padding:12px}footer{font-size:14px;color:#596b80;margin-top:16px}@media(max-width:800px){main{padding:14px}.compare{grid-template-columns:1fr}header{flex-wrap:wrap}.status{font-size:14px}table{font-size:14px}th,td{padding:8px}h1{font-size:20px}}
</style><main><header><div><h1>文档挖掘助手 · UI 还原对照</h1><p>按确认的交互原型与 UI 规范核对；以下截图均为 1366 × 768 的真实页面。</p></div><span class="status">${numbers.checks} 项界面检查通过</span></header>
<div class="toolbar"><label>页面 <select id="page"></select></label><label>左侧对照 <select id="state"><option value="before">修正前的 Vue 前端</option><option value="reference">确认的原型基准</option></select></label><span>右侧为本轮修正后的 Vue 前端</span></div>
<div class="compare"><figure><figcaption><strong id="left-label"></strong><button data-zoom="left">放大查看</button></figcaption><img id="left" alt="左侧对照页面"></figure><figure><figcaption><strong id="right-label"></strong><button data-zoom="right">放大查看</button></figcaption><img id="right" alt="修正后页面"></figure></div>
<table><thead><tr><th>核对项</th><th>修正前</th><th>本轮修正后</th><th>原型 / 规范</th></tr></thead><tbody><tr><td>独立访问的导航</td><td>顶部 56px</td><td><strong>左侧 192px</strong></td><td>左侧 192px；嵌入时隐藏</td></tr><tr><td>工具命令栏</td><td>${numbers.beforeCommand}px</td><td><strong>${numbers.afterCommand}px</strong></td><td>56px</td></tr><tr><td>信息提取左右栏可用高度</td><td>${numbers.beforePanel}px</td><td><strong>${numbers.afterPanel}px</strong></td><td>712px（768 − 56）</td></tr><tr><td>原文头部</td><td>${numbers.beforeSource}px</td><td><strong>${numbers.afterSource}px</strong></td><td>44px，单行排列</td></tr><tr><td>主控件 / 可见辅助文字</td><td>14px / 部分 12–13px</td><td><strong>16px / 最低 14px</strong></td><td>16px / 最低 14px</td></tr></tbody></table>
<div class="note"><strong>核对说明</strong><p>原型与 Vue 前端使用的演示资料不同，因此不计算逐像素还原百分比。重点核对布局、尺寸、间距、动作位置和交互；已取消的旧按钮不恢复。图标使用统一的组件库。</p><p>本轮也验证了 1024 × 480 和 390 × 600 的布局、关键弹窗及 11 类结果。真实 API 原件预览另用有效 DOCX / XLSX 文件验证；不代表后端模型和生产权限已验收。</p><strong>此文件保存 UI 核对时的截图；最新服务器发布状态见 docs/DEPLOYMENT.md。</strong></div><footer>基准：原型静态资源 20261024.80 / UI 规范 2026-10-25。生成时间：${new Date().toISOString()}。图片已内嵌，可离线打开。</footer></main>
<dialog id="zoom"><header><strong id="zoom-label"></strong><button id="close">关闭</button></header><div class="zoom-area"><img id="zoom-image" alt="页面放大图"></div></dialog>
<script>const pages=${JSON.stringify(pages)};const page=document.getElementById('page'),state=document.getElementById('state'),zoom=document.getElementById('zoom');for(const p of pages){const o=document.createElement('option');o.value=p.id;o.textContent=p.title;page.append(o)}function update(){const p=pages.find(p=>p.id===page.value),s=state.value;document.getElementById('left').src=p.images[s];document.getElementById('right').src=p.images.after;document.getElementById('left-label').textContent=p.title+' · '+(s==='before'?'修正前':'原型基准');document.getElementById('right-label').textContent=p.title+' · 修正后'}page.addEventListener('change',update);state.addEventListener('change',update);for(const button of document.querySelectorAll('[data-zoom]'))button.addEventListener('click',()=>{const id=button.dataset.zoom;document.getElementById('zoom-image').src=document.getElementById(id).src;document.getElementById('zoom-label').textContent=document.getElementById(id+'-label').textContent;zoom.showModal()});document.getElementById('close').addEventListener('click',()=>zoom.close());update();</script></html>`
await writeFile(`${root}/对照查看.html`,html)
console.log(`Generated ${root}/对照查看.html (${Math.round(Buffer.byteLength(html)/1024)} KiB)`)
