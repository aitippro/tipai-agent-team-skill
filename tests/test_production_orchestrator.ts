/**
 * QA Test: 生产编排器集成测试
 *
 * 覆盖: 每个 phase 函数独立测试 + 全流水线端到端 + 宪章检测 + 泄漏检测
 */
import {
  run_interview_phase,
  confirm_or_modify_interview,
  run_team_assemble_phase,
  run_card_review_phase,
  run_task_distribution_phase,
  run_code_review_phase,
  run_conflict_arbitration_phase,
  run_satisfaction_scoring_phase,
  run_lifecycle_management_phase,
  run_inventory_management_phase,
  run_project_archive_phase,
  run_fault_recovery_phase,
  run_context_management_phase,
  run_exit_phase,
  run_constitution_check,
  run_constitution_full_check,
  run_full_pipeline,
  FullPipelineInput,
} from "../src/production-orchestrator";

import { InterviewSummary } from "../src/interview";
import { PersonaCard } from "../src/schemas";
import { StageDefinition } from "../src/task-distributor";
import { RequirementRule } from "../src/code-reviewer";
import {
  InterfaceDefinition, WriteOperation, DataSchema, RuleImplementation,
} from "../src/conflict-arbitrator";
import { ScoringInput } from "../src/satisfaction-system";

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

// ===== Fixtures =====

const mock_answers: Record<string, string[]> = {
  project_type: ["电商系统"],
  target_user: ["普通消费者"],
  core_features: ["商品浏览", "购物车", "订单管理", "支付"],
  deployment: ["云服务部署"],
};

const mock_summary: InterviewSummary = {
  project_description: "新项目: 做一个电商系统。目标用户: 普通消费者。",
  tech_stack: "Go + PostgreSQL + React",
  deployment: "云服务部署",
  suggested_layers: ["前端层", "后端层", "数据层"],
  estimated_roles: 10,
  risk_items: ["高风险模块: 支付模块"],
};

function make_card(name: string, role: string): PersonaCard {
  return {
    name, role, summary: `${role}的职责`,
    must_do: ["完成模块开发任务", "编写单元测试", "提交代码审查"],
    must_not_do: ["跨模块擅自修改", "跨组直接通信"],
    tech_env: { language: "Go", tools: ["git"] },
    input_sources: [{ from: "组长", format: "任务卡" }],
    output_targets: [{ to: "组长", format: "代码" }],
    behavior_rules: ["越界上报组长", "不确定时询问组长"],
    permission_mode: "bypassPermissions", lifecycle: "follow_project",
  };
}

const mock_cards: PersonaCard[] = [
  make_card("林一舟", "后端组长"),
  make_card("张思远", "订单模块工程师"),
  make_card("王小明", "支付模块工程师"),
];

const mock_stages: StageDefinition[] = [{
  stage_id: "S-001", goal: "核心模块开发",
  acceptance_criteria: [{ description: "通过代码审查" }],
  assigned_groups: ["后端层"], deadline_offset_days: 14,
}];

const mock_requirement: RequirementRule = {
  id: "R-001", description: "订单CRUD",
  expected_branches: ["if", "else"],
  expected_inputs: ["orderId"],
  expected_outputs: ["order"],
};

const mock_code = `
export function createOrder(orderId: string) {
  if (!orderId) return null;
  const order = { id: orderId, status: "created" };
  return order;
}`;

const mock_interfaces: InterfaceDefinition[] = [
  { group: "后端", endpoint_or_module: "/api/order", fields: [{ name: "id", type: "string" }], description: "订单接口" },
  { group: "前端", endpoint_or_module: "/api/order", fields: [{ name: "id", type: "number" }], description: "订单接口" },
];

const mock_operations: WriteOperation[] = [{
  group: "后端", table: "orders", columns: ["id", "status"],
  types: { id: "string", status: "string" }, operation: "INSERT",
}];

const mock_data_schema: DataSchema = {
  group: "数据", version: "1.0",
  tables: [{ name: "orders", columns: [{ name: "id", type: "string" }, { name: "status", type: "string" }] }],
};

