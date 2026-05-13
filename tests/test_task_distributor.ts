/**
 * QA Test: T-0029 ~ T-0032 任务下发系统
 */
import {
  generate_stage_task_cards, get_group_stage_cards, get_active_stage,
  StageDefinition,
  generate_module_task_card,
  create_dispatch_state, can_dispatch_to, dispatch_task, complete_task,
  check_timeout_risk, batch_check_timeout,
  insert_emergency, consume_emergency_queue,
  validate_dispatch_chain,
  create_member_progress_report, create_stage_progress_summary,
  is_report_overdue, aggregate_progress,
  MemberProgressReport, StageProgressSummary,
} from "../src/task-distributor";
import { InterviewSummary } from "../src/interview";
import { StageTaskCard, ModuleTaskCard } from "../src/schemas";
import { build_team_structure } from "../src/team-assembler";

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

const ecom_summary: InterviewSummary = {
  project_description: "新项目: 做一个电商系统。目标用户: 普通消费者。",
  tech_stack: "Go + PostgreSQL + React",
  deployment: "云服务部署",
  suggested_layers: ["前端层", "后端层", "数据层"],
  estimated_roles: 10,
  risk_items: ["高风险模块: 支付模块"],
};

const team = build_team_structure(ecom_summary);

// ===== T-0029: 阶段任务卡生成器 =====

test("T-0029: generate_stage_task_cards -> 3组x5阶段=15张卡", () => {
  const cards = generate_stage_task_cards(ecom_summary, team.groups);
  return cards.length === 15; // 3 groups x 5 stages
});

test("T-0029: 每卡from=主Agent", () => {
  const cards = generate_stage_task_cards(ecom_summary, team.groups);
  return cards.every((c) => c.from === "主Agent");
});

test("T-0029: 每卡to=对应组长名", () => {
  const cards = generate_stage_task_cards(ecom_summary, team.groups);
  const lead_names = new Set(team.groups.map((g) => g.lead.name));
  return cards.every((c) => lead_names.has(c.to));
});

test("T-0029: stage_id包含组名", () => {
  const cards = generate_stage_task_cards(ecom_summary, team.groups);
  return cards.some((c) => c.stage_id.includes("前端层"))
    && cards.some((c) => c.stage_id.includes("后端层"))
    && cards.some((c) => c.stage_id.includes("数据层"));
});

test("T-0029: 每卡有验收标准≥2", () => {
  const cards = generate_stage_task_cards(ecom_summary, team.groups);
  return cards.every((c) => c.acceptance_criteria.length >= 2);
});

test("T-0029: 每卡有deadline(ISO date)", () => {
  const cards = generate_stage_task_cards(ecom_summary, team.groups);
  return cards.every((c) => c.deadline.includes("-") && c.deadline.length === 10);
});

test("T-0029: 每卡有约束条件", () => {
  const cards = generate_stage_task_cards(ecom_summary, team.groups);
  return cards.every((c) => c.constraints.length >= 2);
});

test("T-0029: 自定义阶段定义", () => {
  const custom: StageDefinition[] = [{
    stage_id: "CUSTOM-1",
    goal: "自定义阶段",
    acceptance_criteria: [{ description: "完成" }],
    assigned_groups: ["后端层"],
    deadline_offset_days: 7,
  }];
  const cards = generate_stage_task_cards(ecom_summary, team.groups, custom);
  return cards.length === 1
    && cards[0].stage_id === "CUSTOM-1-后端层"
    && cards[0].goal.includes("后端层");
});

test("T-0029: get_group_stage_cards -> 每个组长5张卡", () => {
  const cards = generate_stage_task_cards(ecom_summary, team.groups);
  const lead_name = team.groups[0].lead.name;
  const group_cards = get_group_stage_cards(cards, lead_name);
  return group_cards.length === 5;
});

