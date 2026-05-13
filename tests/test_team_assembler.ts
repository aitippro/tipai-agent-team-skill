/**
 * QA Test: T-0025 ~ T-0028 团队组装引擎
 */
import {
  build_team_structure, get_group_count, get_team_summary,
  inject_lead_communication, inject_member_communication, inject_communication_matrix,
  LEAD_COMMUNICATION_RULES, MEMBER_COMMUNICATION_RULES,
  inject_bypass_permission, inject_team_bypass_permission, BYPASS_PERMISSION_STATEMENT,
  create_team_lead_generator, lead_generate_member_draft,
  lead_submit_draft, approve_member_draft, modify_and_approve_member_draft,
  reject_member_draft, get_approved_members, is_at_max_capacity, has_pending_review,
  assemble_team,
} from "../src/team-assembler";
import { InterviewSummary } from "../src/interview";
import { PersonaCard } from "../src/schemas";
import { LayerDefinition, generate_member_card, generate_team_lead_card } from "../src/card-generator";

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
  suggested_layers: ["前端层", "后端层", "数据层", "DevOps层"],
  estimated_roles: 13,
  risk_items: ["高风险模块: 支付模块"],
};

// ===== T-0025: 团队结构构建器 =====

test("T-0025: build_team_structure -> 4个组", () => {
  const team = build_team_structure(ecom_summary);
  return team.groups.length === 4
    && team.groups[0].group_name === "前端层"
    && team.groups[1].group_name === "后端层"
    && team.groups[3].group_name === "DevOps层";
});

test("T-0025: 每组有1组长", () => {
  const team = build_team_structure(ecom_summary);
  return team.groups.every((g) => g.lead.role.includes("组长"));
});

test("T-0025: 每组成员数≤3", () => {
  const team = build_team_structure(ecom_summary);
  return team.groups.every((g) => g.members.length <= 3 && g.members.length >= 1);
});

test("T-0025: 每组max_members=3", () => {
  const team = build_team_structure(ecom_summary);
  return team.groups.every((g) => g.max_members === 3);
});

test("T-0025: all_cards包含所有组长+成员", () => {
  const team = build_team_structure(ecom_summary);
  const expected_min = team.groups.length + team.groups.reduce((s, g) => s + g.members.length, 0);
  return team.all_cards.length === expected_min;
});

test("T-0025: lead_agent_name默认为主Agent", () => {
  const team = build_team_structure(ecom_summary);
  return team.lead_agent_name === "主Agent";
});

test("T-0025: lead_agent_name可自定义", () => {
  const team = build_team_structure(ecom_summary, "项目总管");
  return team.lead_agent_name === "项目总管";
});

test("T-0025: created_at为ISO时间戳", () => {
  const team = build_team_structure(ecom_summary);
  return team.created_at.includes("T") && !isNaN(Date.parse(team.created_at));
});

test("T-0025: get_group_count -> 4", () => {
  const team = build_team_structure(ecom_summary);
  return get_group_count(team) === 4;
});

test("T-0025: get_team_summary -> 统计正确", () => {
  const team = build_team_structure(ecom_summary);
  const summary = get_team_summary(team);
  return summary.group_count === 4
    && summary.lead_count === 4
    && summary.member_count >= 4
    && summary.total_agents === 1 + summary.lead_count + summary.member_count;
});

test("T-0025: 组长卡输入来源=主Agent", () => {
  const team = build_team_structure(ecom_summary);
  return team.groups.every((g) => g.lead.input_sources[0].from === "主Agent");
});

test("T-0025: 成员卡输入来源=对应组长", () => {
  const team = build_team_structure(ecom_summary);
  return team.groups.every((g) =>
    g.members.every((m) => m.input_sources[0].from.includes("组长"))
  );
});

// ===== T-0026: 通信矩阵注入 =====

const layer: LayerDefinition = { name: "后端层", modules: ["订单模块"], tech_stack: "Go" };
const test_lead = generate_team_lead_card(layer);
const test_member = generate_member_card("订单模块", layer, []);