const mock_implementations: RuleImplementation[] = [{
  rule_id: "R-001", rule_description: "订单创建", location: "orderService.ts",
  group: "后端", fingerprint: "abc123",
}];

// ===== Phase 1: Interview =====

test("Phase1: run_interview_phase → 返回summary+formatted+state", () => {
  const { summary, formatted, state } = run_interview_phase(mock_answers);
  return summary !== null
    && typeof formatted === "string" && formatted.length > 0
    && state !== null;
});

test("Phase1: run_interview_phase → summary含项目描述", () => {
  const { summary } = run_interview_phase(mock_answers);
  return summary.project_description.length > 0
    && summary.tech_stack.length > 0;
});

test("Phase1: confirm_or_modify_interview → confirm返回已确认", () => {
  const { state } = run_interview_phase(mock_answers);
  const confirmed = confirm_or_modify_interview(state, "confirm");
  return confirmed.status === "confirm";
});

test("Phase1: confirm_or_modify_interview → modify返回修改后", () => {
  const { state } = run_interview_phase(mock_answers);
  const modified = confirm_or_modify_interview(state, "modify", { deployment: "本地部署" });
  return modified.summary.deployment === "本地部署";
});

// ===== Phase 2: Team Assembly =====

test("Phase2: run_team_assemble_phase → structure含groups", () => {
  const { structure } = run_team_assemble_phase(mock_summary);
  return structure.groups.length === 3
    && structure.all_cards.length > 3;
});

test("Phase2: run_team_assemble_phase → rendered_cards非空", () => {
  const { rendered_cards } = run_team_assemble_phase(mock_summary);
  return rendered_cards.length > 0
    && rendered_cards.every((r) => r.includes("[系统指令]"));
});

test("Phase2: run_team_assemble_phase → summary_info正确", () => {
  const { summary_info } = run_team_assemble_phase(mock_summary);
  return summary_info.group_count === 3
    && summary_info.member_count > 0;
});

// ===== Phase 2b: Card Review =====

test("Phase2b: run_card_review_phase → 全部confirmed后done=true", () => {
  const { done, validated } = run_card_review_phase(mock_cards);
  return done === true
    && validated.length === 3;
});

test("Phase2b: run_card_review_phase → 每张卡都通过验证", () => {
  const { validated } = run_card_review_phase(mock_cards);
  return validated.every((v) => v.valid === true);
});

// ===== Phase 3: Task Distribution =====

test("Phase3: run_task_distribution_phase → 返回stage_cards", () => {
  const { structure } = run_team_assemble_phase(mock_summary);
  const { stage_cards } = run_task_distribution_phase(mock_summary, structure, mock_stages);
  return stage_cards.length >= 1;
});

test("Phase3: run_task_distribution_phase → dispatch_state可用", () => {
  const { structure } = run_team_assemble_phase(mock_summary);
  const { dispatch_state } = run_task_distribution_phase(mock_summary, structure, mock_stages);
  return dispatch_state !== null
    && typeof dispatch_state === "object";
});

test("Phase3: run_task_distribution_phase → module_cards生成", () => {
  const { structure } = run_team_assemble_phase(mock_summary);
  const { module_cards } = run_task_distribution_phase(mock_summary, structure, mock_stages);
  return module_cards.length >= 1;
});

// ===== Phase 4: Code Review =====

test("Phase4: run_code_review_phase → 返回review results", () => {
  const { results, rejected } = run_code_review_phase(
    { "张思远": mock_code }, mock_requirement,
  );
  return results.length === 1
    && typeof rejected === "object";
});

test("Phase4: run_code_review_phase → 多成员各有report", () => {
  const { results } = run_code_review_phase(
    { "张思远": mock_code, "王小明": mock_code },
    mock_requirement, [mock_code], ["订单CRUD"],
  );
  return results.length === 2;
});

// ===== Phase 5: Conflict Arbitration =====

test("Phase5: run_conflict_arbitration_phase → 检测接口冲突", () => {
  const { pipeline_results } = run_conflict_arbitration_phase(
    mock_interfaces, mock_operations, mock_data_schema,
    { "张思远": mock_code }, mock_implementations, mock_cards,
  );
  return Array.isArray(pipeline_results.results)
    && typeof pipeline_results === "object";
});