test("T-0029: get_active_stage -> 返回第一个未完成", () => {
  const cards = generate_stage_task_cards(ecom_summary, team.groups);
  const lead_name = team.groups[0].lead.name;
  const group_cards = get_group_stage_cards(cards, lead_name);
  const completed = new Set([group_cards[0].stage_id]);
  const active = get_active_stage(group_cards, completed);
  return active !== null && active.stage_id === group_cards[1].stage_id;
});

// ===== T-0030: 模块任务卡生成器 =====

const stage_card: StageTaskCard = {
  stage_id: "S-002-后端层",
  from: "主Agent",
  to: "后端组长",
  goal: "核心业务模块开发 (后端层)",
  acceptance_criteria: [{ description: "API通过冒烟测试" }],
  deadline: "2026-05-27",
  dependencies: {},
  constraints: ["技术栈: Go + PostgreSQL"],
};

test("T-0030: generate_module_task_card -> module_id关联stage", () => {
  const card = generate_module_task_card(stage_card, "订单模块", "林一舟", "后端组长");
  return card.module_id.includes("S-002")
    && card.module_id.includes("订单模块");
});

test("T-0030: from=组长, to=成员", () => {
  const card = generate_module_task_card(stage_card, "支付模块", "张思远", "后端组长");
  return card.from === "后端组长" && card.to === "张思远";
});

test("T-0030: tasks≥3个具体任务", () => {
  const card = generate_module_task_card(stage_card, "订单模块", "林一舟", "后端组长");
  return card.tasks.length >= 3
    && card.tasks.every((t) => t.id && t.description.length > 0);
});

test("T-0030: 继承阶段deadline", () => {
  const card = generate_module_task_card(stage_card, "用户模块", "林一舟", "后端组长");
  return card.deadline === "2026-05-27";
});

test("T-0030: output_format根据模块名推导", () => {
  const backend = generate_module_task_card(stage_card, "订单模块", "林一舟", "后端组长");
  return backend.output_format.includes(".go") || backend.output_format.includes("源码");
});

test("T-0030: forbidden含默认隔离规则", () => {
  const card = generate_module_task_card(stage_card, "订单模块", "林一舟", "后端组长");
  return card.forbidden.some((f) => f.includes("跨模块"))
    && card.forbidden.some((f) => f.includes("其他组"));
});

test("T-0030: 附加forbidden合并", () => {
  const card = generate_module_task_card(
    stage_card, "支付模块", "林一舟", "后端组长",
    ["不得使用第三方支付SDK", "必须记录审计日志"]
  );
  return card.forbidden.includes("不得使用第三方支付SDK")
    && card.forbidden.includes("必须记录审计日志");
});

test("T-0030: must_interface可用于声明对接", () => {
  const interfaces = [{ role: "订单模块工程师", spec: "订单状态变更时通知支付模块" }];
  const card = generate_module_task_card(
    stage_card, "支付模块", "林一舟", "后端组长",
    [], interfaces
  );
  return card.must_interface.length === 1
    && card.must_interface[0].role.includes("订单");
});

test("T-0030: 已知模块生成对应任务", () => {
  const table_card = generate_module_task_card(stage_card, "表结构设计", "林一舟", "后端组长");
  return table_card.tasks.some((t) => t.description.includes("ER图"));
});

test("T-0030: 未知模块生成通用任务", () => {
  const card = generate_module_task_card(stage_card, "特殊模块X", "林一舟", "后端组长");
  return card.tasks.length >= 2
    && card.tasks.some((t) => t.description.includes("特殊模块X"));
});

// ===== T-0031: 任务下发协议 =====

test("T-0031: create_dispatch_state -> 空状态", () => {
  const state = create_dispatch_state();
  return Object.keys(state.member_tasks).length === 0
    && state.emergency_queue.length === 0
    && state.completed_modules.size === 0;
});

test("T-0031: can_dispatch_to -> 空闲成员可下发", () => {
  const state = create_dispatch_state();
  return can_dispatch_to("林一舟", state) === true;
});