test("T-0026: LEAD_COMMUNICATION_RULES -> 3条规则", () => {
  return LEAD_COMMUNICATION_RULES.length === 3
    && LEAD_COMMUNICATION_RULES[0].target_role === "lead";
});

test("T-0026: MEMBER_COMMUNICATION_RULES -> 3条规则", () => {
  return MEMBER_COMMUNICATION_RULES.length === 3
    && MEMBER_COMMUNICATION_RULES[0].target_role === "member";
});

test("T-0026: inject_lead_communication -> 新增通信规则", () => {
  const before_count = test_lead.behavior_rules.length;
  const card = inject_lead_communication({ ...test_lead });
  return card.behavior_rules.length > before_count
    && card.behavior_rules.some((r) => r.includes("直接通信"));
});

test("T-0026: inject_lead_communication -> 不重复注入", () => {
  let card = inject_lead_communication({ ...test_lead });
  const after_first = card.behavior_rules.length;
  card = inject_lead_communication(card);
  return card.behavior_rules.length === after_first;
});

test("T-0026: inject_member_communication -> 含隔离规则", () => {
  const card = inject_member_communication({ ...test_member });
  return card.behavior_rules.some((r) => r.includes("跨组"))
    && card.behavior_rules.some((r) => r.includes("不得直接联系主Agent"));
});

test("T-0026: inject_member_communication -> 不重复注入", () => {
  let card = inject_member_communication({ ...test_member });
  const after_first = card.behavior_rules.length;
  card = inject_member_communication(card);
  return card.behavior_rules.length === after_first;
});

test("T-0026: inject_communication_matrix -> 全团队注入", () => {
  const team = build_team_structure(ecom_summary);
  const injected = inject_communication_matrix(team);
  // 所有组长都有通信规则
  const leads_ok = injected.groups.every((g) =>
    g.lead.behavior_rules.some((r) => r.includes("直接通信"))
  );
  // 所有成员都有隔离规则
  const members_ok = injected.groups.every((g) =>
    g.members.every((m) => m.behavior_rules.some((r) => r.includes("跨组")))
  );
  return leads_ok && members_ok;
});

test("T-0026: 通信矩阵 -> 不破坏原有角色信息", () => {
  const team = build_team_structure(ecom_summary);
  const injected = inject_communication_matrix(team);
  return injected.groups.every((g) =>
    g.lead.role.includes("组长") && g.lead.name.length >= 2
  ) && injected.groups.every((g) =>
    g.members.every((m) => m.role.includes("工程师"))
  );
});

// ===== T-0027: 无审批模式注入 =====

test("T-0027: BYPASS_PERMISSION_STATEMENT -> 含关键声明", () => {
  return BYPASS_PERMISSION_STATEMENT.includes("无审批模式")
    && BYPASS_PERMISSION_STATEMENT.includes("直接执行")
    && BYPASS_PERMISSION_STATEMENT.includes("生产环境");
});

test("T-0027: inject_bypass_permission -> 注入声明", () => {
  // 使用不含该声明的卡
  const clean_card: PersonaCard = {
    ...test_member,
    behavior_rules: test_member.behavior_rules.filter((r) => !r.includes("无审批")),
    permission_mode: "bypassPermissions",
  };
  const card = inject_bypass_permission(clean_card);
  return card.behavior_rules.some((r) => r.includes("无审批模式"))
    && card.permission_mode === "bypassPermissions";
});

test("T-0027: inject_bypass_permission -> 已有声明不重复", () => {
  const card = inject_bypass_permission({ ...test_member });
  const after_first = card.behavior_rules.length;
  const card2 = inject_bypass_permission(card);
  return card2.behavior_rules.length === after_first;
});

test("T-0027: inject_bypass_permission -> 强制设置permission_mode", () => {
  const card = inject_bypass_permission({ ...test_member, permission_mode: "default" as any });
  return card.permission_mode === "bypassPermissions";
});

