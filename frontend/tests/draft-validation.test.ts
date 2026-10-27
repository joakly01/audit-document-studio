import {describe,it,expect} from 'vitest'
import {createDraft} from '../src/domain/tools'
import {cloneDraft,participatingFiles,validateDraft} from '../src/domain/validation'
import type {Material} from '../src/domain/types'
const file=(id='1'):Material=>({id,name:'合同.pdf',folderId:'f',path:'个人空间/合同',space:'PERSONAL',size:100,extension:'pdf',parseStatus:'parsed',canAnalyze:true})
describe('business submission validation',()=>{
 it('starts extraction without a template or preselected fields',()=>{const d=createDraft('extract');expect(d.config.fields).toEqual([]);expect(d.config.templateId).toBe('');expect(validateDraft(d).length).toBeGreaterThan(0)})
 it('requires parsed and authorized documents and valid unique extraction fields',()=>{const d=createDraft('extract');d.files=[file()];d.config.fields=[{id:'a',name:'合同金额',description:''}];expect(validateDraft(d)).toEqual([]);d.files[0].parseStatus='unparsed';expect(validateDraft(d).join()).toContain('解析完成');d.files[0].parseStatus='parsed';d.config.fields.push({id:'b',name:' 合同金额 ',description:''});expect(validateDraft(d).join()).toContain('不能重复')})
 it('joint bidding validates each project and its companies',()=>{const d=createDraft('bidding');d.config.analysisModes=['joint'];d.config.projects=[{name:'项目甲',biddingFiles:[file()],companies:[]}];d.prompts.joint={id:'p',name:'联合',content:'检查',originalContent:'检查',customized:false};d.config.modeRules={joint:[{id:'r'}]};expect(validateDraft(d).join()).toContain('投标单位');d.config.projects[0].companies=[{name:'投标单位甲',files:[file('2')]}];expect(validateDraft(d)).toEqual([]);expect(participatingFiles(d)).toHaveLength(2)})
 it('reanalysis drafts cannot mutate old task configuration or attachments',()=>{const d=createDraft('extract');d.files=[file()];d.attachments['1']=[file('a')];d.config.fields=[{id:'x',name:'金额',description:'含税'}];const copy=cloneDraft(d);copy.config.fields[0].description='不含税';copy.attachments['1'].pop();expect(d.config.fields[0].description).toBe('含税');expect(d.attachments['1']).toHaveLength(1)})
 it('does not allow same document for both tables',()=>{const d=createDraft('association');d.config.table1=file();d.config.table2=file();expect(validateDraft(d).join()).toContain('两份不同');d.config.table2=file('2');d.config.mappingRows=[{left:'项目名称',right:''}];expect(validateDraft(d).join()).toContain('对应关系')})
 it('file filtering and preview never reduce the execution list',()=>{const d=createDraft('word');d.files=[file(),file('2'),file('3')];expect(participatingFiles(d).map(f=>f.id)).toEqual(['1','2','3'])})
})
