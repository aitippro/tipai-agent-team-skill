/**
 * QA Test: T-0051 ~ T-0054 满意度系统
 */
import {
  score_member, score_all_members, create_satisfaction_record,
  ScoringInput,
  client_confirm, client_modify_score, should_ask_followup,
  process_client_action, ClientScoreAction,
  extract_preference_signals, detect_preference_conflict,
  generate_compromise_options,
  PreferenceProfile,
  evaluate_score_impact, evaluate_group_score_impact,
  apply_score_impact,
  ScoreImpact,
} from "../src/satisfaction-system";

import { SatisfactionRecord, PersonaCard } from "../src/schemas";

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

// ============ T-0051: 主Agent打分引擎 ============
console.log("\n=== T-0051: 主Agent打分引擎 ===");

test("T-0051: 单成员打分 - 完美表现", () => {
  const input: ScoringInput = {
    member_name: "张三",
    role: "前端工程师",
    implementation_completeness: 5,
    code_quality: 5,
    collaboration: 5,
    bonus_items: ["主动优化了渲染性能", "补充了边缘case测试"],
    penalty_items: [],
  };
  const result = score_member(input);
  return result.scores.quality === 5 &&
    result.scores.standard === 5 &&
    result.scores.collaboration === 5 &&
    result.scores.bonus === 2 &&
    result.scores.composite > 4.0; // 5*0.4+5*0.3+5*0.2+2*0.1=4.7
});

test("T-0051: 单成员打分 - 差表现", () => {
  const input: ScoringInput = {
    member_name: "李四",
    role: "后端工程师",
    implementation_completeness: 1,
    code_quality: 1,
    collaboration: 1,
    bonus_items: [],
    penalty_items: ["提交虚假代码"],
  };
  const result = score_member(input);
  return result.scores.composite < 2.0;
});

test("T-0051: 分数 clamped 在 1-5 范围", () => {
  const input: ScoringInput = {
    member_name: "测试",
    role: "工程师",
    implementation_completeness: 10,
    code_quality: 0,
    collaboration: -5,
    bonus_items: [],
    penalty_items: [],
  };
  const result = score_member(input);
  return result.scores.quality === 5 &&
    result.scores.standard === 1 &&
    result.scores.collaboration === 1;
});

test("T-0051: 满分 bonus=5", () => {
  const input: ScoringInput = {
    member_name: "测试",
    role: "工程师",
    implementation_completeness: 5,
    code_quality: 5,
    collaboration: 5,
    bonus_items: ["a", "b", "c", "d", "e", "f", "g"],
    penalty_items: [],
  };
  const result = score_member(input);
  return result.scores.bonus === 5;
});

test("T-0051: 原因含加分项描述", () => {
  const input: ScoringInput = {
    member_name: "测试",
    role: "工程师",
    implementation_completeness: 5,
    code_quality: 5,
    collaboration: 5,
    bonus_items: ["优化了性能"],
    penalty_items: [],
  };
  const result = score_member(input);
  return result.reasons.some(r => r.includes("优化了性能"));
});

test("T-0051: 原因含问题项描述", () => {
  const input: ScoringInput = {
    member_name: "测试",
    role: "工程师",
    implementation_completeness: 1,
    code_quality: 1,
    collaboration: 1,
    bonus_items: [],
    penalty_items: ["提交空实现"],
  };
  const result = score_member(input);
  return result.reasons.some(r => r.includes("提交空实现"));
});

test("T-0051: 批量打分 - 组长分 = 成员平均", () => {
  const inputs: ScoringInput[] = [
    { member_name: "A", role: "前端", implementation_completeness: 5, code_quality: 5, collaboration: 5, bonus_items: [], penalty_items: [] },
    { member_name: "B", role: "前端", implementation_completeness: 3, code_quality: 3, collaboration: 3, bonus_items: [], penalty_items: [] },
  ];
  const result = score_all_members(inputs);
  return result.member_details.length === 2 &&
    result.lead_scores.quality === 4 &&
    result.lead_scores.standard === 4 &&
    result.lead_scores.collaboration === 4;
});

test("T-0051: 空成员列表组长分 = 0", () => {
  const result = score_all_members([]);
  return result.member_details.length === 0 &&
    result.lead_scores.composite === 0;
});