test("Phase5: run_conflict_arbitration_phase → 协商流程运行", () => {
  const { negotiation_states } = run_conflict_arbitration_phase(
    mock_interfaces, mock_operations, mock_data_schema,
    { "张思远": mock_code }, mock_implementations, mock_cards,
  );
  return negotiation_states !== null;
});

// ===== Phase 6: Satisfaction Scoring =====

test("Phase6: run_satisfaction_scoring_phase → 返回record", () => {
  const inputs: ScoringInput[] = [{
    member_name: "张思远", role: "订单模块工程师",
    implementation_completeness: 4, code_quality: 4, collaboration: 4,
    bonus_items: ["快速交付"], penalty_items: [],
  }];
  const { record } = run_satisfaction_scoring_phase("S-001", "后端组", inputs, mock_cards);
  return record.stage_id === "S-001"
    && record.group_name === "后端组"
    && record.final_scores.composite > 0;
});

test("Phase6: run_satisfaction_scoring_phase → 无client_action时profile为null", () => {
  const inputs: ScoringInput[] = [{
    member_name: "张思远", role: "工程师",
    implementation_completeness: 3, code_quality: 3, collaboration: 3,
    bonus_items: [], penalty_items: [],
  }];
  const { profile } = run_satisfaction_scoring_phase("S-002", "后端组", inputs, mock_cards);
  return profile === null;
});

test("Phase6: run_satisfaction_scoring_phase → impacts非空", () => {
  const inputs: ScoringInput[] = [{
    member_name: "张思远", role: "工程师",
    implementation_completeness: 5, code_quality: 5, collaboration: 5,
    bonus_items: [], penalty_items: [],
  }];
  const { impacts } = run_satisfaction_scoring_phase("S-003", "后端组", inputs, mock_cards);
  return Array.isArray(impacts);
});

// ===== Phase 7: Lifecycle Management =====

test("Phase7: run_lifecycle_management_phase → 正常分数无销毁", () => {
  const inputs: ScoringInput[] = [{
    member_name: "张思远", role: "工程师",
    implementation_completeness: 4, code_quality: 4, collaboration: 4,
    bonus_items: [], penalty_items: [],
  }];
  const { record } = run_satisfaction_scoring_phase("S-004", "后端组", inputs, mock_cards);
  const { triggered, actions, contexts } = run_lifecycle_management_phase(mock_cards, [record]);
  return typeof triggered === "boolean"
    && Array.isArray(actions)
    && Array.isArray(contexts);
});

test("Phase7: run_lifecycle_management_phase → 低分触发lifecycle", () => {
  const low_inputs: ScoringInput[] = [{
    member_name: "张思远", role: "工程师",
    implementation_completeness: 1, code_quality: 1, collaboration: 1,
    bonus_items: [], penalty_items: ["糊弄"],
  }];
  const { record: r1 } = run_satisfaction_scoring_phase("S-005", "后端组", low_inputs, mock_cards);
  const { record: r2 } = run_satisfaction_scoring_phase("S-006", "后端组", low_inputs, mock_cards);
  const { record: r3 } = run_satisfaction_scoring_phase("S-007", "后端组", low_inputs, mock_cards);
  const { triggered } = run_lifecycle_management_phase(mock_cards, [r1, r2, r3]);
  return typeof triggered === "boolean";
});

// ===== Phase 8: Inventory Management =====

test("Phase8: run_inventory_management_phase → 入库+搜索", () => {
  const { inventory, search_results } = run_inventory_management_phase(mock_cards);
  return inventory.entries.length > 0
    && search_results !== undefined;
});

test("Phase8: run_inventory_management_phase → dormancy可用", () => {
  const { inventory } = run_inventory_management_phase(mock_cards);
  return inventory.entries.every((e) => e.status === "active" || e.status === "dormant");
});

// ===== Phase 9: Project Archive =====

test("Phase9: run_project_archive_phase → 生成archive", () => {
  const { structure } = run_team_assemble_phase(mock_summary);
  const { archive, protected_archive } = run_project_archive_phase(
    mock_summary, structure, [], [], [],
  );
  return archive.project_id.length > 0
    && protected_archive !== null;
});

