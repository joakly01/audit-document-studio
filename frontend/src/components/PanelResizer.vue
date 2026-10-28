<script setup lang="ts">
const props=withDefaults(defineProps<{modelValue:number;label:string;reverse?:boolean;min?:number;max?:number;defaultValue?:number}>(),{reverse:false,min:260,max:440,defaultValue:320})
const emit=defineEmits<{'update:modelValue':[number]}>()
function update(value:number){emit('update:modelValue',Math.max(props.min,Math.min(props.max,value)))}
function down(event:PointerEvent){const node=event.currentTarget as HTMLElement;const x=event.clientX,start=props.modelValue;node.setPointerCapture(event.pointerId);const move=(e:PointerEvent)=>update(start+(e.clientX-x)*(props.reverse?-1:1));const end=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end)};node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end)}
function key(event:KeyboardEvent){if(event.key==='Home'){update(props.defaultValue);event.preventDefault()}else if(['ArrowLeft','ArrowRight'].includes(event.key)){update(props.modelValue+(event.key==='ArrowRight'?16:-16)*(props.reverse?-1:1));event.preventDefault()}}
</script>
<template><div class="panel-resizer" :class="{reverse}" role="separator" tabindex="0" aria-orientation="vertical" :aria-label="label" :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="modelValue" @pointerdown.prevent="down" @keydown="key" @dblclick="update(defaultValue)" title="拖动或用方向键调整宽度，Home 恢复默认"/></template>
<style scoped>.panel-resizer{position:absolute;right:0;top:0;bottom:0;width:5px;cursor:col-resize;touch-action:none;z-index:3;background:transparent}.panel-resizer.reverse{right:auto;left:0}.panel-resizer:hover,.panel-resizer:focus-visible{background:#b5caf1;outline:0}</style>
