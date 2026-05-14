/**
 * QA Test: T-0046 ~ T-0050 上下文控制系统
 */
import {
  crop_member_context, validate_member_context,
  MemberContextInput, MemberContext,
  crop_team_lead_context, validate_team_lead_context,
  TeamLeadContextInput, TeamLeadContext,
  inject_lead_agent_context, validate_lead_agent_context,
  LeadAgentContextInput, LeadAgentContext,
  detect_task_dispatch_leak,
  detect_member_cross_boundary_leak,
  detect_lead_evaluation_leak,
  detect_agent_report_leak,
  run_leak_detection,
  create_context_snapshot, restore_from_snapshot,
  batch_create_snapshots, prune_expired_snapshots,
  get_snapshot_history, has_recoverable_snapshot,
  ContextSnapshot,
} from "../src/context-control";

import { PersonaCard, ProjectArchive, ConflictRecord, SatisfactionRecord } from "../src/schemas";
import { ConventionRule } from "../src/conflict-arbitrator";
import { StageTaskCard, ModuleTaskCard } from "../src/schemas";

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

function make_member_card(name: string, role: string): PersonaCard {
  return {
    name, role, summary: "成员",
    must_do: ["实现"], must_not_do: ["越界"],
    tech_env: { language: "TypeScript" },
    input_sources: [], output_targets: [],
    behavior_rules: ["规则1"],
    permission_mode: "bypassPermissions",
    lifecycle: "project_destroy",
  };
}

function make_lead_card(name: string, role: string): PersonaCard {
  return {
    name, role, summary: "组长",
    must_do: ["审查", "拆解", "验收"],
    must_not_do: ["越界", "跳过审查", "未经许可修改需求"],
    tech_env: { language: "TypeScript" },
    input_sources: [], output_targets: [],
    behavior_rules: ["规则1"],
    permission_mode: "bypassPermissions",
    lifecycle: "project_destroy",
  };
}

// ============ T-0046: 成员上下文裁剪器 ============
console.log("\n=== T-0046: 成员上下文裁剪器 ===");

const test_module_task: ModuleTaskCard = {
  module_id: "S-001-前端层-订单模块",
  from: "前端组长",
  to: "张三",
  tasks: [
    { id: "T1", description: "实现订单列表" },
    { id: "T2", description: "实现订单详情" },
    { id: "T3", description: "实现创建订单" },
  ],
  output_format: "React组件 + TypeScript",
  deadline: "2026-06-01",
  must_interface: [{ role: "后端接口", spec: "/api/orders" }],
  forbidden: ["直接操作DOM"],
};

const simplified_conventions: ConventionRule[] = [
  { id: "C001", category: "响应格式", rule: "统一使用code字段", required_pattern: "code" },
  { id: "C005", category: "日志", rule: "禁止console.log", forbidden_pattern: "console.log" },
];

test("T-0046: crop_member_context 返回裁剪后的上下文", () => {
  const input: MemberContextInput = {
    persona_card: make_member_card("张三", "前端层工程师"),
    module_task_card: test_module_task,
    upstream_interfaces: ["/api/user/info"],
    downstream_interfaces: ["/api/order/create"],
    simplified_conventions,
  };
  const ctx = crop_member_context(input);
  return ctx.persona_card.name === "张三" &&
    ctx.module_task_card.module_id === test_module_task.module_id &&
    ctx.upstream_interfaces.length === 1 &&
    ctx.downstream_interfaces.length === 1 &&
    ctx.simplified_conventions.length === 2;
});

test("T-0046: validate_member_context — 合规上下文通过", () => {
  const ctx: MemberContext = {
    persona_card: make_member_card("张三", "前端层工程师"),
    module_task_card: test_module_task,
    upstream_interfaces: [],
    downstream_interfaces: [],
    simplified_conventions: [],
  };
  const result = validate_member_context(ctx);
  return result.valid && result.leaks.length === 0;
});

test("T-0046: validate_member_context — 检测全局架构泄露", () => {
  const ctx: MemberContext = {
    persona_card: make_member_card("张三", "前端层工程师"),
    module_task_card: test_module_task,
    upstream_interfaces: ["这是所有模块的完整架构设计文档"],
    downstream_interfaces: [],
    simplified_conventions: [],
  };
  const result = validate_member_context(ctx);
  return !result.valid && result.leaks.some(l => l.includes("所有模块"));
});