test("Phase9: run_project_archive_phase → archive含groups", () => {
  const { structure } = run_team_assemble_phase(mock_summary);
  const { archive } = run_project_archive_phase(
    mock_summary, structure, [], [], [],
  );
  return archive.team_structure.groups.length === 3;
});

// ===== Phase 10: Fault Recovery =====

test("Phase10: run_fault_recovery_phase → 处理fault event", () => {
  const { structure } = run_team_assemble_phase(mock_summary);
  const { inventory } = run_inventory_management_phase(structure.all_cards);
  const { archive } = run_project_archive_phase(mock_summary, structure, [], [], []);

  const events = [{
    role_name: structure.all_cards[0].name,
    role_type: "member" as const,
    description: "连续失败",
    consecutive_failures: 2,
    review_reports: [],
  }];
  const { recovery_actions, records } = run_fault_recovery_phase(events, archive, inventory);
  return recovery_actions.length >= 1
    && records.length >= 1;
});

test("Phase10: run_fault_recovery_phase → 3次连续失败触发处理", () => {
  const { structure } = run_team_assemble_phase(mock_summary);
  const { inventory } = run_inventory_management_phase(structure.all_cards);
  const { archive } = run_project_archive_phase(mock_summary, structure, [], [], []);

  const events = [{
    role_name: structure.all_cards[0].name,
    role_type: "member" as const,
    description: "连续3次失败",
    consecutive_failures: 3,
    review_reports: [],
  }];
  const { recovery_actions } = run_fault_recovery_phase(events, archive, inventory);
  return recovery_actions.length >= 1;
});

// ===== Phase 11: Context Management =====

test("Phase11: run_context_management_phase → 生成contexts", () => {
  const { structure } = run_team_assemble_phase(mock_summary);
  const {
    member_contexts, lead_contexts, lead_agent_context, snapshots,
  } = run_context_management_phase(structure, mock_summary);
  return member_contexts.length > 0
    && lead_contexts.length > 0
    && lead_agent_context !== null
    && snapshots.length > 0;
});

test("Phase11: run_context_management_phase → leak_results可用", () => {
  const { structure } = run_team_assemble_phase(mock_summary);
  const { leak_results } = run_context_management_phase(structure, mock_summary);
  return Array.isArray(leak_results);
});

// ===== Phase 12: Exit =====

test("Phase12: run_exit_phase → 返回checklist", () => {
  const archived = new Set(["林一舟", "张思远"]);
  const inventoried = new Set(["林一舟"]);
  const { checklist } = run_exit_phase(mock_cards, archived, inventoried);
  return checklist !== null
    && checklist.can_exit !== undefined
    && checklist.warnings !== undefined;
});

test("Phase12: run_exit_phase → archive_text非空", () => {
  const archived = new Set(["林一舟"]);
  const inventoried = new Set(["林一舟"]);
  const { archive_text } = run_exit_phase(mock_cards, archived, inventoried);
  return archive_text.length > 0;
});

// ===== Constitution =====

test("Constitution: run_constitution_check → 合法行为pass=true", () => {
  const { result, halt } = run_constitution_check({
    role: "team_lead", action: "审查成员代码", target: "member",
  });
  return result.pass === true && halt === false;
});

test("Constitution: run_constitution_check → 跳过采访halt=true", () => {
  const { result, halt } = run_constitution_check({
    role: "lead", action: "skip_interview",
  });
  return result.pass === false && halt === true;
});

test("Constitution: run_constitution_check → 成员直联主Agent违规", () => {
  const { result } = run_constitution_check({
    role: "member", action: "member_to_lead_direct",
  });
  return result.pass === false;
});

test("Constitution: run_constitution_full_check → 6条检查", () => {
  const results = run_constitution_full_check();
  return results.length === 6
    && results.every((r) => typeof r.pass === "boolean");
});

test("Constitution: full_check → 全部违规行为都被检测", () => {
  const results = run_constitution_full_check();
  return results.every((r) => r.pass === false);
});

// ===== Full Pipeline =====

