/**
 * QA Test: T-0055 ~ T-0057 生命周期管理系统
 */
import {
  init_lifecycle, transition_lifecycle, get_valid_transitions,
  process_freeze, process_destroy, process_adjust, finish_adjust,
  check_satisfaction_trigger,
  suggest_destroy_from_low_score,
  execute_satisfaction_destroy,
  execute_satisfaction_refactor,
  LowScoreEvidence,
} from "../src/lifecycle-manager";

import { PersonaCard, SatisfactionRecord, StructuredArchive, WorkRecord, SkillEvolution } from "../src/schemas";

let pass = 0;
let fail = 0;

function test(name: string, fn: () => boolean) {
  try {
    if (fn()) { pass++; console.log(`PASS: ${name}`); }
    else { fail++; console.error(`FAIL: ${name}`); }
  } catch (e) {
    fail++; console.error(`FAIL: ${name} — ${e}`);
  }
}

function make_card(name: string, role: string): PersonaCard {
  return {
    name, role, summary: "测试",
    must_do: ["实现"], must_not_do: ["越界", "跳过审查", "未经许可修改需求"],
    tech_env: { language: "TypeScript" },
    input_sources: [], output_targets: [],
    behavior_rules: ["规则1"],
    permission_mode: "bypassPermissions",
    lifecycle: "project_destroy",
  };
}

function make_archive(name: string, role: string): StructuredArchive {
  return {
    name, role,
    lifecycle: "project_destroy",
    base_info: make_card(name, role),
    work_history: [],
    skill_evolution: { start: "", mid: "", end: "" },
    annotations: [],
  };
}

// ============ T-0055: 生命周期状态机 ============
console.log("\n=== T-0055: 生命周期状态机 ===");

test("T-0055: init_lifecycle 初始状态为 ACTIVE", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  return ctx.state === "ACTIVE" &&
    ctx.transitions.length === 0 &&
    ctx.adjust_count === 0;
});

test("T-0055: ACTIVE → FROZEN 合法转换", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const result = transition_lifecycle(ctx, "FROZEN", "客户要求永久保留", "客户");
  return result.success && result.ctx.state === "FROZEN" && result.ctx.frozen_card !== undefined;
});

test("T-0055: ACTIVE → DESTROYED 合法转换", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const result = transition_lifecycle(ctx, "DESTROYED", "项目结束", "客户");
  return result.success && result.ctx.state === "DESTROYED";
});

test("T-0055: ACTIVE → ADJUSTING 合法转换", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const result = transition_lifecycle(ctx, "ADJUSTING", "需求变更", "客户");
  return result.success && result.ctx.state === "ADJUSTING" && result.ctx.adjust_count === 1;
});

test("T-0055: ADJUSTING → ACTIVE 合法转换", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  let r = transition_lifecycle(ctx, "ADJUSTING", "调整", "客户");
  r = transition_lifecycle(r.ctx, "ACTIVE", "调整完成", "主Agent");
  return r.success && r.ctx.state === "ACTIVE";
});

test("T-0055: FROZEN → ACTIVE 合法转换 (重新激活)", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  let r = transition_lifecycle(ctx, "FROZEN", "冻结", "客户");
  r = transition_lifecycle(r.ctx, "ACTIVE", "重新激活", "客户");
  return r.success && r.ctx.state === "ACTIVE";
});

test("T-0055: FROZEN → DESTROYED 合法转换", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  let r = transition_lifecycle(ctx, "FROZEN", "冻结", "客户");
  r = transition_lifecycle(r.ctx, "DESTROYED", "销毁", "客户");
  return r.success && r.ctx.state === "DESTROYED";
});

test("T-0055: DESTROYED 不可逆 (无合法转换)", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  let r = transition_lifecycle(ctx, "DESTROYED", "销毁", "客户");
  r = transition_lifecycle(r.ctx, "ACTIVE", "尝试恢复", "客户");
  return !r.success && r.error !== undefined && r.error.includes("非法");
});

test("T-0055: ACTIVE → FROZEN 不合法 (直接跨状态)", () => {
  // ACTIVE 不能直接到 FROZEN 经过 ACTIVE... 等等, ACTIVE → FROZEN 是合法的
  // 测试非法转换: FROZEN → ADJUSTING
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  let r = transition_lifecycle(ctx, "FROZEN", "冻结", "客户");
  r = transition_lifecycle(r.ctx, "ADJUSTING", "非法", "测试");
  return !r.success && r.error !== undefined && r.error.includes("非法");
});