test("T-0051: create_satisfaction_record 生成完整记录", () => {
  const inputs: ScoringInput[] = [
    { member_name: "张三", role: "前端工程师", implementation_completeness: 4, code_quality: 4, collaboration: 4, bonus_items: ["优化"], penalty_items: [] },
  ];
  const record = create_satisfaction_record("S-001", "前端组", inputs);
  return record.stage_id === "S-001" &&
    record.group_name === "前端组" &&
    record.member_details.length === 1 &&
    record.client_modifications.length === 0 &&
    record.final_scores.composite > 0;
});

test("T-0051: 综合分计算公式验证", () => {
  // quality=3, standard=3, collaboration=3, bonus=0
  // composite = 3*0.4 + 3*0.3 + 3*0.2 + 0 = 2.7
  const input: ScoringInput = {
    member_name: "测试",
    role: "工程师",
    implementation_completeness: 3,
    code_quality: 3,
    collaboration: 3,
    bonus_items: [],
    penalty_items: [],
  };
  const result = score_member(input);
  return result.scores.composite === 2.7;
});

// ============ T-0052: 客户修改分数交互 ============
console.log("\n=== T-0052: 客户修改分数交互 ===");

function make_test_record(): SatisfactionRecord {
  return {
    stage_id: "S-001",
    group_name: "前端组",
    lead_score: { quality: 4, standard: 3, collaboration: 4, bonus: 1, composite: 3.7 },
    member_details: [{ name: "张三", scores: { quality: 4, standard: 3, collaboration: 4, bonus: 1, composite: 3.7 } }],
    client_modifications: [],
    final_scores: { quality: 4, standard: 3, collaboration: 4, bonus: 1, composite: 3.7 },
  };
}

test("T-0052: client_confirm 原样入库", () => {
  const record = make_test_record();
  const result = client_confirm(record);
  return result.final_scores.quality === 4 &&
    result.final_scores.standard === 3 &&
    result.client_modifications.length === 0;
});

test("T-0052: client_modify_score 修改单维度", () => {
  const record = make_test_record();
  const result = client_modify_score(record, "standard", 5, "代码质量超出预期");
  return result.final_scores.standard === 5 &&
    result.client_modifications.length === 1 &&
    result.client_modifications[0].client_reason === "代码质量超出预期" &&
    result.client_modifications[0].dimension === "standard" &&
    result.final_scores.composite > record.final_scores.composite;
});

test("T-0052: client_modify_score 多次修改累积", () => {
  let record = make_test_record();
  record = client_modify_score(record, "quality", 5, "实现很完整");
  record = client_modify_score(record, "collaboration", 2, "沟通不佳");
  return record.client_modifications.length === 2 &&
    record.final_scores.quality === 5 &&
    record.final_scores.collaboration === 2;
});

test("T-0052: 修改分数 clamped 范围", () => {
  const record = make_test_record();
  const result = client_modify_score(record, "quality", 10, "测试");
  return result.final_scores.quality === 5;
});

test("T-0052: should_ask_followup - 同维度修改≥2次返回true", () => {
  let record = make_test_record();
  record = client_modify_score(record, "standard", 2, "首次修改");
  record = client_modify_score(record, "standard", 3, "第二次修改");
  return should_ask_followup(record, "standard") === true;
});

test("T-0052: should_ask_followup - 未修改返回false", () => {
  const record = make_test_record();
  return should_ask_followup(record, "standard") === false;
});

test("T-0052: should_ask_followup - 不同维度不触发", () => {
  let record = make_test_record();
  record = client_modify_score(record, "quality", 5, "改质量");
  record = client_modify_score(record, "standard", 5, "改标质");
  return should_ask_followup(record, "quality") === false;
});

test("T-0052: process_client_action - confirm操作", () => {
  const record = make_test_record();
  const action: ClientScoreAction = { action: "confirm" };
  const result = process_client_action(record, action);
  return result.client_modifications.length === 0;
});

test("T-0052: process_client_action - modify操作", () => {
  const record = make_test_record();
  const action: ClientScoreAction = {
    action: "modify",
    modifications: [{
      original_score: 3, modified_score: 5,
      client_reason: "代码质量好", dimension: "standard",
    }],
  };
  const result = process_client_action(record, action);
  return result.client_modifications.length === 1 &&
    result.final_scores.standard === 5;
});

// ============ T-0053: 偏好信号提取 ============
console.log("\n=== T-0053: 偏好信号提取 ===");

