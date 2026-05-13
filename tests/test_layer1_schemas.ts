/**
 * QA Test: T-0007 ~ T-0012 Schema 验证
 */
import {
  StructuredArchive, WorkRecord, SkillEvolution,
  SatisfactionRecord, SatisfactionScore, ClientModification,
  ConflictRecord, ConflictSeverity, ConflictType,
  FaultRecord, FaultLevel,
  ProjectArchive,
  RoleInventory, RoleInventoryEntry, RoleInventoryIndex, FrozenPersonaCard,
  PersonaCard,
} from "../src/schemas";

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

// ===== T-0007: StructuredArchive Schema =====

const valid_card: PersonaCard = {
  name: "林一舟", role: "后端工程师", summary: "订单模块",
  must_do: ["订单CRUD", "状态机", "事务"],
  must_not_do: ["不碰支付", "不碰数据库主键"],
  tech_env: { language: "Go" },
  input_sources: [{ from: "API Gateway", format: "JSON" }],
  output_targets: [{ to: "前端组长", format: "OpenAPI" }],
  behavior_rules: ["越界回复", "不确定回复"],
  permission_mode: "bypassPermissions", lifecycle: "permanent",
};

const work_record: WorkRecord = {
  task_id: "T-003", time_range: "2026-05-13 ~ 2026-05-14",
  goal: "订单状态机", decision_chain: "Saga vs TCC → 选Saga",
  outputs: ["api/order/statemachine.go"],
  pitfalls: ["并发死锁 → 改为乐观锁"],
  reusable_snippets: ["通用状态机抽象层"],
};

const skill_evolution: SkillEvolution = {
  start: "Go中等 + PostgreSQL基础",
  mid: "Go事务模式 + 分布式锁",
  end: "高并发交易设计",
};

test("T-0007: 有效结构化档案 → 验证", () => {
  const archive: StructuredArchive = {
    name: "林一舟", role: "后端工程师",
    lifecycle: "permanent", base_info: valid_card,
    work_history: [work_record],
    skill_evolution,
    annotations: [{ date: "2026-05-14", author: "主Agent", content: "乐观锁可复用" }],
  };
  return archive.name === "林一舟"
    && archive.work_history.length === 1
    && archive.skill_evolution.end.includes("高并发")
    && archive.annotations[0].author === "主Agent";
});

test("T-0007: 空工作履历 → 验证", () => {
  const archive: StructuredArchive = {
    name: "x", role: "x", lifecycle: "project_destroy",
    base_info: valid_card, work_history: [],
    skill_evolution: { start: "", mid: "", end: "" }, annotations: [],
  };
  return archive.work_history.length === 0;
});

// ===== T-0008: SatisfactionRecord Schema =====

test("T-0008: 有效满意度记录 → 验证", () => {
  const score: SatisfactionScore = {
    quality: 4, standard: 3, collaboration: 5, bonus: 0,
    composite: 3.7, // 4*0.4 + 3*0.3 + 5*0.2 + 0*0.1 = 3.7
  };
  const record: SatisfactionRecord = {
    stage_id: "S-002", group_name: "后端组",
    lead_score: score,
    member_details: [
      { name: "林一舟", scores: score },
    ],
    client_modifications: [
      { original_score: 3, modified_score: 4, client_reason: "代码质量超出预期", dimension: "standard" },
    ],
    final_scores: { ...score, standard: 4, composite: 4.0 },
  };
  return record.stage_id === "S-002"
    && record.member_details.length === 1
    && record.client_modifications[0].modified_score === 4
    && record.final_scores.standard === 4;
});

test("T-0008: 无客户修改 → 验证", () => {
  const score: SatisfactionScore = { quality: 4, standard: 4, collaboration: 4, bonus: 0, composite: 4.0 };
  const record: SatisfactionRecord = {
    stage_id: "S-001", group_name: "前端组",
    lead_score: score, member_details: [], client_modifications: [], final_scores: score,
  };
  return record.client_modifications.length === 0;
});

// ===== T-0009: ConflictRecord Schema =====

test("T-0009: 阻塞级接口冲突 → 验证", () => {
  const conflict: ConflictRecord = {
    conflict_id: "C-001",
    type: "interface" as ConflictType,
    parties: ["后端组长", "前端组长"],
    severity: "blocking" as ConflictSeverity,
    detected_by: "后端组长",
    detection_time: "2026-05-15T10:00:00Z",
    resolution_path: "lead_arbitration",
    result: "采用后端组方案，统一为 {code, data, msg}",
    convention_update: "全局约定: 响应结构统一",
    resolved_at: "2026-05-15T11:00:00Z",
  };
  return conflict.type === "interface"
    && conflict.severity === "blocking"
    && conflict.resolution_path === "lead_arbitration"
    && conflict.parties.length === 2;
});

test("T-0009: 四种冲突类型 → 验证", () => {
  const types: ConflictType[] = ["interface", "data", "convention", "logic"];
  const records: ConflictRecord[] = types.map((t, i) => ({
    conflict_id: `C-00${i}`,
    type: t,
    parties: ["A", "B"],
    severity: t === "convention" ? "delayed" : "blocking",
    detected_by: "组长",
    detection_time: "2026-05-15",
    resolution_path: "negotiation",
    result: "通过协商解决",
  }));
  return records.length === 4
    && records[0].type === "interface"
    && records[3].type === "logic"
    && records[2].severity === "delayed";
});