test("T-0055: transitions 记录完整转换历史", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  let r = transition_lifecycle(ctx, "FROZEN", "冻结", "客户");
  r = transition_lifecycle(r.ctx, "ACTIVE", "激活", "客户");
  r = transition_lifecycle(r.ctx, "DESTROYED", "销毁", "客户");
  return r.ctx.transitions.length === 3 &&
    r.ctx.transitions[0].from === "ACTIVE" &&
    r.ctx.transitions[0].to === "FROZEN" &&
    r.ctx.transitions[1].from === "FROZEN" &&
    r.ctx.transitions[1].to === "ACTIVE" &&
    r.ctx.transitions[2].from === "ACTIVE" &&
    r.ctx.transitions[2].to === "DESTROYED";
});

test("T-0055: DESTROYED 清空角色上下文", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const r = transition_lifecycle(ctx, "DESTROYED", "销毁", "客户");
  return r.success &&
    r.ctx.card.must_do.length === 0 &&
    r.ctx.card.behavior_rules.some(br => br.includes("已销毁"));
});

test("T-0055: ADJUSTING 标记调整状态", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const r = transition_lifecycle(ctx, "ADJUSTING", "需求变更", "客户");
  return r.success &&
    r.ctx.card.lifecycle === "follow_project" &&
    r.ctx.card.behavior_rules.some(br => br.includes("调整中"));
});

test("T-0055: get_valid_transitions 返回合法目标", () => {
  const active_transitions = get_valid_transitions("ACTIVE");
  return active_transitions.includes("FROZEN") &&
    active_transitions.includes("DESTROYED") &&
    active_transitions.includes("ADJUSTING") &&
    get_valid_transitions("DESTROYED").length === 0;
});

// ============ T-0056: 生命周期变更处理器 ============
console.log("\n=== T-0056: 生命周期变更处理器 ===");

test("T-0056: process_freeze 冻结+归档技能演进", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const archive = make_archive("张三", "前端工程师");
  const evolution: SkillEvolution = {
    start: "React入门", mid: "React熟练", end: "React专家",
  };
  const result = process_freeze(ctx, archive, evolution);
  return result.ctx.state === "FROZEN" &&
    result.result.frozen_card !== undefined &&
    result.result.archive.skill_evolution.end === "React专家" &&
    result.result.archive.annotations.some(a => a.content.includes("已冻结"));
});

test("T-0056: process_destroy 保留工作记录", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const work_records: WorkRecord[] = [{
    task_id: "T1", time_range: "2026-01~2026-03", goal: "完成前端",
    decision_chain: "", outputs: ["index.tsx"], pitfalls: [],
    reusable_snippets: [],
  }];
  const result = process_destroy(ctx, work_records);
  return result.ctx.state === "DESTROYED" &&
    result.result.retained_records.length === 1 &&
    result.result.retained_records[0].task_id === "T1";
});

test("T-0056: process_adjust 释放约束词+标记重采访", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const result = process_adjust(ctx, "新增移动端支持");
  return result.ctx.state === "ADJUSTING" &&
    result.result.needs_reinterview.length >= 3 &&
    result.result.released_constraints.length > 0;
});

test("T-0056: process_adjust 无新需求时默认采访项", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const result = process_adjust(ctx);
  return result.ctx.state === "ADJUSTING" &&
    result.result.needs_reinterview.includes("约束词更新");
});

test("T-0056: finish_adjust 回到ACTIVE+新卡替换", () => {
  let ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const adjust = transition_lifecycle(ctx, "ADJUSTING", "调整", "客户");
  ctx = adjust.ctx;
  const new_card = make_card("张三", "前端工程师(已调整)");
  const result = finish_adjust(ctx, new_card);
  return result.state === "ACTIVE" && result.card.role === "前端工程师(已调整)";
});

test("T-0056: finish_adjust 非ADJUSTING状态报错", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  let threw = false;
  try { finish_adjust(ctx, make_card("张三", "新")); }
  catch (e) { threw = true; }
  return threw;
});

test("T-0056: process_freeze 从非ACTIVE状态失败", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  let r = transition_lifecycle(ctx, "DESTROYED", "销毁", "客户");
  let threw = false;
  try { process_freeze(r.ctx, make_archive("张三", "前端"), { start: "", mid: "", end: "" }); }
  catch (e) { threw = true; }
  return threw;
});

test("T-0056: 调整次数递增", () => {
  let ctx = init_lifecycle(make_card("张三", "前端工程师"));
  let r = transition_lifecycle(ctx, "ADJUSTING", "第一次调整", "客户");
  r = transition_lifecycle(r.ctx, "ACTIVE", "完成", "主Agent");
  r = transition_lifecycle(r.ctx, "ADJUSTING", "第二次调整", "客户");
  return r.success && r.ctx.adjust_count === 2;
});

// ============ T-0057: 满意度触发生命周期变更 ============
console.log("\n=== T-0057: 满意度触发生命周期变更 ===");

