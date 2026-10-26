/**
 * 单表 F 键 compact / 删除重排 — Node 内置 test runner
 * 运行：node --test engineeringSingleTableConfigHelpers.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  compactSingleTableFKeys,
  removeSingleTableFieldAndRenumber,
  allocateNextFieldKey,
  prepareSingleTableConfig
} from './engineeringSingleTableConfigHelpers.js'

function makeCfg(overrides = {}) {
  return {
    field_mapping: {
      F1: { excel_column: '项目名称', compare_type: 'similarity', threshold: 0.8 },
      F2: { excel_column: '总投资', compare_type: 'investment_diff', threshold: 0.04 },
      F3: { excel_column: '地点', compare_type: 'similarity', threshold: 0.8 }
    },
    llm_config: {
      field_weights: { F1: 0.4, F2: 0.3, F3: 0.3 },
      field_prompt_rules: { F1: '规则1', F2: '规则2', F3: '规则3' },
      hard_rules: [],
      veto_rules: [{ field: 'F3', min_score: 2, message: '地点过低' }],
      phase_check_field: 'F1',
      phase_check_enabled: true,
      threshold: 3.35,
      additional_prompt: '',
      output_schema: 'duplicate_v1',
      threshold_comparison: 'gte',
      arbitration: { enabled: false },
      system_rules: { phase_keywords: ['一期'] }
    },
    prescreen_config: { min_match_fields: 2 },
    auxiliary_columns: ['文件名称'],
    column_aliases: {},
    ...overrides
  }
}

describe('removeSingleTableFieldAndRenumber', () => {
  it('删中间键 F2 后连续为 F1,F2，并迁移权重与规则', () => {
    const next = removeSingleTableFieldAndRenumber(makeCfg(), 'F2')
    assert.deepEqual(Object.keys(next.field_mapping).sort(), ['F1', 'F2'])
    assert.equal(next.field_mapping.F2.excel_column, '地点')
    assert.equal(next.llm_config.field_weights.F2, 0.3)
    assert.equal(next.llm_config.field_prompt_rules.F2, '规则3')
    assert.equal(next.llm_config.veto_rules[0].field, 'F2')
    assert.equal(next.llm_config.phase_check_field, 'F1')
  })

  it('删带 veto 的 F3 后 veto 条目消失', () => {
    const next = removeSingleTableFieldAndRenumber(makeCfg(), 'F3')
    assert.deepEqual(Object.keys(next.field_mapping).sort(), ['F1', 'F2'])
    assert.deepEqual(next.llm_config.veto_rules, [])
  })

  it('删 phase=F1 后 phase 指向新 F1（原 F2）', () => {
    const next = removeSingleTableFieldAndRenumber(makeCfg(), 'F1')
    assert.equal(next.llm_config.phase_check_field, 'F1')
    assert.equal(next.field_mapping.F1.excel_column, '总投资')
    assert.equal(next.llm_config.veto_rules[0].field, 'F2')
  })

  it('hard_rules and 子规则引用已删键时丢整组', () => {
    const cfg = makeCfg({
      llm_config: {
        ...makeCfg().llm_config,
        hard_rules: [
          {
            logic: 'and',
            rules: [
              { field: 'F2', condition: 'mismatch' },
              { field: 'F3', condition: 'mismatch' }
            ],
            result: 'not_duplicate',
            message: '组合规则'
          },
          { field: 'F1', condition: 'mismatch', result: 'not_duplicate', message: '名称' }
        ]
      }
    })
    const next = removeSingleTableFieldAndRenumber(cfg, 'F2')
    assert.equal(next.llm_config.hard_rules.length, 1)
    assert.equal(next.llm_config.hard_rules[0].field, 'F1')
  })

  it('操作不污染原配置对象', () => {
    const a = makeCfg()
    const snapshot = JSON.stringify(a)
    removeSingleTableFieldAndRenumber(a, 'F2')
    assert.equal(JSON.stringify(a), snapshot)
  })
})

describe('compactSingleTableFKeys', () => {
  it('空洞 F1,F3 压成 F1,F2；再 allocate 得到 F3', () => {
    const cfg = makeCfg()
    delete cfg.field_mapping.F2
    delete cfg.llm_config.field_weights.F2
    delete cfg.llm_config.field_prompt_rules.F2
    const compacted = compactSingleTableFKeys(cfg)
    assert.deepEqual(Object.keys(compacted.field_mapping).sort(), ['F1', 'F2'])
    assert.equal(compacted.field_mapping.F2.excel_column, '地点')
    assert.equal(compacted.llm_config.veto_rules[0].field, 'F2')
    assert.equal(allocateNextFieldKey(compacted.field_mapping), 'F3')
  })

  it('compact 后清除顶层遗留 field_weights/field_rules/field_meta', () => {
    const cfg = makeCfg()
    cfg.field_weights = { F1: 1, F9: 0 }
    cfg.field_rules = { F1: '旧' }
    cfg.field_meta = { F1: {} }
    const next = compactSingleTableFKeys(cfg)
    assert.equal(next.field_weights, undefined)
    assert.equal(next.field_rules, undefined)
    assert.equal(next.field_meta, undefined)
    assert.ok(next.llm_config.field_weights.F1 != null)
  })
})

describe('prepare after renumber', () => {
  it('删字段并调和权重后 prepare 可通过', () => {
    let next = removeSingleTableFieldAndRenumber(makeCfg(), 'F2')
    next.llm_config.field_weights = { F1: 0.5, F2: 0.5 }
    const prepared = prepareSingleTableConfig(next, { mode: 'duplicate', validate: true })
    assert.ok(prepared.field_mapping.F1)
    assert.ok(prepared.field_mapping.F2)
  })
})