test("T-0031: can_dispatch_to -> 已持有任务不可下发", () => {
  let state = create_dispatch_state();
  const card: ModuleTaskCard = {
    module_id: "S-002-订单模块",
    from: "后端组长", to: "林一舟",
    tasks: [{ id: "T1", description: "test" }],
    output_format: "go", deadline: "2026-05-27",
    must_interface: [], forbidden: [],
  };
  state = dispatch_task(card, state)!;
  return state !== null && can_dispatch_to("林一舟", state) === false;
});

test("T-0031: dispatch_task -> 占位成功", () => {
  let state = create_dispatch_state();
  const card: ModuleTaskCard = {
    module_id: "S-002-支付模块",
    from: "后端组长", to: "张思远",
    tasks: [{ id: "T1", description: "test" }],
    output_format: "go", deadline: "2026-05-27",
    must_interface: [], forbidden: [],
  };
  state = dispatch_task(card, state)!;
  return state !== null
    && state.member_tasks["张思远"] === "S-002-支付模块"
    && state.deadlines["S-002-支付模块"] === "2026-05-27";
});

test("T-0031: dispatch_task -> 已持有返回null", () => {
  let state = create_dispatch_state();
  const card1: ModuleTaskCard = {
    module_id: "M1", from: "组长", to: "林一舟",
    tasks: [{ id: "T1", description: "t" }],
    output_format: "go", deadline: "2026-05-27",
    must_interface: [], forbidden: [],
  };
  const card2: ModuleTaskCard = { ...card1, module_id: "M2" };
  state = dispatch_task(card1, state)!;
  const result = dispatch_task(card2, state!);
  return result === null;
});

test("T-0031: complete_task -> 释放成员", () => {
  let state = create_dispatch_state();
  const card: ModuleTaskCard = {
    module_id: "M1", from: "组长", to: "林一舟",
    tasks: [{ id: "T1", description: "t" }],
    output_format: "go", deadline: "2026-05-27",
    must_interface: [], forbidden: [],
  };
  state = dispatch_task(card, state)!;
  state = complete_task("M1", "林一舟", state!);
  return can_dispatch_to("林一舟", state) === true
    && state.completed_modules.has("M1");
});

test("T-0031: check_timeout_risk -> 远期=on_track", () => {
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const status = check_timeout_risk("M1", future.toISOString(), new Date().toISOString());
  return status === "on_track";
});

test("T-0031: check_timeout_risk -> 距deadline剩10%=at_risk", () => {
  // assigned 10 days ago, deadline in 3 days → 3/13 ≈ 23% remaining → at_risk
  const assigned = new Date();
  assigned.setDate(assigned.getDate() - 10);
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 3);
  const status = check_timeout_risk("M1", deadline.toISOString(), assigned.toISOString());
  return status === "at_risk";
});

test("T-0031: check_timeout_risk -> 已过期=overdue", () => {
  const status = check_timeout_risk("M1", "2020-01-01", "2019-12-01");
  return status === "overdue";
});

test("T-0031: batch_check_timeout -> 批量返回状态", () => {
  let state = create_dispatch_state();
  const card: ModuleTaskCard = {
    module_id: "M1", from: "组长", to: "林一舟",
    tasks: [{ id: "T1", description: "t" }],
    output_format: "go", deadline: "2026-12-31",
    must_interface: [], forbidden: [],
  };
  state = dispatch_task(card, state)!;
  const results = batch_check_timeout(state!, { "M1": "2026-01-01" });
  return results.length === 1 && results[0].member === "林一舟";
});

test("T-0031: insert_emergency -> 加入紧急队列", () => {
  let state = create_dispatch_state();
  state = insert_emergency("S-003-后端层", "后端层", "支付接口安全漏洞", state);
  return state.emergency_queue.length === 1
    && state.emergency_queue[0].reason.includes("安全");
});