test("T-0046: validate_member_context — 检测客户需求泄露", () => {
  const ctx: MemberContext = {
    persona_card: make_member_card("张三", "前端层工程师"),
    module_task_card: test_module_task,
    upstream_interfaces: ["客户需求: 需要支持实时推送"],
    downstream_interfaces: [],
    simplified_conventions: [],
  };
  const result = validate_member_context(ctx);
  return !result.valid && result.leaks.some(l => l.includes("客户需求"));
});

test("T-0046: validate_member_context — 成员角色含组长检测", () => {
  const ctx: MemberContext = {
    persona_card: make_member_card("张三", "组长"),
    module_task_card: test_module_task,
    upstream_interfaces: [],
    downstream_interfaces: [],
    simplified_conventions: [],
  };
  const result = validate_member_context(ctx);
  return !result.valid && result.leaks.some(l => l.includes("组长"));
});

test("T-0046: 空接口列表合法", () => {
  const input: MemberContextInput = {
    persona_card: make_member_card("李四", "后端层工程师"),
    module_task_card: test_module_task,
    upstream_interfaces: [],
    downstream_interfaces: [],
    simplified_conventions: [],
  };
  const ctx = crop_member_context(input);
  return ctx.upstream_interfaces.length === 0 && ctx.downstream_interfaces.length === 0;
});

// ============ T-0047: 组长上下文裁剪器 ============
console.log("\n=== T-0047: 组长上下文裁剪器 ===");

const test_stage_card: StageTaskCard = {
  stage_id: "S-001-前端层",
  from: "主Agent",
  to: "前端组长",
  goal: "完成前端所有页面",
  acceptance_criteria: [
    { description: "所有页面渲染正确" },
    { description: "响应时间<200ms" },
  ],
  deadline: "2026-07-01",
  dependencies: {},
  constraints: ["使用React"],
};

const full_conventions: ConventionRule[] = [
  { id: "C001", category: "响应格式", rule: "统一code字段", required_pattern: "code" },
  { id: "C002", category: "错误处理", rule: "禁止process.exit", forbidden_pattern: "process.exit" },
  { id: "C005", category: "日志", rule: "禁止console.log", forbidden_pattern: "console.log" },
  { id: "C006", category: "鉴权", rule: "需auth", required_pattern: "auth" },
];

test("T-0047: crop_team_lead_context 返回裁剪后上下文", () => {
  const input: TeamLeadContextInput = {
    group_member_cards: [make_member_card("张三", "前端工程师"), make_member_card("李四", "前端工程师")],
    lead_card: make_lead_card("王五", "前端组组长"),
    stage_card: test_stage_card,
    other_lead_interfaces: [
      { lead_name: "赵六", group: "后端组", interface_face: "/api/orders (POST/GET)" },
    ],
    full_conventions,
  };
  const ctx = crop_team_lead_context(input);
  return ctx.group_member_cards.length === 2 &&
    ctx.lead_card.name === "王五" &&
    ctx.stage_card.stage_id === "S-001-前端层" &&
    ctx.other_lead_interfaces.length === 1 &&
    ctx.full_conventions.length === 4;
});

test("T-0047: validate_team_lead_context — 合规上下文通过", () => {
  const ctx: TeamLeadContext = {
    group_member_cards: [make_member_card("张三", "前端工程师")],
    lead_card: make_lead_card("王五", "前端组组长"),
    stage_card: test_stage_card,
    other_lead_interfaces: [],
    full_conventions: [],
  };
  const result = validate_team_lead_context(ctx);
  return result.valid && result.leaks.length === 0;
});

test("T-0047: validate_team_lead_context — 检测客户需求全文泄露", () => {
  const ctx: TeamLeadContext = {
    group_member_cards: [make_member_card("张三", "前端工程师")],
    lead_card: make_lead_card("王五", "前端组组长"),
    stage_card: test_stage_card,
    other_lead_interfaces: [],
    full_conventions: [],
  };
  // 注入敏感信息到组长卡
  ctx.lead_card = {
    ...ctx.lead_card,
    behavior_rules: ["客户需求全文: 系统需支持100万并发"],
  };
  const result = validate_team_lead_context(ctx);
  return !result.valid && result.leaks.some(l => l.includes("客户需求全文"));
});

