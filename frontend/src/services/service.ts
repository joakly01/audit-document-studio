import {createApiService} from './api'
import {createDemoService} from './demo'
/** API is the default. Demo is an explicit, isolated mode and never an error fallback. */
const env=import.meta.env
const endpoints:Record<string,string>={}
for(const [key,value] of Object.entries({meetingSubmit:env.VITE_MEETING_SUBMIT_URL,timelineSubmit:env.VITE_TIMELINE_SUBMIT_URL,biddingSubmit:env.VITE_BIDDING_SUBMIT_URL,meetingRisk:env.VITE_MEETING_RISK_URL,meetingQuestion:env.VITE_MEETING_QUESTION_URL,materials:env.VITE_MATERIALS_URL,taskStop:env.VITE_TASK_STOP_URL,taskAttachmentOverrides:env.VITE_TASK_ATTACHMENTS_URL}))if(value)endpoints[key]=String(value)
export const service=env.VITE_DATA_MODE==='demo'?createDemoService():createApiService({baseUrl:env.VITE_API_BASE_URL||'',endpoints,prepaidUnitConfirmed:env.VITE_PREPAID_UNIT_CONFIRMED==='true'})