// ===== T-0010: FaultRecord Schema =====

test("T-0010: 自愈级故障 → 验证", () => {
  const fault: FaultRecord = {
    fault_id: "F-001",
    role_name: "张思远",
    fault_count: 1,
    latest_fault: { date: "2026-05-16", description: "订单API空实现" },
    fault_pattern: "首次交付时边界条件遗漏",
    suggestion: "后续使用此卡时加'必须做边界测试'约束",
    level: "self_heal",
  };
  return fault.level === "self_heal"
    && fault.fault_count === 1
    && fault.latest_fault.description.includes("空实现");
});

test("T-0010: 四级故障分类 → 验证", () => {
  const levels: FaultLevel[] = ["self_heal", "need_intervention", "need_replace", "need_pause"];
  const faults: FaultRecord[] = levels.map((l, i) => ({
    fault_id: `F-00${i}`,
    role_name: `角色${i}`,
    fault_count: i + 1,
    latest_fault: { date: "2026-05-16", description: "test" },
    fault_pattern: "pattern",
    suggestion: "suggestion",
    level: l,
  }));
  return faults.length === 4
    && faults[0].level === "self_heal"
    && faults[3].level === "need_pause";
});

// ===== T-0011: ProjectArchive Schema =====

test("T-0011: 完整项目档案 → 验证", () => {
  const archive: ProjectArchive = {
    project_id: "PROJ-2026-001",
    project_name: "电商系统",
    time_range: "2026-05-13 ~ 2026-06-20",
    status: "completed",
    original_requirements: "做一个电商系统，React+Go+PostgreSQL",
    team_structure: {
      lead_agent: "主Agent",
      groups: [
        { name: "前端组", lead: "赵明远", members: ["A", "B", "C"] },
        { name: "后端组", lead: "孙若溪", members: ["林一舟", "张思远", "王若涵"] },
      ],
    },
    stage_records: [
      { stage_id: "S-001", completed_at: "2026-05-14", outputs: ["脚手架", "CI/CD"], satisfaction: 4.2 },
    ],
    conflict_records: [],
    fault_records: [],
    satisfaction_summary: { group_avg: { "后端组": 4.0, "前端组": 3.9 }, project_avg: 3.95 },
    reusable_outputs: ["库存通用抽象层", "错误码全局约定表"],
    inventory_changes: [
      { action: "add", name: "林一舟" },
      { action: "remove", name: "张思远" },
    ],
  };
  return archive.project_name === "电商系统"
    && archive.team_structure.groups.length === 2
    && archive.team_structure.groups[1].members.includes("林一舟")
    && archive.satisfaction_summary.project_avg === 3.95
    && archive.reusable_outputs.length === 2
    && archive.inventory_changes.length === 2;
});

// ===== T-0012: RoleInventory Schema =====

test("T-0012: 有效角色库存条目 → 验证", () => {
  const frozen: FrozenPersonaCard = {
    original: valid_card,
    frozen_at: "2026-06-20",
    tech_tags: ["Go", "PostgreSQL", "分布式事务", "订单系统"],
  };
  const entry: RoleInventoryEntry = {
    persona_card: frozen,
    skill_evolution,
    history_scores: [
      { project: "电商系统", score: 4.2 },
      { project: "CMS系统", score: 4.0 },
    ],
    avg_score: 4.1,
    suitable_scenarios: ["高并发交易", "状态机密集型", "Go技术栈"],
    unsuitable_scenarios: ["纯前端项目", "Python项目"],
    status: "active",
  };
  return entry.persona_card.tech_tags.includes("Go")
    && entry.history_scores.length === 2
    && entry.avg_score === 4.1
    && entry.suitable_scenarios.length === 3
    && entry.unsuitable_scenarios.length === 2
    && entry.status === "active";
});

test("T-0012: 库存索引 → 验证", () => {
  const index: RoleInventoryIndex = {
    entries: [
      { name: "林一舟", tech_tags: ["Go", "PostgreSQL"], avg_score: 4.1, scenarios: ["高并发交易"], status: "active" },
      { name: "王若涵", tech_tags: ["Go", "缓存"], avg_score: 4.3, scenarios: ["缓存密集型"], status: "active" },
      { name: "张思远", tech_tags: ["Go"], avg_score: 2.8, scenarios: [], status: "dormant" },
    ],
  };
  const inventory: RoleInventory = {
    entries: [], // 简化测试
    index,
  };
  return inventory.index.entries.length === 3
    && inventory.index.entries[0].name === "林一舟"
    && inventory.index.entries[2].status === "dormant";
});

test("T-0012: 库存状态 active vs dormant → 验证", () => {
  const active: RoleInventoryEntry = {
    persona_card: {
      original: valid_card, frozen_at: "2026-06-20",
      tech_tags: ["Go"],
    },
    skill_evolution: { start: "", mid: "", end: "" },
    history_scores: [], avg_score: 4.0,
    suitable_scenarios: [], unsuitable_scenarios: [],
    status: "active",
  };
  const dormant: RoleInventoryEntry = {
    ...active,
    status: "dormant",
  };
  return active.status === "active" && dormant.status === "dormant";
});

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
console.log(fail === 0 ? "QA: PASS" : "QA: FAIL");
process.exit(fail > 0 ? 1 : 0);