test("T-0047: validate_team_lead_context — 检测偏好画像泄露", () => {
  const ctx: TeamLeadContext = {
    group_member_cards: [make_member_card("张三", "前端工程师")],
    lead_card: make_lead_card("王五", "前端组组长"),
    stage_card: { ...test_stage_card, constraints: ["客户偏好画像: 喜欢简洁UI"] },
    other_lead_interfaces: [],
    full_conventions: [],
  };
  const result = validate_team_lead_context(ctx);
  return !result.valid && result.leaks.some(l => l.includes("客户偏好画像"));
});

test("T-0047: validate_team_lead_context — 检测接口面含组内评价", () => {
  const ctx: TeamLeadContext = {
    group_member_cards: [],
    lead_card: make_lead_card("王五", "前端组组长"),
    stage_card: test_stage_card,
    other_lead_interfaces: [
      { lead_name: "赵六", group: "后端组", interface_face: "成员张三评价差" },
    ],
    full_conventions: [],
  };
  const result = validate_team_lead_context(ctx);
  return !result.valid && result.leaks.some(l => l.includes("赵六"));
});

test("T-0047: 空成员列表合法", () => {
  const input: TeamLeadContextInput = {
    group_member_cards: [],
    lead_card: make_lead_card("王五", "前端组组长"),
    stage_card: test_stage_card,
    other_lead_interfaces: [],
    full_conventions: [],
  };
  const ctx = crop_team_lead_context(input);
  return ctx.group_member_cards.length === 0;
});

// ============ T-0048: 主Agent上下文全量注入 ============
console.log("\n=== T-0048: 主Agent上下文全量注入 ===");

const test_archive: ProjectArchive = {
  project_id: "P-001",
  project_name: "测试项目",
  time_range: "2026-01~2026-06",
  status: "active",
  original_requirements: "todo应用",
  team_structure: {
    lead_agent: "主Agent",
    groups: [{ name: "前端组", lead: "王五", members: ["张三"] }],
  },
  stage_records: [],
  conflict_records: [],
  fault_records: [],
  satisfaction_summary: { group_avg: {}, project_avg: 4.0 },
  reusable_outputs: [],
  inventory_changes: [],
};

const test_conflict: ConflictRecord = {
  conflict_id: "C-001", type: "interface", parties: ["前端组", "后端组"],
  severity: "delayed", detected_by: "前端组组长", detection_time: "",
  resolution_path: "negotiation", result: "字段不一致",
};

const test_satisfaction: SatisfactionRecord = {
  stage_id: "S-001",
  group_name: "前端组",
  lead_score: { quality: 4, standard: 4, collaboration: 4, bonus: 0, composite: 4.0 },
  member_details: [],
  client_modifications: [],
  final_scores: { quality: 4, standard: 4, collaboration: 4, bonus: 0, composite: 4.0 },
};

test("T-0048: inject_lead_agent_context 返回全量上下文", () => {
  const input: LeadAgentContextInput = {
    all_persona_cards: [
      make_lead_card("主Agent", "主Agent"),
      make_lead_card("王五", "前端组组长"),
      make_member_card("张三", "前端工程师"),
    ],
    client_requirements: "完整的客户需求文档内容",
    global_conventions: full_conventions,
    project_archive: test_archive,
    preference_profile: "客户偏好简洁UI",
    role_inventory: "库存: 2张可用卡",
    conflict_records: [test_conflict],
    satisfaction_history: [test_satisfaction],
  };
  const ctx = inject_lead_agent_context(input);
  return ctx.all_persona_cards.length === 3 &&
    ctx.client_requirements.length > 0 &&
    ctx.global_conventions.length === 4 &&
    ctx.project_archive !== undefined &&
    ctx.preference_profile === "客户偏好简洁UI" &&
    ctx.role_inventory === "库存: 2张可用卡" &&
    ctx.conflict_records.length === 1 &&
    ctx.satisfaction_history.length === 1;
});

test("T-0048: role_summary 正确统计", () => {
  const input: LeadAgentContextInput = {
    all_persona_cards: [
      make_lead_card("王五", "前端组组长"),
      make_lead_card("赵六", "后端组组长"),
      make_member_card("张三", "前端工程师"),
      make_member_card("李四", "前端工程师"),
      make_member_card("钱七", "后端工程师"),
    ],
    client_requirements: "需求",
    global_conventions: [],
    conflict_records: [],
    satisfaction_history: [],
  };
  const ctx = inject_lead_agent_context(input);
  return ctx.role_summary.total === 5 &&
    ctx.role_summary.leads === 2 &&
    ctx.role_summary.members === 3 &&
    ctx.role_summary.groups.length === 2;
});

