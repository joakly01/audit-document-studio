import { defineStore } from 'pinia'
import { ref } from 'vue'
import {createDraft} from '@/domain/tools'
import {cloneDraft} from '@/domain/validation'
import type {ToolDraft,ToolId} from '@/domain/types'
// Drafts live in memory. Sensitive text is not persisted globally in localStorage.
export const useWorkspace = defineStore('workspace',()=>{
 const drafts=ref<Partial<Record<ToolId,ToolDraft>>>({})
 function getDraft(tool:ToolId){return drafts.value[tool] ||= createDraft(tool)}
 function replaceDraft(draft:ToolDraft){drafts.value[draft.tool]=cloneDraft(draft)}
 function reset(tool:ToolId){drafts.value[tool]=createDraft(tool)}
 return {drafts,getDraft,replaceDraft,reset}
})