test("T-0053: extract_preference_signals 提取基本信号", () => {
  const mods = [
    { original_score: 3, modified_score: 5, client_reason: "代码质量超出预期", dimension: "standard" as const },
  ];
  const profile = extract_preference_signals(mods);
  return profile.signals.length === 1 &&
    profile.signals[0].dimension === "standard" &&
    profile.signals[0].strength === 1 &&
    profile.signals[0].labels.includes("重视代码质量");
});

test("T-0053: 提取多个维度的信号", () => {
  const mods = [
    { original_score: 3, modified_score: 5, client_reason: "功能很完整", dimension: "quality" as const },
    { original_score: 4, modified_score: 2, client_reason: "延期交付", dimension: "collaboration" as const },
  ];
  const profile = extract_preference_signals(mods);
  return profile.signals.length === 2;
});

test("T-0053: 同维度多次修改增强strength", () => {
  const mods = [
    { original_score: 3, modified_score: 4, client_reason: "代码质量好", dimension: "standard" as const },
    { original_score: 4, modified_score: 3, client_reason: "bug太多性能差", dimension: "standard" as const },
    { original_score: 3, modified_score: 2, client_reason: "还是不喜欢", dimension: "standard" as const },
  ];
  const profile = extract_preference_signals(mods);
  const signal = profile.signals.find(s => s.dimension === "standard");
  return signal !== undefined && signal.strength === 3;
});

test("T-0053: 关键词匹配: 安全/性能/体验", () => {
  const mods = [
    { original_score: 3, modified_score: 5, client_reason: "安全方面做得很好", dimension: "standard" as const },
  ];
  const profile = extract_preference_signals(mods);
  return profile.signals[0].labels.some(l => l.includes("安全"));
});

test("T-0053: ≥3次同维度修改 → 调整权重", () => {
  const mods = [
    { original_score: 3, modified_score: 4, client_reason: "功能好", dimension: "quality" as const },
    { original_score: 4, modified_score: 3, client_reason: "功能缺失", dimension: "quality" as const },
    { original_score: 3, modified_score: 2, client_reason: "还是不完整", dimension: "quality" as const },
  ];
  const profile = extract_preference_signals(mods);
  return Object.keys(profile.adjusted_weights).length >= 1 &&
    profile.adjusted_weights.quality !== undefined;
});

test("T-0053: ≤2次不调整权重", () => {
  const mods = [
    { original_score: 3, modified_score: 4, client_reason: "好", dimension: "quality" as const },
    { original_score: 4, modified_score: 3, client_reason: "差", dimension: "quality" as const },
  ];
  const profile = extract_preference_signals(mods);
  return Object.keys(profile.adjusted_weights).length === 0;
});

test("T-0053: detect_preference_conflict - 偏好性能但需求无", () => {
  const profile: PreferenceProfile = {
    signals: [{ dimension: "standard", direction: "higher", strength: 3, labels: ["重视性能"] }],
    adjusted_weights: {},
    last_updated: "",
  };
  const result = detect_preference_conflict(profile, "做一个简单的用户管理页面");
  return result.has_conflict;
});

test("T-0053: detect_preference_conflict - 需求含性能无冲突", () => {
  const profile: PreferenceProfile = {
    signals: [{ dimension: "standard", direction: "higher", strength: 3, labels: ["重视性能"] }],
    adjusted_weights: {},
    last_updated: "",
  };
  const result = detect_preference_conflict(profile, "需要高性能的实时数据处理系统");
  return !result.has_conflict;
});

test("T-0053: generate_compromise_options 无冲突返回空", () => {
  const profile: PreferenceProfile = {
    signals: [], adjusted_weights: {}, last_updated: "",
  };
  const options = generate_compromise_options(profile, "需求");
  return options.length === 0;
});

test("T-0053: generate_compromise_options 有冲突返回3方案", () => {
  const profile: PreferenceProfile = {
    signals: [{ dimension: "standard", direction: "higher", strength: 3, labels: ["重视性能"] }],
    adjusted_weights: {},
    last_updated: "",
  };
  const options = generate_compromise_options(profile, "简单需求");
  return options.length === 3 &&
    options.some(o => o.includes("原始需求")) &&
    options.some(o => o.includes("客户偏好")) &&
    options.some(o => o.includes("各取一半"));
});

// ============ T-0054: 分数影响引擎 ============
console.log("\n=== T-0054: 分数影响引擎 ===");

