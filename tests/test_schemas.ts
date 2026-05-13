/**
 * QA Test: T-0004 PersonaCard Schema + T-0005 验证 + T-0006 TaskCard Schema
 */
import { PersonaCard, StageTaskCard, ModuleTaskCard } from "../src/schemas";
import { validate_persona_card, validate_stage_task_card, validate_module_task_card } from "../src/validation";

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

// ===== T-0004: PersonaCard Schema =====

const valid_card: PersonaCard = {
  name: "林一舟",
  role: "订单模块后端工程师",
  summary: "负责订单全链路",
  must_do: ["订单状态机", "库存扣减", "事务一致性", "异步消息"],
  must_not_do: ["不碰支付外部回调", "不设计数据库主键策略"],
  tech_env: { language: "Go 1.22+", framework: "Gin", tools: ["PostgreSQL"] },
  input_sources: [
    { from: "API Gateway", format: "HTTP JSON" },
    { from: "支付模块", format: "支付确认事件" },
  ],
  output_targets: [{ to: "前端组长", format: "OpenAPI 3.0 yaml" }],
  behavior_rules: [
    "遇到超出能力边界的需求，回复: 超出职责范围，请转交组长",
    "不确定技术选型时，回复: 待组长确认",
  ],
  permission_mode: "bypassPermissions",
  lifecycle: "permanent",
};

test("有效人物卡 → pass", () => {
  const r = validate_persona_card(valid_card);
  return r.valid === true && r.errors.length === 0;
});

test("name 为空 → error", () => {
  const c = { ...valid_card, name: "" };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "name");
});

test("role 为空 → error", () => {
  const c = { ...valid_card, role: "" };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "role");
});

test("summary 为空 → error", () => {
  const c = { ...valid_card, summary: "" };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "summary");
});

test("summary >20字 → error", () => {
  const c = { ...valid_card, summary: "这是一段超过二十个字的非常非常长的概述内容用来测试验证逻辑" };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "summary" && e.message.includes("≤20"));
});

test("must_do <3条 → error", () => {
  const c = { ...valid_card, must_do: ["只做一件事", "再做一件"] };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "must_do");
});

test("must_not_do <2条 → error", () => {
  const c = { ...valid_card, must_not_do: ["只一个禁止项"] };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "must_not_do");
});

test("behavior_rules 缺少越界回复 → error", () => {
  const c = { ...valid_card, behavior_rules: ["不确定时回复: 待确认"] };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "behavior_rules" && e.message.includes("越界"));
});

test("behavior_rules 缺少不确定回复 → error", () => {
  const c = { ...valid_card, behavior_rules: ["越界时回复: 超出职责范围"] };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "behavior_rules" && e.message.includes("不确定"));
});

test("permission_mode 非法 → error", () => {
  const c = { ...valid_card, permission_mode: "ask" as never };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "permission_mode");
});

test("lifecycle 非法 → error", () => {
  const c = { ...valid_card, lifecycle: "forever" as never };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "lifecycle");
});

test("tech_env 为空 → error", () => {
  const c = { ...valid_card, tech_env: {} };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "tech_env");
});

test("input_sources 为空 → error", () => {
  const c = { ...valid_card, input_sources: [] };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "input_sources");
});

test("output_targets 为空 → error", () => {
  const c = { ...valid_card, output_targets: [] };
  const r = validate_persona_card(c);
  return !r.valid && r.errors.some((e) => e.field === "output_targets");
});

// ===== T-0006: TaskCard Schema =====

test("有效阶段任务卡 → pass", () => {
  const c: StageTaskCard = {
    stage_id: "S-001",
    from: "主Agent",
    to: "后端组长",
    goal: "完成核心API",
    acceptance_criteria: [{ description: "所有接口通过集成测试" }],
    deadline: "2026-05-20",
    dependencies: { upstream: "数据组长表结构", downstream: "前端组长联调" },
    constraints: ["Go 1.22+", "不碰鉴权层"],
  };
  const r = validate_stage_task_card(c);
  return r.valid === true;
});

test("阶段任务卡 goal 为空 → error", () => {
  const c: StageTaskCard = {
    stage_id: "", from: "主Agent", to: "x", goal: "",
    acceptance_criteria: [], deadline: "", dependencies: {}, constraints: [],
  };
  const r = validate_stage_task_card(c);
  return !r.valid && r.errors.length >= 4;
});

test("有效模块任务卡 → pass", () => {
  const c: ModuleTaskCard = {
    module_id: "M-001",
    from: "后端组长",
    to: "林一舟",
    tasks: [{ id: "1", description: "订单CRUD" }],
    output_format: "OpenAPI 3.0 yaml + Go代码",
    deadline: "2026-05-16",
    must_interface: [{ role: "前端组长", spec: "响应结构" }],
    forbidden: ["不碰支付回调", "不设计库存表变更"],
  };
  const r = validate_module_task_card(c);
  return r.valid === true;
});

test("模块任务卡 tasks 为空 → error", () => {
  const c: ModuleTaskCard = {
    module_id: "M-001", from: "x", to: "y",
    tasks: [], output_format: "", deadline: "",
    must_interface: [], forbidden: [],
  };
  const r = validate_module_task_card(c);
  return !r.valid && r.errors.length >= 3;
});

// ===== PersonaCard Schema 类型完整性检查 =====

test("PersonaCard 包含所有必需字段", () => {
  const required_fields = [
    "name", "role", "summary", "must_do", "must_not_do",
    "tech_env", "input_sources", "output_targets",
    "behavior_rules", "permission_mode", "lifecycle",
  ];
  // 通过构造一个合法卡片并访问所有字段来隐式验证类型
  const card: PersonaCard = valid_card;
  return required_fields.every((f) => f in card);
});

test("LifecycleMode 含三种模式", () => {
  const modes = ["permanent", "project_destroy", "follow_project"];
  const c1: PersonaCard = { ...valid_card, lifecycle: "permanent" };
  const c2: PersonaCard = { ...valid_card, lifecycle: "project_destroy" };
  const c3: PersonaCard = { ...valid_card, lifecycle: "follow_project" };
  return c1.lifecycle === modes[0] && c2.lifecycle === modes[1] && c3.lifecycle === modes[2];
});

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
console.log(fail === 0 ? "QA: PASS" : "QA: FAIL");
process.exit(fail > 0 ? 1 : 0);
