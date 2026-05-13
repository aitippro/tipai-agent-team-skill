/**
 * QA Test: T-0064 ~ T-0068 容错机制
 */
import {
  classify_fault, FaultEvent,
  handle_single_reject, escalate_to_lead_agent,
  decide_member_replacement, mark_failed_card,
  MemberFaultState, RejectAction,
  warn_lead_audit_miss, decide_lead_replacement,
  forced_arbitration_for_timeout,
  LeadFaultState,
  recover_member_context, recover_lead_context,
  recover_from_snapshot,
  detect_deadlock, resolve_output_conflict,
  MemberRecoveryContext, LeadRecoveryContext,
  create_fault_record, write_fault_to_archive,
  get_role_fault_history, check_replacement_threshold,
  FaultRecordInput,
} from "../src/fault-tolerance";

import { PersonaCard, ProjectArchive, FaultRecord, StructuredArchive, StageTaskCard } from "../src/schemas";
import { ContextSnapshot } from "../src/context-control";

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
  return { name, role, summary: "测试", must_do: ["实现"], must_not_do: ["越界"],
    tech_env: { language: "TypeScript" }, input_sources: [], output_targets: [],
    behavior_rules: [], permission_mode: "bypassPermissions", lifecycle: "project_destroy" };
}

function make_archive(): ProjectArchive {
  return {
    project_id: "P-001", project_name: "测试", time_range: "2026-01~2026-06",
    status: "active", original_requirements: "",
    team_structure: { lead_agent: "", groups: [] },
    stage_records: [], conflict_records: [], fault_records: [],
    satisfaction_summary: { group_avg: {}, project_avg: 4 },
    reusable_outputs: [], inventory_changes: [],
  };
}

// ============ T-0064: 故障分类器 ============
console.log("\n=== T-0064: 故障分类器 ===");

test("T-0064: 单次故障 → self_heal", () => {
  const event: FaultEvent = {
    role_name: "张三", role_type: "member",
    description: "代码有bug", consecutive_failures: 1,
  };
  const result = classify_fault(event);
  return result.level === "self_heal" && result.fault_pattern.includes("偶发");
});

test("T-0064: 连续2次 → need_intervention (成员)", () => {
  const event: FaultEvent = {
    role_name: "张三", role_type: "member",
    description: "连续失败", consecutive_failures: 2,
  };
  const result = classify_fault(event);
  return result.level === "need_intervention" && result.suggestion.includes("组长");
});

test("T-0064: 连续2次 → need_intervention (组长)", () => {
  const event: FaultEvent = {
    role_name: "王五", role_type: "team_lead",
    description: "连续漏判", consecutive_failures: 2,
  };
  const result = classify_fault(event);
  return result.level === "need_intervention" && result.suggestion.includes("主Agent");
});

test("T-0064: 连续3次 → need_replace", () => {
  const event: FaultEvent = {
    role_name: "张三", role_type: "member",
    description: "多次失败", consecutive_failures: 3,
  };
  const result = classify_fault(event);
  return result.level === "need_replace" && result.fault_pattern.includes("连续失败");
});

test("T-0064: 死锁 → need_pause", () => {
  const event: FaultEvent = {
    role_name: "系统", role_type: "lead_agent",
    description: "死锁", consecutive_failures: 0, is_deadlock: true,
  };
  const result = classify_fault(event);
  return result.level === "need_pause" && result.fault_pattern.includes("死锁");
});

test("T-0064: 协商超时 → need_intervention", () => {
  const event: FaultEvent = {
    role_name: "前端组长", role_type: "team_lead",
    description: "协商超时", consecutive_failures: 0, negotiation_timeout: true,
  };
  const result = classify_fault(event);
  return result.level === "need_intervention" && result.fault_pattern.includes("超时");
});

test("T-0064: 死锁优先于连续次数", () => {
  const event: FaultEvent = {
    role_name: "张三", role_type: "member",
    description: "死锁+连续5次", consecutive_failures: 5, is_deadlock: true,
  };
  const result = classify_fault(event);
  return result.level === "need_pause"; // 死锁优先级最高
});

