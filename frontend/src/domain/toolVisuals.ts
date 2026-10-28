import {Document,Histogram,Collection,Timer,Warning,ChatLineSquare,Tickets,Briefcase,Money,DataLine,Connection} from '@element-plus/icons-vue'
import type {ToolId} from './types'
export const toolVisuals={
 extract:{icon:Document,color:'#4376b9',background:'#eef4ff'},
 word:{icon:Histogram,color:'#3f8a91',background:'#edf8f7'},
 theme:{icon:Collection,color:'#8064b2',background:'#f3eff9'},
 timeline:{icon:Timer,color:'#518a9e',background:'#eef6f9'},
 risk:{icon:Warning,color:'#ad7d33',background:'#fff7e9'},
 meeting:{icon:ChatLineSquare,color:'#6c88b6',background:'#f0f4fb'},
 contract:{icon:Tickets,color:'#518e87',background:'#eef7f4'},
 bidding:{icon:Briefcase,color:'#aa7a45',background:'#faf3eb'},
 prepaid:{icon:Money,color:'#8b749c',background:'#f5f1f8'},
 engineering:{icon:DataLine,color:'#5b8a98',background:'#eef6f8'},
 association:{icon:Connection,color:'#8270a6',background:'#f4f0fa'}
} satisfies Record<ToolId,{icon:unknown;color:string;background:string}>
