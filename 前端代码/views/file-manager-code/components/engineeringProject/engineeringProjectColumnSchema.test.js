/**
 * 结果列 schema：无编码配置不展示编码/计划列
 * 运行：node --test engineeringProjectColumnSchema.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDuplicateColumnSchema } from './engineeringProjectColumnSchema.js'
import {
  prepareDuplicateConfig,
  prepareParentChildConfig
} from './engineeringProjectConfigHelpers.js'

describe('buildDuplicateColumnSchema 辅助列', () => {
  it('无 roleFields 时即使 useDefaultTemplate 也不展示编码/计划列', () => {
    const schema = buildDuplicateColumnSchema({
      fieldWeights: {
        项目名称: 0.15,
        总投资_万元: 0.3,
        项目详细建设地点: 0.2,
        建设规模及内容_生产能力: 0.2,
        单位名称: 0.15
      },
      roleFields: null,
      sourceColumns: [],
      rows: [],
      useDefaultTemplate: true
    })
    const props = schema.map((c) => c.prop)
    assert.equal(props.includes('项目统一编码24位码'), false)
    assert.equal(props.includes('计划开工时间'), false)
    assert.equal(props.includes('计划竣工时间'), false)
    assert.ok(props.includes('项目名称'))
  })

  it('显式配置 code_field / plan_* 时展示对应列', () => {
    const schema = buildDuplicateColumnSchema({
      fieldWeights: { 项目名称: 1 },
      roleFields: {
        code_field: '项目统一编码24位码',
        plan_start: '计划开工时间',
        plan_end: '计划竣工时间'
      },
      useDefaultTemplate: false
    })
    const props = schema.map((c) => c.prop)
    assert.ok(props.includes('项目统一编码24位码'))
    assert.ok(props.includes('计划开始时间'))
    assert.ok(props.includes('计划竣工时间'))
  })
})

describe('prepareDuplicateConfig / prepareParentChildConfig 辅助角色', () => {
  it('重复检测默认不自动填入 code_field', () => {
    const cfg = prepareDuplicateConfig({})
    assert.equal(cfg.role_fields.code_field, undefined)
    assert.equal(cfg.role_fields.plan_start, undefined)
    assert.ok(cfg.role_fields.project_name)
  })

  it('主子分析缺省补齐 code_field', () => {
    const cfg = prepareParentChildConfig({})
    assert.equal(cfg.role_fields.code_field, '项目统一编码24位码')
  })
})