test("T-0048: role_summary 角色不含组的场景", () => {
  const input: LeadAgentContextInput = {
    all_persona_cards: [
      make_member_card("独立人", "独立工程师"),
    ],
    client_requirements: "需求",
    global_conventions: [],
    conflict_records: [],
    satisfaction_history: [],
  };
  const ctx = inject_lead_agent_context(input);
  return ctx.role_summary.total === 1 &&
    ctx.role_summary.leads === 0 &&
    ctx.role_summary.members === 1 &&
    ctx.role_summary.groups.length === 0;
});

test("T-0048: validate_lead_agent_context — 完整通过", () => {
  const ctx: LeadAgentContext = {
    all_persona_cards: [make_member_card("张三", "工程师")],
    client_requirements: "有需求",
    global_conventions: full_conventions,
    conflict_records: [],
    satisfaction_history: [],
    role_summary: { total: 1, leads: 0, members: 1, groups: [] },
  };
  const result = validate_lead_agent_context(ctx);
  return result.valid;
});

test("T-0048: validate_lead_agent_context — 缺需求检测", () => {
  const ctx: LeadAgentContext = {
    all_persona_cards: [make_member_card("张三", "工程师")],
    client_requirements: "",
    global_conventions: [],
    conflict_records: [],
    satisfaction_history: [],
    role_summary: { total: 1, leads: 0, members: 1, groups: [] },
  };
  const result = validate_lead_agent_context(ctx);
  return !result.valid && result.missing.some(m => m.includes("需求"));
});

test("T-0048: validate_lead_agent_context — 缺人物卡检测", () => {
  const ctx: LeadAgentContext = {
    all_persona_cards: [],
    client_requirements: "有需求",
    global_conventions: [],
    conflict_records: [],
    satisfaction_history: [],
    role_summary: { total: 0, leads: 0, members: 0, groups: [] },
  };
  const result = validate_lead_agent_context(ctx);
  return !result.valid && result.missing.some(m => m.includes("人物卡"));
});

test("T-0048: validate_lead_agent_context — 缺约定检测", () => {
  const ctx: LeadAgentContext = {
    all_persona_cards: [make_member_card("张三", "工程师")],
    client_requirements: "有需求",
    global_conventions: [],
    conflict_records: [],
    satisfaction_history: [],
    role_summary: { total: 1, leads: 0, members: 1, groups: [] },
  };
  const result = validate_lead_agent_context(ctx);
  return !result.valid && result.missing.some(m => m.includes("约定"));
});

test("T-0048: 可选字段可省略", () => {
  const input: LeadAgentContextInput = {
    all_persona_cards: [make_member_card("张三", "工程师")],
    client_requirements: "需求",
    global_conventions: [],
    conflict_records: [],
    satisfaction_history: [],
  };
  const ctx = inject_lead_agent_context(input);
  return ctx.project_archive === undefined &&
    ctx.preference_profile === undefined &&
    ctx.role_inventory === undefined;
});

// ============ T-0049: 上下文泄漏防护 ============
console.log("\n=== T-0049: 上下文泄漏防护 ===");

test("T-0049: detect_task_dispatch_leak — 含客户需求", () => {
  const msg = "这是你的任务，按照客户需求文档第3节来实现";
  const leak = detect_task_dispatch_leak(msg, "前端组长");
  return leak !== null && leak.leak_type === "任务下发泄露" &&
    leak.details.some(d => d.includes("需求"));
});

test("T-0049: detect_task_dispatch_leak — 含偏好信息", () => {
  const msg = "客户喜欢蓝色主题风格，请使用蓝色调";
  const leak = detect_task_dispatch_leak(msg, "前端组长");
  return leak !== null && leak.details.some(d => d.includes("偏好"));
});

test("T-0049: detect_task_dispatch_leak — 含评价信息 → blocking", () => {
  const msg = "你的前一个任务评分太低了，这次注意";
  const leak = detect_task_dispatch_leak(msg, "前端组长");
  return leak !== null && leak.severity === "blocking";
});