// ============ T-0065: 成员级别故障处理 ============
console.log("\n=== T-0065: 成员级别故障处理 ===");

function make_member_state(): MemberFaultState {
  return {
    member_name: "张三", group_name: "前端组",
    rejection_count: 0, rejected_reports: [],
    status: "active",
  };
}

test("T-0065: handle_single_reject 打回+修改意见+时限", () => {
  const state = make_member_state();
  const action: RejectAction = {
    member_name: "张三", reject_reason: "空实现",
    fix_suggestions: ["补全业务逻辑", "添加测试"], deadline_hours: 24,
  };
  const result = handle_single_reject(state, action);
  return result.state.rejection_count === 1 &&
    result.state.status === "warned" &&
    result.state.last_fix_deadline !== undefined &&
    result.message.includes("空实现");
});

test("T-0065: handle_single_reject 累计次数", () => {
  let state = make_member_state();
  state.rejection_count = 2;
  const action: RejectAction = {
    member_name: "张三", reject_reason: "第三次", fix_suggestions: ["重新实现"], deadline_hours: 8,
  };
  const result = handle_single_reject(state, action);
  return result.state.rejection_count === 3;
});

test("T-0065: escalate_to_lead_agent 升级主Agent", () => {
  let state = make_member_state();
  state.rejection_count = 2;
  state.rejected_reports = [{ issues: [], summary: "代码空实现", grade: "severe", should_reject: true }] as any;
  const result = escalate_to_lead_agent(state);
  return result.state.status === "escalated" && result.escalation_report.includes("升级");
});

test("T-0065: decide_member_replacement 不足3次不替换", () => {
  let state = make_member_state();
  state.rejection_count = 2;
  const result = decide_member_replacement(state);
  return result.decision === "keep";
});

test("T-0065: decide_member_replacement ≥3次→regenerate(无库存)", () => {
  let state = make_member_state();
  state.rejection_count = 3;
  const result = decide_member_replacement(state);
  return result.decision === "regenerate" && result.state.status === "replaced";
});

test("T-0065: mark_failed_card 标记失败原因", () => {
  const card = make_card("张三", "前端工程师");
  let state = make_member_state();
  state.rejection_count = 3;
  state.last_rejection_reason = "连续提交空实现";
  const marked = mark_failed_card(card, state);
  return marked.lifecycle === "project_destroy" &&
    marked.behavior_rules.some(r => r.includes("故障记录") && r.includes("空实现"));
});

// ============ T-0066: 组长级别故障处理 ============
console.log("\n=== T-0066: 组长级别故障处理 ===");

function make_lead_state(): LeadFaultState {
  return {
    lead_name: "王五", group_name: "前端组",
    audit_miss_count: 0, negotiation_timeouts: 0,
    warnings: [], status: "active",
  };
}

test("T-0066: warn_lead_audit_miss 警告+记录", () => {
  const state = make_lead_state();
  const result = warn_lead_audit_miss(state, "假实现未检测");
  return result.state.audit_miss_count === 1 &&
    result.state.warnings.length === 1 &&
    result.warning.includes("漏判");
});

test("T-0066: warn_lead_audit_miss ≥2次→status=warned", () => {
  let state = make_lead_state();
  state.audit_miss_count = 1;
  state.warnings = ["第一次"];
  const result = warn_lead_audit_miss(state, "第二次漏判");
  return result.state.audit_miss_count === 2 && result.state.status === "warned";
});

test("T-0066: decide_lead_replacement 达阈值应替换", () => {
  let state = make_lead_state();
  state.audit_miss_count = 3;
  const result = decide_lead_replacement(state);
  return result.should_replace && result.state.status === "replaced";
});

test("T-0066: decide_lead_replacement 未达阈值不替换", () => {
  let state = make_lead_state();
  state.audit_miss_count = 1;
  const result = decide_lead_replacement(state);
  return !result.should_replace;
});