test("T-0031: consume_emergency_queue -> 按组取走", () => {
  let state = create_dispatch_state();
  state = insert_emergency("S-003-后端层", "后端层", "bug1", state);
  state = insert_emergency("S-003-前端层", "前端层", "bug2", state);
  const { queue, state: new_state } = consume_emergency_queue(state, "后端层");
  return queue.length === 1
    && queue[0].reason === "bug1"
    && new_state.emergency_queue.length === 1
    && new_state.emergency_queue[0].reason === "bug2";
});

test("T-0031: validate_dispatch_chain -> 合法链路", () => {
  const s_card: StageTaskCard = {
    stage_id: "S-002-后端层",
    from: "主Agent", to: "后端组长",
    goal: "test", acceptance_criteria: [],
    deadline: "2026-05-27", dependencies: {}, constraints: [],
  };
  const m_card: ModuleTaskCard = {
    module_id: "S-002-后端层-订单模块",
    from: "后端组长", to: "林一舟",
    tasks: [], output_format: "go", deadline: "2026-05-27",
    must_interface: [], forbidden: [],
  };
  const result = validate_dispatch_chain(s_card, m_card, "后端组长");
  return result.valid === true && result.errors.length === 0;
});

test("T-0031: validate_dispatch_chain -> 越级检测", () => {
  const s_card: StageTaskCard = {
    stage_id: "S-002-后端层",
    from: "后端组长" as any, // 不应由组长发阶段卡
    to: "林一舟" as any,
    goal: "test", acceptance_criteria: [],
    deadline: "2026-05-27", dependencies: {}, constraints: [],
  };
  const m_card: ModuleTaskCard = {
    module_id: "S-002-后端层-订单模块",
    from: "主Agent" as any, // 不应由主Agent发模块卡
    to: "林一舟",
    tasks: [], output_format: "go", deadline: "2026-05-27",
    must_interface: [], forbidden: [],
  };
  const result = validate_dispatch_chain(s_card, m_card, "后端组长");
  return result.valid === false && result.errors.length >= 2;
});

test("T-0031: validate_dispatch_chain -> 不匹配stage_id", () => {
  const s_card: StageTaskCard = {
    stage_id: "S-001-后端层",
    from: "主Agent", to: "后端组长",
    goal: "test", acceptance_criteria: [],
    deadline: "2026-05-27", dependencies: {}, constraints: [],
  };
  const m_card: ModuleTaskCard = {
    module_id: "S-999-后端层-订单模块", // 不匹配
    from: "后端组长", to: "林一舟",
    tasks: [], output_format: "go", deadline: "2026-05-27",
    must_interface: [], forbidden: [],
  };
  const result = validate_dispatch_chain(s_card, m_card, "后端组长");
  return result.valid === false;
});

// ===== T-0032: 进度汇报链 =====

test("T-0032: create_member_progress_report -> 含关键字段", () => {
  const report = create_member_progress_report(
    "林一舟", ["订单CRUD完成", "状态机测试通过"], ["并发锁问题未解决"], true
  );
  return report.member_name === "林一舟"
    && report.done.length === 2
    && report.problems.length === 1
    && report.on_track === true
    && report.date.includes("-");
});

test("T-0032: create_member_progress_report -> date为今天", () => {
  const report = create_member_progress_report("林一舟", [], [], true);
  const today = new Date().toISOString().split("T")[0];
  return report.date === today;
});

test("T-0032: create_stage_progress_summary -> 正常汇总", () => {
  const reports: MemberProgressReport[] = [
    { member_name: "林一舟", date: "2026-05-13", done: ["订单CRUD"], problems: [], on_track: true },
    { member_name: "张思远", date: "2026-05-13", done: ["支付对接"], problems: [], on_track: true },
    { member_name: "王若涵", date: "2026-05-13", done: ["库存设计"], problems: [], on_track: true },
  ];
  const summary = create_stage_progress_summary(reports, "S-002", "后端组", 12, 8);
  return summary.stage_id === "S-002"
    && summary.group_name === "后端组"
    && summary.total_tasks === 12
    && summary.completed_tasks === 8
    && summary.completion_rate === 0.67 // 8/12
    && summary.abnormal_members.length === 0;
});