test("T-0027: inject_team_bypass_permission -> 全团队注入", () => {
  const team = build_team_structure(ecom_summary);
  const injected = inject_team_bypass_permission(team);
  const all_have_mode = injected.all_cards.every((c) => c.permission_mode === "bypassPermissions");
  const all_have_rule = injected.all_cards.every((c) =>
    c.behavior_rules.some((r) => r.includes("无审批"))
  );
  return all_have_mode && all_have_rule;
});

// ===== T-0028: 组长生成成员卡权限 =====

test("T-0028: create_team_lead_generator -> 初始状态", () => {
  const gen = create_team_lead_generator("林一舟", "后端组", layer);
  return gen.lead_name === "林一舟"
    && gen.group_name === "后端组"
    && gen.current_members === 0
    && gen.max_members === 3
    && gen.drafts.length === 0;
});

test("T-0028: lead_generate_member_draft -> 生成草稿", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer);
  gen = lead_generate_member_draft(gen, "支付模块")!;
  return gen!.drafts.length === 1
    && gen!.drafts[0].status === "draft"
    && gen!.drafts[0].card.role.includes("支付模块");
});

test("T-0028: lead_generate_member_draft -> 已达上限返回null", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer, 3, 3);
  const result = lead_generate_member_draft(gen, "新模块");
  return result === null;
});

test("T-0028: lead_generate_member_draft -> 含已批准+草稿达上限", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer, 2, 3); // 已有2人
  gen = lead_generate_member_draft(gen, "新模块")!;
  // 2 current + 1 draft = 3, 已达上限
  const result = lead_generate_member_draft(gen!, "又一模块");
  return result === null;
});

test("T-0028: lead_submit_draft -> draft变submitted", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer);
  gen = lead_generate_member_draft(gen, "支付模块")!;
  gen = lead_submit_draft(gen!, 0);
  return gen!.drafts[0].status === "submitted"
    && gen!.drafts[0].submitted_at!.includes("T");
});

test("T-0028: approve_member_draft -> submitted变approved", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer);
  gen = lead_generate_member_draft(gen, "支付模块")!;
  gen = lead_submit_draft(gen!, 0);
  gen = approve_member_draft(gen!, 0, "主Agent", "审核通过");
  return gen!.drafts[0].status === "approved"
    && gen!.drafts[0].reviewed_by === "主Agent"
    && gen!.drafts[0].review_comment === "审核通过"
    && gen!.current_members === 1;
});

test("T-0028: approve_member_draft -> 未submitted不能批准", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer);
  gen = lead_generate_member_draft(gen, "支付模块")!;
  // 未submit直接approve
  gen = approve_member_draft(gen!, 0, "主Agent");
  return gen!.drafts[0].status === "draft"
    && gen!.current_members === 0;
});

test("T-0028: modify_and_approve_member_draft -> 修正后批准", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer);
  gen = lead_generate_member_draft(gen, "支付模块")!;
  gen = lead_submit_draft(gen!, 0);
  gen = modify_and_approve_member_draft(gen!, 0, { role: "高级支付工程师" }, "主Agent", "角色修正");
  return gen!.drafts[0].status === "approved"
    && gen!.drafts[0].card.role === "高级支付工程师"
    && gen!.current_members === 1;
});

test("T-0028: reject_member_draft -> submitted变rejected", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer);
  gen = lead_generate_member_draft(gen, "支付模块")!;
  gen = lead_submit_draft(gen!, 0);
  gen = reject_member_draft(gen!, 0, "主Agent", "技术栈不匹配");
  return gen!.drafts[0].status === "rejected"
    && gen!.drafts[0].review_comment === "技术栈不匹配"
    && gen!.current_members === 0; // rejected不增加人数
});

test("T-0028: rejected后可重新生成草稿", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer);
  gen = lead_generate_member_draft(gen, "支付模块")!;
  gen = lead_submit_draft(gen!, 0);
  gen = reject_member_draft(gen!, 0, "主Agent", "技术栈不匹配");
  gen = lead_generate_member_draft(gen!, "用户模块")!;
  return gen!.drafts.length === 2
    && gen!.drafts[0].status === "rejected"
    && gen!.drafts[1].status === "draft";
});