test("T-0054: composite≥4 → priority_reuse + relax_constraints", () => {
  const card = make_card("张三", "前端工程师");
  const impact = evaluate_score_impact(4.5, card);
  return impact.score_range === "≥4" &&
    impact.actions.includes("priority_reuse") &&
    impact.actions.includes("relax_constraints") &&
    impact.actions.length === 2;
});

test("T-0054: composite 3-3.9 → maintain", () => {
  const card = make_card("张三", "前端工程师");
  const impact = evaluate_score_impact(3.5, card);
  return impact.score_range === "3-3.9" &&
    impact.actions.length === 1 &&
    impact.actions.includes("maintain");
});

test("T-0054: composite 2-2.9 → tighten_constraints + enhanced_review", () => {
  const card = make_card("张三", "前端工程师");
  const impact = evaluate_score_impact(2.5, card);
  return impact.score_range === "2-2.9" &&
    impact.actions.includes("tighten_constraints") &&
    impact.actions.includes("enhanced_review");
});

test("T-0054: composite <2 → destroy_suggestion", () => {
  const card = make_card("张三", "前端工程师");
  const impact = evaluate_score_impact(1.2, card);
  return impact.score_range === "<2" &&
    impact.actions.includes("destroy_suggestion");
});

test("T-0054: 边界 composite=3.0 归入 maintain", () => {
  const card = make_card("张三", "前端工程师");
  const impact = evaluate_score_impact(3.0, card);
  return impact.score_range === "3-3.9" && impact.actions.includes("maintain");
});

test("T-0054: 边界 composite=4.0 归入 ≥4", () => {
  const card = make_card("张三", "前端工程师");
  const impact = evaluate_score_impact(4.0, card);
  return impact.score_range === "≥4";
});

test("T-0054: 边界 composite=2.0 归入 2-2.9", () => {
  const card = make_card("张三", "前端工程师");
  const impact = evaluate_score_impact(2.0, card);
  return impact.score_range === "2-2.9";
});

test("T-0054: apply_score_impact - relax移除泛化约束", () => {
  const card = make_card("张三", "前端工程师");
  const impact: ScoreImpact = {
    score_range: "≥4", actions: ["priority_reuse", "relax_constraints"],
    description: "", affected_cards: [card.name],
  };
  const updated = apply_score_impact(impact, card);
  return updated.must_not_do.length < card.must_not_do.length;
});

test("T-0054: apply_score_impact - relax不移除越界约束", () => {
  const card = make_card("张三", "前端工程师");
  card.must_not_do = ["越界", "跳过审查"];
  const impact: ScoreImpact = {
    score_range: "≥4", actions: ["priority_reuse", "relax_constraints"],
    description: "", affected_cards: [card.name],
  };
  const updated = apply_score_impact(impact, card);
  return updated.must_not_do.includes("越界");
});

test("T-0054: apply_score_impact - tighten追加约束", () => {
  const card = make_card("张三", "前端工程师");
  const impact: ScoreImpact = {
    score_range: "2-2.9", actions: ["tighten_constraints", "enhanced_review"],
    description: "", affected_cards: [card.name],
  };
  const updated = apply_score_impact(impact, card);
  return updated.must_not_do.length > card.must_not_do.length &&
    updated.must_not_do.some(r => r.includes("组长二次确认"));
});

test("T-0054: apply_score_impact - destroy标记生命周期", () => {
  const card = make_card("张三", "前端工程师");
  const impact: ScoreImpact = {
    score_range: "<2", actions: ["destroy_suggestion"],
    description: "", affected_cards: [card.name],
  };
  const updated = apply_score_impact(impact, card);
  return updated.lifecycle === "project_destroy" &&
    updated.behavior_rules.some(r => r.includes("销毁建议"));
});

test("T-0054: evaluate_group_score_impact 批量评估", () => {
  const details = [
    { name: "张三", scores: { quality: 5, standard: 5, collaboration: 5, bonus: 3, composite: 4.9 } },
    { name: "李四", scores: { quality: 2, standard: 2, collaboration: 2, bonus: 0, composite: 1.8 } },
  ];
  const cards = [make_card("张三", "前端"), make_card("李四", "前端")];
  const impacts = evaluate_group_score_impact(details, cards);
  return impacts.length === 2 &&
    impacts[0].actions.includes("priority_reuse") &&
    impacts[1].actions.includes("destroy_suggestion");
});

// ============ 汇总 ============
console.log(`\n总计: ${pass + fail} 测试, ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
