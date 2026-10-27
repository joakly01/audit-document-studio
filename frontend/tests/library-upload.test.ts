import { describe,it,expect } from 'vitest'
import { uploadPath, uploadFileIssue, summarizeUploadTypes, duplicateUploadPaths } from '../src/domain/uploadFiles'
describe('上传清单校验',()=>{
 it('保留文件夹相对路径并规范路径分隔符',()=>{expect(uploadPath('资料\\合同\\施工合同.pdf','施工合同.pdf')).toBe('资料/合同/施工合同.pdf')})
 it('拒绝越界、空文件、超限，不凭扩展名隐藏文件',()=>{expect(uploadFileIssue('../机密.pdf',100)).toContain('路径');expect(uploadFileIssue('空.txt',0)).toContain('空');expect(uploadFileIssue('大.pdf',101*1024*1024)).toContain('100');expect(uploadFileIssue('normal.pdf',100)).toBe('')})
 it('重复检测以完整相对路径区分不同目录的同名文件',()=>{expect([...duplicateUploadPaths(['a/test.pdf','b/test.pdf','a/test.pdf'])]).toEqual(['a/test.pdf'])})
 it('类型汇总同时给出数量与字节大小',()=>{expect(summarizeUploadTypes([{path:'a/a.PDF',size:100},{path:'b.pdf',size:200}])).toEqual([{extension:'pdf',count:2,size:300}])})
})