test("T-0028: get_approved_members -> 仅返回已批准", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer);
  gen = lead_generate_member_draft(gen, "支付模块")!;
  gen = lead_submit_draft(gen!, 0);
  gen = approve_member_draft(gen!, 0, "主Agent");
  gen = lead_generate_member_draft(gen!, "用户模块")!; // draft
  const approved = get_approved_members(gen!);
  return approved.length === 1 && approved[0].role.includes("支付模块");
});

test("T-0028: is_at_max_capacity -> current=3时true", () => {
  const gen = create_team_lead_generator("林一舟", "后端组", layer, 3, 3);
  return is_at_max_capacity(gen) === true;
});

test("T-0028: is_at_max_capacity -> current<3时false", () => {
  const gen = create_team_lead_generator("林一舟", "后端组", layer, 0, 3);
  return is_at_max_capacity(gen) === false;
});

test("T-0028: has_pending_review -> 有submitted时为true", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer);
  gen = lead_generate_member_draft(gen, "支付模块")!;
  gen = lead_submit_draft(gen!, 0);
  return has_pending_review(gen!) === true;
});

test("T-0028: has_pending_review -> 无submitted时为false", () => {
  const gen = create_team_lead_generator("林一舟", "后端组", layer);
  return has_pending_review(gen) === false;
});

test("T-0028: draft和rejected不计入current_members", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer);
  gen = lead_generate_member_draft(gen, "支付模块")!;
  gen = lead_submit_draft(gen!, 0);
  gen = reject_member_draft(gen!, 0, "主Agent", "不行");
  return gen!.current_members === 0
    && gen!.drafts[0].status === "rejected";
});

// ===== 集成测试 =====

test("T-0025~0028 集成: assemble_team -> 返回已注入通信+权限的团队", () => {
  const team = assemble_team(ecom_summary);
  // 所有组长有通信规则
  const leads_communication = team.groups.every((g) =>
    g.lead.behavior_rules.some((r) => r.includes("直接通信"))
  );
  // 所有成员有隔离规则
  const members_isolated = team.groups.every((g) =>
    g.members.every((m) => m.behavior_rules.some((r) => r.includes("跨组")))
  );
  // 所有卡有无审批声明
  const all_bypass = team.all_cards.every((c) =>
    c.behavior_rules.some((r) => r.includes("无审批"))
  );
  return leads_communication && members_isolated && all_bypass;
});

test("T-0025~0028 集成: assemble_team -> 结构完整", () => {
  const team = assemble_team(ecom_summary);
  return team.groups.length === 4
    && team.lead_agent_name === "主Agent"
    && team.groups.every((g) => g.max_members === 3)
    && team.all_cards.length >= team.groups.length * 2;
});

test("T-0025~0028 集成: 组长生成→审核完整流程", () => {
  let gen = create_team_lead_generator("林一舟", "后端组", layer);
  // 生成2个成员草稿
  gen = lead_generate_member_draft(gen, "订单模块")!;
  gen = lead_generate_member_draft(gen!, "支付模块")!;
  // 提交审核
  gen = lead_submit_draft(gen!, 0);
  gen = lead_submit_draft(gen!, 1);
  // 主Agent批准一个
  gen = approve_member_draft(gen!, 0, "主Agent", "通过");
  // 主Agent修正另一个
  gen = modify_and_approve_member_draft(gen!, 1, { summary: "重构后的支付模块实现" }, "主Agent", "summary调整");
  // 验证结果
  const approved = get_approved_members(gen!);
  return approved.length === 2
    && gen!.current_members === 2
    && gen!.drafts[0].status === "approved"
    && gen!.drafts[1].card.summary === "重构后的支付模块实现"
    && gen!.drafts[1].reviewed_by === "主Agent";
});

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
console.log(fail === 0 ? "QA: PASS" : "QA: FAIL");
process.exit(fail > 0 ? 1 : 0);