test("T-0066: decide_lead_replacement 自定义阈值", () => {
  let state = make_lead_state();
  state.audit_miss_count = 2;
  const result = decide_lead_replacement(state, 2);
  return result.should_replace && result.state.status === "replaced";
});

test("T-0066: forced_arbitration_for_timeout 强制仲裁", () => {
  const state = make_lead_state();
  const result = forced_arbitration_for_timeout(state, "C-001");
  return result.state.negotiation_timeouts === 1 &&
    result.arbitration_decision.includes("强制仲裁") &&
    result.arbitration_decision.includes("C-001");
});

// ============ T-0067: 自动恢复 ============
console.log("\n=== T-0067: 自动恢复 ===");

test("T-0067: recover_member_context 继承已完成任务", () => {
  const completed: MemberRecoveryContext = {
    completed_task_ids: ["T1", "T2"],
    accepted_outputs: ["order-list.tsx"],
  };
  const new_card = make_card("新张三", "前端工程师");
  const result = recover_member_context("张三", new_card, completed);
  return result.new_card.behavior_rules.some(r => r.includes("T1")) &&
    result.new_card.behavior_rules.some(r => r.includes("T2")) &&
    result.new_card.behavior_rules.some(r => r.includes("不重做")) &&
    result.recovery_note.includes("新张三");
});

test("T-0067: recover_member_context 空完成任务", () => {
  const completed: MemberRecoveryContext = {
    completed_task_ids: [],
    accepted_outputs: [],
  };
  const new_card = make_card("新张三", "前端工程师");
  const result = recover_member_context("张三", new_card, completed);
  return result.new_card.behavior_rules.some(r => r.includes("无"));
});

test("T-0067: recover_lead_context 继承档案+阶段卡", () => {
  const stage_card: StageTaskCard = {
    stage_id: "S-001-前端层", from: "主Agent", to: "前端组长",
    goal: "完成前端", acceptance_criteria: [{ description: "正常" }],
    deadline: "2026-07-01", dependencies: {}, constraints: [],
  };
  const recovery: LeadRecoveryContext = {
    group_archive: [],
    current_stage_card: stage_card,
    group_name: "前端组",
  };
  const result = recover_lead_context("王五", "新王五", recovery);
  return result.recovery_note.includes("新王五") &&
    result.recovery_note.includes("王五") &&
    result.inherited === recovery;
});

test("T-0067: recover_from_snapshot 有效快照恢复成功", () => {
  const snapshots: ContextSnapshot[] = [{
    role_name: "张三", role_level: "member",
    created_at: new Date().toISOString(),
    content: JSON.stringify({ task: "T1" }),
    sequence: 1,
  }];
  const result = recover_from_snapshot("张三", snapshots);
  return result.recovered && result.snapshot !== undefined;
});

test("T-0067: recover_from_snapshot 无快照返回失败", () => {
  const result = recover_from_snapshot("不存在", []);
  return !result.recovered && result.message.includes("无法恢复");
});

test("T-0067: detect_deadlock 检测到死锁", () => {
  const wait_graph: Record<string, string[]> = {
    "A": ["B"],
    "B": ["C"],
    "C": ["A"], // 环: A→B→C→A
  };
  const result = detect_deadlock(wait_graph);
  return result.has_deadlock && result.cycle.length >= 3 && result.fix_order.length >= 3;
});

test("T-0067: detect_deadlock 无死锁", () => {
  const wait_graph: Record<string, string[]> = {
    "A": ["B"],
    "B": ["C"],
    "C": [],
  };
  const result = detect_deadlock(wait_graph);
  return !result.has_deadlock;
});

test("T-0067: detect_deadlock 死锁强制定序(字典序)", () => {
  const wait_graph: Record<string, string[]> = {
    "Z": ["A"],
    "A": ["Z"],
  };
  const result = detect_deadlock(wait_graph);
  return result.has_deadlock && result.fix_order[0] < result.fix_order[1]; // 字典序
});