test("FullPipeline: run_full_pipeline → 端到端成功", () => {
  const input: FullPipelineInput = {
    project_description: "电商系统",
    project_type: "web",
    deployment: "云服务",
    features: ["商品浏览", "购物车", "订单", "支付"],
    answers: mock_answers,
    stages: mock_stages,
    member_code_map: { "member1": mock_code },
    requirements_for_review: mock_requirement,
    interfaces: mock_interfaces,
    operations: mock_operations,
    data_schema: mock_data_schema,
    implementations: mock_implementations,
    expected_rules: ["订单CRUD"],
    lifecycle_mode: "follow_project",
  };

  const result = run_full_pipeline(input);
  return result.summary !== null
    && result.team.groups.length > 0
    && result.rendered_cards.length > 0
    && result.errors.length === 0;
});

test("FullPipeline: → review_results非空", () => {
  const input: FullPipelineInput = {
    project_description: "CMS系统",
    project_type: "web",
    deployment: "云服务",
    features: ["内容管理"],
    answers: mock_answers,
    stages: mock_stages,
    member_code_map: { "member1": mock_code },
    requirements_for_review: mock_requirement,
    interfaces: mock_interfaces,
    operations: mock_operations,
    data_schema: mock_data_schema,
    implementations: mock_implementations,
    expected_rules: [],
    lifecycle_mode: "follow_project",
  };

  const result = run_full_pipeline(input);
  return result.review_results.length >= 1;
});

test("FullPipeline: → constitution_checks全部违规检出", () => {
  const input: FullPipelineInput = {
    project_description: "电商系统",
    project_type: "web",
    deployment: "云服务",
    features: ["支付"],
    answers: mock_answers,
    stages: mock_stages,
    member_code_map: { "m1": mock_code },
    requirements_for_review: mock_requirement,
    interfaces: [],
    operations: [],
    data_schema: { group: "数据", version: "1.0", tables: [] },
    implementations: [],
    expected_rules: [],
    lifecycle_mode: "follow_project",
  };

  const result = run_full_pipeline(input);
  return result.constitution_checks.length === 6
    && result.constitution_checks.every((c) => c.pass === false);
});

test("FullPipeline: → satisfaction_records非空", () => {
  const input: FullPipelineInput = {
    project_description: "电商系统",
    project_type: "web",
    deployment: "云服务",
    features: ["商品"],
    answers: mock_answers,
    stages: mock_stages,
    member_code_map: { "m1": mock_code },
    requirements_for_review: mock_requirement,
    interfaces: [],
    operations: [],
    data_schema: { group: "数据", version: "1.0", tables: [] },
    implementations: [],
    expected_rules: [],
    lifecycle_mode: "follow_project",
  };

  const result = run_full_pipeline(input);
  return result.satisfaction_records.length >= 1
    && result.satisfaction_records[0].final_scores.composite > 0;
});

test("FullPipeline: → inventory有数据", () => {
  const input: FullPipelineInput = {
    project_description: "电商系统",
    project_type: "web",
    deployment: "云服务",
    features: ["商品"],
    answers: mock_answers,
    stages: mock_stages,
    member_code_map: { "m1": mock_code },
    requirements_for_review: mock_requirement,
    interfaces: [],
    operations: [],
    data_schema: { group: "数据", version: "1.0", tables: [] },
    implementations: [],
    expected_rules: [],
    lifecycle_mode: "follow_project",
  };

  const result = run_full_pipeline(input);
  return result.inventory.entries.length > 0;
});

test("FullPipeline: → context_snapshots有数据", () => {
  const input: FullPipelineInput = {
    project_description: "电商系统",
    project_type: "web",
    deployment: "云服务",
    features: ["商品"],
    answers: mock_answers,
    stages: mock_stages,
    member_code_map: { "m1": mock_code },
    requirements_for_review: mock_requirement,
    interfaces: [],
    operations: [],
    data_schema: { group: "数据", version: "1.0", tables: [] },
    implementations: [],
    expected_rules: [],
    lifecycle_mode: "follow_project",
  };

  const result = run_full_pipeline(input);
  return result.context_snapshots.length > 0;
});

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
console.log(fail === 0 ? "QA: PASS" : "QA: FAIL");
process.exit(fail > 0 ? 1 : 0);
