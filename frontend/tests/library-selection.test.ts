import { describe,it,expect } from 'vitest'
import type { Material } from '../src/domain/types'
import { mergeSelection,togglePageSelection,reconcileSelection,isMaterialSelectable } from '../src/domain/fileSelection'
const file=(id:string, overrides:Partial<Material>={}):Material=>({id,name:id+'.pdf',folderId:'folder',path:'目录',space:'PUBLIC',size:100,extension:'pdf',parseStatus:'parsed',...overrides})
describe('资料跨页与跨目录选集',()=>{
 it('取消当前页不会移除其他页/目录选择',()=>{expect(togglePageSelection([file('a'),file('b'),file('c',{folderId:'other'})],[file('a')],false).map(x=>x.id)).toEqual(['b','c'])})
 it('重复勾选全页不产生重复文件，单表角色仅保留一份',()=>{expect(mergeSelection([file('a')],[file('a'),file('b')]).map(x=>x.id)).toEqual(['a','b']);expect(mergeSelection([file('a')],[file('b')],false).map(x=>x.id)).toEqual(['b'])})
 it('解析或权限变化时明确移除，返回当前服务元数据',()=>{const checked=reconcileSelection([file('a'),file('b'),file('c')],[file('a',{name:'最新文件名'}),file('b',{parseStatus:'failed'}),file('c',{canAnalyze:false})]);expect(checked.files.map(x=>x.name)).toEqual(['最新文件名']);expect(checked.removed.map(x=>x.id)).toEqual(['b','c'])})
 it('只能选择解析完成且满足格式权限的文件',()=>{expect(isMaterialSelectable(file('x',{extension:'xlsx'}),true,['xlsx','csv'])).toBe(true);expect(isMaterialSelectable(file('x'),true,['xlsx'])).toBe(false);expect(isMaterialSelectable(file('x',{parseStatus:'parsing'}))).toBe(false)})
})