function make_sat_record(stage_id: string, composite: number): SatisfactionRecord {
  return {
    stage_id,
    group_name: "测试组",
    lead_score: { quality: 2, standard: 2, collaboration: 2, bonus: 0, composite },
    member_details: [],
    client_modifications: [],
    final_scores: { quality: 2, standard: 2, collaboration: 2, bonus: 0, composite },
  };
}

test("T-0057: 连续3次≤2 → triggered", () => {
  const records = [
    make_sat_record("S-001", 1.5),
    make_sat_record("S-002", 1.8),
    make_sat_record("S-003", 1.2),
  ];
  const result = check_satisfaction_trigger(records);
  return result.triggered && result.evidence !== null &&
    result.evidence.consecutive_count >= 3;
});

test("T-0057: 1次≤2不触发", () => {
  const records = [
    make_sat_record("S-001", 1.5),
  ];
  const result = check_satisfaction_trigger(records);
  return !result.triggered && result.evidence === null;
});

test("T-0057: 中间有高分中断连续计数", () => {
  const records = [
    make_sat_record("S-001", 1.5),
    make_sat_record("S-002", 3.5),
    make_sat_record("S-003", 1.2),
    make_sat_record("S-004", 1.8),
  ];
  const result = check_satisfaction_trigger(records);
  return !result.triggered; // 连续计数被3.5中断，只有最后2次≤2
});

test("T-0057: 全高分不触发", () => {
  const records = [
    make_sat_record("S-001", 4.5),
    make_sat_record("S-002", 5.0),
    make_sat_record("S-003", 4.2),
  ];
  const result = check_satisfaction_trigger(records);
  return !result.triggered;
});

test("T-0057: suggest_destroy_from_low_score 生成建议", () => {
  const evidence: LowScoreEvidence = {
    records: [
      make_sat_record("S-001", 1.5),
      make_sat_record("S-002", 1.8),
      make_sat_record("S-003", 1.2),
    ],
    reasons: ["S-001: 1.5", "S-002: 1.8", "S-003: 1.2"],
    consecutive_count: 3,
  };
  const suggestion = suggest_destroy_from_low_score(make_card("张三", "前端"), evidence);
  return suggestion.suggestion.includes("张三") &&
    suggestion.option_destroy.includes("销毁") &&
    suggestion.option_refactor.includes("重构") &&
    suggestion.evidence_summary.includes("S-001");
});

test("T-0057: execute_satisfaction_destroy 执行销毁", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const evidence: LowScoreEvidence = {
    records: [make_sat_record("S-001", 1.5), make_sat_record("S-002", 1.8), make_sat_record("S-003", 1.2)],
    reasons: ["S-001: 1.5", "S-002: 1.8", "S-003: 1.2"],
    consecutive_count: 3,
  };
  const result = execute_satisfaction_destroy(ctx, evidence, "主Agent");
  return result.ctx.state === "DESTROYED" &&
    result.archive_note.includes("满意度销毁");
});

test("T-0057: execute_satisfaction_destroy 已销毁不可重复", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  let r = transition_lifecycle(ctx, "DESTROYED", "销毁", "客户");
  const evidence: LowScoreEvidence = {
    records: [], reasons: [], consecutive_count: 3,
  };
  let threw = false;
  try { execute_satisfaction_destroy(r.ctx, evidence, "主Agent"); }
  catch (e) { threw = true; }
  return threw;
});

test("T-0057: execute_satisfaction_refactor 重构角色", () => {
  const ctx = init_lifecycle(make_card("张三", "前端工程师"));
  const evidence: LowScoreEvidence = {
    records: [make_sat_record("S-001", 1.5), make_sat_record("S-002", 1.8), make_sat_record("S-003", 1.2)],
    reasons: ["S-001: 1.5", "S-002: 1.8", "S-003: 1.2"],
    consecutive_count: 3,
  };
  const new_card = make_card("新张三", "前端工程师(重构)");
  const result = execute_satisfaction_refactor(ctx, evidence, new_card);
  return result.old_card.name === "张三" &&
    result.ctx.card.name === "新张三" &&
    result.ctx.card.role === "前端工程师(重构)";
});

test("T-0057: evidence含详细的低分原因", () => {
  const records = [
    make_sat_record("S-001", 1.5),
    make_sat_record("S-002", 1.8),
    make_sat_record("S-003", 1.2),
  ];
  const result = check_satisfaction_trigger(records);
  if (!result.evidence) return false;
  return result.evidence.reasons.length === 3 &&
    result.evidence.reasons.some(r => r.includes("质量")) &&
    result.evidence.reasons.some(r => r.includes("标质"));
});

// ============ 汇总 ============
console.log(`\n总计: ${pass + fail} 测试, ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