test("T-0032: create_stage_progress_summary -> 检测偏离轨道", () => {
  const reports: MemberProgressReport[] = [
    { member_name: "林一舟", date: "2026-05-13", done: [], problems: ["阻塞"], on_track: false },
    { member_name: "张思远", date: "2026-05-13", done: [], problems: [], on_track: true },
  ];
  const summary = create_stage_progress_summary(reports, "S-002", "后端组", 10, 3);
  return summary.abnormal_members.length >= 1
    && summary.abnormal_members.some((m) => m.name === "林一舟")
    && summary.blockers.some((b) => b.includes("阻塞"));
});

test("T-0032: create_stage_progress_summary -> 空汇报检测", () => {
  const reports: MemberProgressReport[] = [
    { member_name: "张思远", date: "2026-05-13", done: [], problems: [], on_track: true },
  ];
  const summary = create_stage_progress_summary(reports, "S-002", "后端组", 10, 5);
  return summary.abnormal_members.some((m) => m.name === "张思远" && m.issue.includes("未提交有效汇报"));
});

test("T-0032: create_stage_progress_summary -> 无问题时显示无阻塞", () => {
  const reports: MemberProgressReport[] = [
    { member_name: "林一舟", date: "2026-05-13", done: ["task1"], problems: [], on_track: true },
  ];
  const summary = create_stage_progress_summary(reports, "S-002", "后端组", 5, 5);
  return summary.blockers[0] === "无阻塞";
});

test("T-0032: is_report_overdue -> 超过24h=true", () => {
  const old_date = new Date("2026-05-10");
  return is_report_overdue(old_date.toISOString()) === true;
});

test("T-0032: is_report_overdue -> 刚刚=false", () => {
  const recent = new Date();
  recent.setHours(recent.getHours() - 1);
  return is_report_overdue(recent.toISOString()) === false;
});

test("T-0032: aggregate_progress -> 汇总各组进度", () => {
  const summaries: StageProgressSummary[] = [
    {
      stage_id: "S-002", group_name: "前端组",
      completion_rate: 0.8, total_tasks: 10, completed_tasks: 8,
      blockers: ["组件库更新延迟"], abnormal_members: [],
      generated_at: new Date().toISOString(),
    },
    {
      stage_id: "S-002", group_name: "后端组",
      completion_rate: 0.5, total_tasks: 12, completed_tasks: 6,
      blockers: ["无阻塞"],
      abnormal_members: [{ name: "林一舟", issue: "进度偏离" }],
      generated_at: new Date().toISOString(),
    },
    {
      stage_id: "S-002", group_name: "数据层",
      completion_rate: 0.65, total_tasks: 8, completed_tasks: 5,
      blockers: ["无阻塞"], abnormal_members: [],
      generated_at: new Date().toISOString(),
    },
  ];
  const agg = aggregate_progress(summaries);
  return agg.total_blockers.length === 1
    && agg.total_blockers[0].includes("组件库")
    && agg.critical_groups.length === 1
    && agg.critical_groups[0] === "后端组";
});

test("T-0032: 进度汇报完整链路 -> 成员→组长→主Agent", () => {
  // 三个成员汇报
  const reports = [
    create_member_progress_report("林一舟", ["订单CRUD完成", "状态机测试"], ["并发锁未解决"], true),
    create_member_progress_report("张思远", ["支付对接完成"], [], true),
    create_member_progress_report("王若涵", ["库存扣减API完成"], [], true),
  ];
  // 组长汇总
  const summary = create_stage_progress_summary(reports, "S-002", "后端组", 12, 8);
  // 主Agent视图
  const agg = aggregate_progress([summary]);
  return summary.blockers.length >= 1
    && summary.completion_rate === 0.67
    && agg.total_blockers.length >= 1
    && agg.overall_completion > 0;
});

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
console.log(fail === 0 ? "QA: PASS" : "QA: FAIL");
process.exit(fail > 0 ? 1 : 0);