test("T-0067: resolve_output_conflict 败方废弃冲突", () => {
  const loser_card = make_card("败方", "工程师");
  const result = resolve_output_conflict("胜方", "败方", "接口定义不一致", loser_card);
  return result.updated_loser_card.behavior_rules.some(r => r.includes("败于")) &&
    result.updated_loser_card.behavior_rules.some(r => r.includes("废弃冲突部分")) &&
    result.resolution_note.includes("败方");
});

// ============ T-0068: 故障记录 ============
console.log("\n=== T-0068: 故障记录 ===");

test("T-0068: create_fault_record 创建故障档案", () => {
  const input: FaultRecordInput = {
    role_name: "张三", role_type: "member",
    fault_description: "连续提交空实现3次",
    fault_level: "need_replace",
    fault_pattern: "连续失败",
    suggestion: "从库存替换",
  };
  const record = create_fault_record(input, []);
  return record.fault_id.startsWith("F-") &&
    record.role_name === "张三" &&
    record.fault_count === 1 &&
    record.level === "need_replace" &&
    record.fault_pattern === "连续失败";
});

test("T-0068: create_fault_record 累计计数", () => {
  const existing: FaultRecord[] = [
    { fault_id: "F-1", role_name: "张三", fault_count: 1,
      latest_fault: { date: "", description: "第一次" },
      fault_pattern: "", suggestion: "", level: "self_heal" },
  ];
  const input: FaultRecordInput = {
    role_name: "张三", role_type: "member",
    fault_description: "第二次",
    fault_level: "need_intervention",
    fault_pattern: "重复", suggestion: "介入",
  };
  const record = create_fault_record(input, existing);
  return record.fault_count === 2;
});

test("T-0068: write_fault_to_archive 写入项目档案", () => {
  const archive = make_archive();
  const fault: FaultRecord = {
    fault_id: "F-001", role_name: "张三", fault_count: 1,
    latest_fault: { date: "", description: "空实现" },
    fault_pattern: "虚假代码", suggestion: "替换", level: "need_replace",
  };
  const updated = write_fault_to_archive(fault, archive);
  return updated.fault_records.length === 1 &&
    updated.fault_records[0].fault_id === "F-001";
});

test("T-0068: get_role_fault_history 获取历史", () => {
  let archive = make_archive();
  archive = write_fault_to_archive({
    fault_id: "F-1", role_name: "张三", fault_count: 1,
    latest_fault: { date: "", description: "d" },
    fault_pattern: "", suggestion: "", level: "self_heal",
  }, archive);
  archive = write_fault_to_archive({
    fault_id: "F-2", role_name: "李四", fault_count: 1,
    latest_fault: { date: "", description: "d" },
    fault_pattern: "", suggestion: "", level: "self_heal",
  }, archive);
  const history = get_role_fault_history("张三", archive);
  return history.length === 1 && history[0].fault_id === "F-1";
});

test("T-0068: check_replacement_threshold 达阈值", () => {
  let archive = make_archive();
  archive = write_fault_to_archive({
    fault_id: "F-1", role_name: "张三", fault_count: 1,
    latest_fault: { date: "", description: "" },
    fault_pattern: "", suggestion: "", level: "need_replace",
  }, archive);
  archive = write_fault_to_archive({
    fault_id: "F-2", role_name: "张三", fault_count: 2,
    latest_fault: { date: "", description: "" },
    fault_pattern: "", suggestion: "", level: "need_replace",
  }, archive);
  archive = write_fault_to_archive({
    fault_id: "F-3", role_name: "张三", fault_count: 3,
    latest_fault: { date: "", description: "" },
    fault_pattern: "", suggestion: "", level: "need_pause",
  }, archive);
  return check_replacement_threshold("张三", archive, 3);
});

test("T-0068: check_replacement_threshold 未达阈值", () => {
  let archive = make_archive();
  archive = write_fault_to_archive({
    fault_id: "F-1", role_name: "张三", fault_count: 1,
    latest_fault: { date: "", description: "" },
    fault_pattern: "", suggestion: "", level: "self_heal",
  }, archive);
  return !check_replacement_threshold("张三", archive, 3);
});

// ============ 汇总 ============
console.log(`\n总计: ${pass + fail} 测试, ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
