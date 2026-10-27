export type ToolId = 'extract'|'word'|'theme'|'timeline'|'meeting'|'risk'|'bidding'|'contract'|'prepaid'|'engineering'|'association'
export type JsonObject = Record<string, any>
export interface ToolDefinition {id:ToolId;name:string;step1:string;step3:string;action:string;layout:'three'|'two';description:string;promptStages:{key:string;label:string;functionType:string}[]}
export type ParseStatus = 'parsed'|'unparsed'|'parsing'|'failed'
export interface Material {id:string;name:string;folderId:string;path:string;space:string;size:number;extension:string;parseStatus:ParseStatus;owner?:string;updatedAt?:string;canAnalyze?:boolean;canDownload?:boolean;attachmentIds?:string[];raw?:JsonObject}
export interface Folder {id:string;name:string;parentId?:string;space:string;path?:string;children?:Folder[];canManage?:boolean;raw?:JsonObject}
export interface FileQuery {space:string;folderId?:string;keyword:string;includeDescendants:boolean;page:number;size:number;parseStatus?:ParseStatus;extensions?:string[]}
export interface Page<T> {items:T[];total:number;page:number;size:number}
export interface Prompt {id:string;name:string;content:string;scope:'public'|'organization'|'personal';category?:'system'|'function'|'scenario';tool?:ToolId;stage:string;isDefault?:boolean;config?:JsonObject;raw?:JsonObject}
export interface ExtractionField {id:string;name:string;description:string}
export interface ExtractionTemplate {id:string;name:string;description:string;folderId:string;scope:'system'|'personal';fields:ExtractionField[];raw?:JsonObject}
export interface TemplateFolder {id:string;name:string;parentId?:string;scope:'system'|'personal'}
export interface PromptChoice {id:string;name:string;content:string;originalContent:string;customized:boolean}
export interface ToolDraft {tool:ToolId;name:string;files:Material[];attachments:Record<string,Material[]>;prompts:Record<string,PromptChoice>;config:JsonObject;sourceTaskId?:string}
export type TaskStatus = 'queued'|'running'|'completed'|'partial'|'failed'|'stopped'|'awaiting_input'|'unknown'
export interface Task {id:string;name:string;tool:ToolId|null;status:TaskStatus;createdAt:string;updatedAt?:string;stage?:string;total:number;completed:number;failed:number;hasResults:boolean;progress?:number;error?:string;draft?:ToolDraft;results?:JsonObject;raw?:JsonObject}
export interface TaskQuery {page:number;size:number;tool?:ToolId;keyword?:string;status?:TaskStatus}
export interface SourceContent {url?:string;text?:string;mimeType?:string;page?:number;totalPages?:number;sheetNames?:string[];columns?:string[]}
export interface ContractReport {status:'idle'|'running'|'success'|'failed'|'unknown';filename?:string;error?:string}
export interface Evidence {fileId:string;fileName?:string;page?:number;quote?:string;sheet?:string;row?:number}
export interface UploadEntry {file:File;relativePath:string;status:'pending'|'uploading'|'uploaded'|'failed';error?:string;id?:string}
export interface Capabilities {taskAttachmentOverrides?:boolean;demo:boolean;taskStop:boolean;taskRetry:boolean;personalPrompts:boolean;templateFolders:boolean;meetingFollowup:boolean;reviewPersistence:boolean;prepaidUnitConfirmed:boolean}