test("T-0049: detect_task_dispatch_leak — 正常派活无泄露", () => {
  const msg = "请完成订单列表页面的开发，接口对接后端 /api/orders";
  const leak = detect_task_dispatch_leak(msg, "前端组长");
  return leak === null;
});

test("T-0049: detect_member_cross_boundary_leak — 跨组通信", () => {
  const leak = detect_member_cross_boundary_leak(
    "你好，你们那个接口怎么调？",
    "张三", "前端组",
    "李四", "后端组"
  );
  return leak !== null && leak.leak_type === "成员越界通信" &&
    leak.severity === "blocking";
});

test("T-0049: detect_member_cross_boundary_leak — 越级主Agent", () => {
  const leak = detect_member_cross_boundary_leak(
    "主Agent，我觉得组长分配不公平",
    "张三", "前端组",
    "主Agent", undefined, "lead_agent"
  );
  return leak !== null && leak.details.some(d => d.includes("越级"));
});

test("T-0049: detect_member_cross_boundary_leak — 组内通信无泄露", () => {
  const leak = detect_member_cross_boundary_leak(
    "这个功能我做好了，你接一下",
    "张三", "前端组",
    "李四", "前端组"
  );
  return leak === null;
});

test("T-0049: detect_lead_evaluation_leak — 泄露组内评价", () => {
  const msg = "我们组张三最近满意度很低，可能需要替换了";
  const leak = detect_lead_evaluation_leak(msg, "前端组长", "前端组");
  return leak !== null && leak.severity === "blocking";
});

test("T-0049: detect_lead_evaluation_leak — 正常接口沟通无泄露", () => {
  const msg = "我们接口用 POST /api/orders，body 格式是 JSON";
  const leak = detect_lead_evaluation_leak(msg, "前端组长", "前端组");
  return leak === null;
});

test("T-0049: detect_agent_report_leak — 暴露冲突细节", () => {
  const report = "本次项目内部冲突细节如下: 前端组和后端组在接口设计上有具体矛盾";
  const leak = detect_agent_report_leak(report);
  return leak !== null && leak.leak_type === "主Agent汇报泄露内部细节";
});

test("T-0049: detect_agent_report_leak — 暴露个人评价", () => {
  const report = "张三评分低，李四得分差";
  const leak = detect_agent_report_leak(report);
  return leak !== null;
});

test("T-0049: detect_agent_report_leak — 正常汇报无泄露", () => {
  const report = "项目进展顺利，前端已完成80%，后端已完成70%";
  const leak = detect_agent_report_leak(report);
  return leak === null;
});

test("T-0049: run_leak_detection — 组长派活多泄露", () => {
  const leaks = run_leak_detection(
    "按客户需求做，注意上次评分低的问题",
    "前端组长", "team_lead", "前端组"
  );
  return leaks.length >= 1;
});

test("T-0049: run_leak_detection — 成员越界+泄露组内信息", () => {
  const leaks = run_leak_detection(
    "告诉我你们组的代码审查意见",
    "张三", "member", "前端组",
    "李四", "后端组"
  );
  return leaks.length >= 1 && leaks[0].severity === "blocking";
});

test("T-0049: run_leak_detection — 主Agent泄露", () => {
  const leaks = run_leak_detection(
    "内部冲突细节: 前端组和后端组的责任归属问题",
    "主Agent", "lead_agent"
  );
  return leaks.length >= 1;
});

test("T-0049: run_leak_detection — 正常通信无泄露", () => {
  const leaks = run_leak_detection(
    "请完成今日的接口开发任务",
    "前端组长", "team_lead", "前端组"
  );
  return leaks.length === 0;
});

// ============ T-0050: 上下文快照与恢复 ============
console.log("\n=== T-0050: 上下文快照与恢复 ===");

test("T-0050: create_context_snapshot 创建快照", () => {
  const snap = create_context_snapshot("张三", "member", { task: "T1", progress: 50 });
  return snap.role_name === "张三" &&
    snap.role_level === "member" &&
    snap.sequence === 1 &&
    snap.created_at.length > 0 &&
    snap.content.includes("T1");
});

