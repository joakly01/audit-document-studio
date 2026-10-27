import type {LexiconEntry} from '@/domain/lexicon'
import type {Capabilities, Material, Folder, FileQuery, Page, Prompt, ExtractionTemplate, TemplateFolder, Task, TaskQuery, ToolDraft, ToolId, SourceContent, JsonObject, ContractReport} from '@/domain/types'
export interface StudioService {
 capabilities:Capabilities
 loadLexicon():Promise<LexiconEntry[]>
 saveLexicon(rows:LexiconEntry[],expected:LexiconEntry[]):Promise<void>
 listFolders(space:string):Promise<Folder[]>
 listFiles(query:FileQuery, signal?:AbortSignal):Promise<Page<Material>>
 getMaterials(ids:string[]):Promise<Material[]>
 resolveSelection(query:FileQuery, signal?:AbortSignal):Promise<Material[]>
 getSource(file:Material, signal?:AbortSignal):Promise<SourceContent>
 upload(file:File, folderId:string, relativePath?:string):Promise<Material>
 createFolder(name:string,parentId:string|undefined,space:string):Promise<Folder>
 renameFolder(id:string,name:string):Promise<void>
 deleteFolder(id:string):Promise<void>
 deleteFiles(ids:string[]):Promise<void>
 parseFiles(ids:string[]):Promise<void>
 saveAttachments(fileId:string,ids:string[]):Promise<void>
 listPrompts(tool?:ToolId,stage?:string):Promise<Prompt[]>
 savePrompt(prompt:Partial<Prompt>):Promise<Prompt>
 deletePrompt(id:string):Promise<void>
 listTemplates():Promise<ExtractionTemplate[]>
 saveTemplate(template:ExtractionTemplate):Promise<ExtractionTemplate>
 deleteTemplate(id:string):Promise<void>
 listTemplateFolders():Promise<TemplateFolder[]>
 saveTemplateFolder(folder:TemplateFolder):Promise<TemplateFolder>
 deleteTemplateFolder(id:string):Promise<void>
 listTasks(query:TaskQuery, signal?:AbortSignal):Promise<Page<Task>>
 getTask(id:string, signal?:AbortSignal):Promise<Task>
 submitTask(draft:ToolDraft):Promise<Task>
 exportTask(task:Task,format:'excel'|'csv'|'json'|'markdown'):Promise<Blob>
 retryTask(id:string):Promise<void>
 stopTask(id:string):Promise<void>
 continueTask(task:Task,action:string,payload:JsonObject):Promise<Task>
 getContractReport(taskId:string,signal?:AbortSignal):Promise<ContractReport>
 generateContractReport(taskId:string):Promise<void>
 downloadContractReport(taskId:string):Promise<Blob>
}
