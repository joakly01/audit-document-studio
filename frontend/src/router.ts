import {createRouter,createWebHashHistory} from 'vue-router'
import {toolMap} from './domain/tools'
export const router=createRouter({history:createWebHashHistory(),routes:[
 {path:'/',redirect:'/library'},
 {path:'/library',component:()=>import('./views/LibraryPage.vue')},
 {path:'/tool/:tool',component:()=>import('./views/ToolWorkspace.vue'),beforeEnter:(to)=>Object.hasOwn(toolMap,String(to.params.tool))?true:'/library'},
 {path:'/tool/:tool/history',component:()=>import('./views/TasksPage.vue')},
 {path:'/tasks',component:()=>import('./views/TasksPage.vue')},
 {path:'/tasks/:id',component:()=>import('./views/ResultPage.vue')},
 {path:'/templates',component:()=>import('./views/TemplatesPage.vue')},
 {path:'/prompts',component:()=>import('./views/PromptsPage.vue')},
 {path:'/:pathMatch(.*)*',redirect:'/library'}
]})