test("T-0050: 同一角色多快照 sequence 递增", () => {
  const s1 = create_context_snapshot("张三", "member", { v: 1 });
  const s2 = create_context_snapshot("张三", "member", { v: 2 }, [s1]);
  const s3 = create_context_snapshot("张三", "member", { v: 3 }, [s1, s2]);
  return s1.sequence === 1 && s2.sequence === 2 && s3.sequence === 3;
});

test("T-0050: 不同角色独立 sequence", () => {
  const s1 = create_context_snapshot("张三", "member", {});
  const s2 = create_context_snapshot("李四", "member", {});
  return s1.sequence === 1 && s2.sequence === 1;
});

test("T-0050: restore_from_snapshot 恢复最近快照", () => {
  const s1 = create_context_snapshot("张三", "member", { task: "old" });
  const s2 = create_context_snapshot("张三", "member", { task: "new" }, [s1]);
  const result = restore_from_snapshot("张三", [s1, s2]);
  return result.snapshot !== null &&
    JSON.parse(result.snapshot!.content).task === "new";
});

test("T-0050: restore_from_snapshot — 无快照返回 null", () => {
  const result = restore_from_snapshot("不存在", []);
  return result.snapshot === null && result.available.length === 0;
});

test("T-0050: restore_from_snapshot — 过期快照不可用", () => {
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const old_snapshot: ContextSnapshot = {
    role_name: "张三", role_level: "member",
    created_at: old, content: "{}", sequence: 1,
  };
  const result = restore_from_snapshot("张三", [old_snapshot]);
  return result.snapshot === null;
});

test("T-0050: restore_from_snapshot — available 含过期列表", () => {
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const old_snapshot: ContextSnapshot = {
    role_name: "张三", role_level: "member",
    created_at: old, content: "{}", sequence: 1,
  };
  const result = restore_from_snapshot("张三", [old_snapshot]);
  return result.available.length === 1;
});

test("T-0050: batch_create_snapshots 批量创建", () => {
  const roles = [
    { name: "张三", level: "member" as const, content: { t: 1 } },
    { name: "李四", level: "member" as const, content: { t: 2 } },
    { name: "王五", level: "team_lead" as const, content: { t: 3 } },
  ];
  const snapshots = batch_create_snapshots(roles);
  return snapshots.length === 3 &&
    snapshots[0].role_name === "张三" &&
    snapshots[1].role_name === "李四" &&
    snapshots[2].role_name === "王五";
});

test("T-0050: batch_create_snapshots 合并已有快照", () => {
  const existing = create_context_snapshot("已存", "member", {});
  const roles = [{ name: "新角色", level: "member" as const, content: {} }];
  const snapshots = batch_create_snapshots(roles, [existing]);
  return snapshots.length === 2;
});

test("T-0050: prune_expired_snapshots 清理过期", () => {
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const snapshots: ContextSnapshot[] = [
    { role_name: "A", role_level: "member", created_at: now, content: "", sequence: 1 },
    { role_name: "B", role_level: "member", created_at: old, content: "", sequence: 2 },
  ];
  const pruned = prune_expired_snapshots(snapshots);
  return pruned.length === 1 && pruned[0].role_name === "A";
});

test("T-0050: prune_expired_snapshots 自定义时限", () => {
  const old1h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const snapshots: ContextSnapshot[] = [
    { role_name: "A", role_level: "member", created_at: old1h, content: "", sequence: 1 },
  ];
  const pruned = prune_expired_snapshots(snapshots, 1);
  return pruned.length === 0;
});

test("T-0050: get_snapshot_history 按序列号降序", () => {
  const s1 = create_context_snapshot("张三", "member", { v: 1 });
  const s2 = create_context_snapshot("张三", "member", { v: 2 }, [s1]);
  const s3 = create_context_snapshot("张三", "member", { v: 3 }, [s1, s2]);
  const history = get_snapshot_history("张三", [s1, s2, s3]);
  return history.length === 3 &&
    history[0].sequence === 3 &&
    history[1].sequence === 2 &&
    history[2].sequence === 1;
});

test("T-0050: has_recoverable_snapshot 有可恢复快照", () => {
  const snap = create_context_snapshot("张三", "member", {});
  return has_recoverable_snapshot("张三", [snap]);
});

test("T-0050: has_recoverable_snapshot 无可恢复快照", () => {
  return !has_recoverable_snapshot("不存在", []);
});

// ============ 汇总 ============
console.log(`\n总计: ${pass + fail} 测试, ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
