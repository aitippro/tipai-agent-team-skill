/**
 * QA Test: T-0019 ~ T-0024 人物卡生成引擎
 */
import {
  generate_random_name, reset_names,
  decompose_to_layers, LayerDefinition,
  generate_team_lead_card,
  generate_member_card,
  render_agent_injection,
  create_card_review, confirm_card, modify_card, all_cards_reviewed,
  generate_team,
} from "../src/card-generator";
import { InterviewSummary } from "../src/interview";
import { PersonaCard } from "../src/schemas";

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

// ===== T-0022: 随机姓名生成 =====

test("T-0022: 生成随机中文姓名 → 非空", () => {
  const name = generate_random_name();
  return name.length >= 2 && name.length <= 4;
});

test("T-0022: 连续生成100个名字 → 无重复", () => {
  reset_names();
  const names = new Set<string>();
  for (let i = 0; i < 100; i++) names.add(generate_random_name());
  return names.size === 100;
});

test("T-0022: reset_names → 清空已用集合", () => {
  reset_names();
  const n1 = generate_random_name();
  reset_names();
  const n2 = generate_random_name();
  // 重置后可能再次生成同一个名字
  return n1.length >= 2 && n2.length >= 2;
});

test("T-0022: 名字枯竭 → 自动重置", () => {
  reset_names();
  // 生成超大量名字应不抛异常
  for (let i = 0; i < 800; i++) {
    const name = generate_random_name();
    if (!name || name.length < 2) return false;
  }
  return true;
});

// ===== T-0019: 需求→层级拆解器 =====

const ecom_summary: InterviewSummary = {
  project_description: "新项目: 做一个电商系统。目标用户: 普通消费者。",
  tech_stack: "Go + PostgreSQL + React",
  deployment: "云服务部署",
  suggested_layers: ["前端层", "后端层", "数据层"],
  estimated_roles: 10,
  risk_items: ["高风险模块: 支付模块"],
};

test("T-0019: 电商项目 → 拆解3层", () => {
  const layers = decompose_to_layers(ecom_summary);
  return layers.length === 3
    && layers[0].name === "前端层"
    && layers[1].name === "后端层"
    && layers[2].name === "数据层";
});

test("T-0019: 电商后端层 → 含支付/订单/库存模块", () => {
  const layers = decompose_to_layers(ecom_summary);
  const backend = layers.find((l) => l.name === "后端层")!;
  return backend.modules.some((m) => m.includes("订单"))
    && backend.modules.some((m) => m.includes("支付"))
    && backend.modules.some((m) => m.includes("库存"));
});

test("T-0019: 前端层 → 标准4模块", () => {
  const layers = decompose_to_layers(ecom_summary);
  const frontend = layers.find((l) => l.name === "前端层")!;
  return frontend.modules.length === 4
    && frontend.modules.includes("页面布局与路由")
    && frontend.modules.includes("API对接");
});

test("T-0019: 数据层 → 正确模块", () => {
  const layers = decompose_to_layers(ecom_summary);
  const data = layers.find((l) => l.name === "数据层")!;
  return data.modules.includes("表结构设计")
    && data.modules.includes("查询优化");
});

test("T-0019: 每层按职能分配技术栈", () => {
  const layers = decompose_to_layers(ecom_summary);
  const frontend = layers.find((l) => l.name === "前端层")!;
  const backend = layers.find((l) => l.name === "后端层")!;
  const data = layers.find((l) => l.name === "数据层")!;
  return frontend.tech_stack === "React"
    && backend.tech_stack === "Go"
    && data.tech_stack === "PostgreSQL";
});

const cms_summary: InterviewSummary = {
  project_description: "新项目: 内容管理系统CMS。目标用户: 编辑团队。",
  tech_stack: "Node.js + PostgreSQL + Next.js",
  deployment: "云服务部署",
  suggested_layers: ["前端层", "后端层", "数据层", "DevOps层"],
  estimated_roles: 13,
  risk_items: [],
};

test("T-0019: CMS后端 → 含内容管理/用户权限/搜索", () => {
  const layers = decompose_to_layers(cms_summary);
  const backend = layers.find((l) => l.name === "后端层")!;
  return backend.modules.includes("内容管理")
    && backend.modules.includes("用户权限")
    && backend.modules.includes("搜索模块");
});

test("T-0019: DevOps层 → 正确模块", () => {
  const layers = decompose_to_layers(cms_summary);
  const devops = layers.find((l) => l.name === "DevOps层")!;
  return devops.modules.includes("CI/CD流水线")
    && devops.modules.includes("部署配置")
    && devops.modules.includes("监控告警");
});

test("T-0019: 未知层名 → 通用模块A/B/C", () => {
  const summary: InterviewSummary = {
    ...ecom_summary,
    suggested_layers: ["未知层"],
  };
  const layers = decompose_to_layers(summary);
  return layers[0].modules.includes("模块A")
    && layers[0].modules.includes("模块B")
    && layers[0].modules.includes("模块C");
});

// ===== T-0020: 组长人物卡生成器 =====

test("T-0020: 组长卡 -> 角色含 [组长]", () => {
  const layer: LayerDefinition = { name: "前端层", modules: ["A"], tech_stack: "React" };
  const card = generate_team_lead_card(layer);
  return card.role.includes("组长") && card.role.includes("前端");
});

test("T-0020: 组长卡 → must_do含审查/拆解/验收", () => {
  const layer: LayerDefinition = { name: "后端层", modules: ["A"], tech_stack: "Go" };
  const card = generate_team_lead_card(layer);
  return card.must_do.some((d) => d.includes("审查"))
    && card.must_do.some((d) => d.includes("拆解"))
    && card.must_do.some((d) => d.includes("验收"));
});

test("T-0020: 组长卡 → must_not_do≥4", () => {
  const layer: LayerDefinition = { name: "数据层", modules: ["A"], tech_stack: "PostgreSQL" };
  const card = generate_team_lead_card(layer);
  return card.must_not_do.length >= 4;
});

test("T-0020: 组长卡 → permission_mode=bypassPermissions", () => {
  const layer: LayerDefinition = { name: "前端层", modules: ["A"], tech_stack: "React" };
  const card = generate_team_lead_card(layer);
  return card.permission_mode === "bypassPermissions";
});

test("T-0020: 组长卡 → 输入来源=主Agent, 输出目标=成员", () => {
  const layer: LayerDefinition = { name: "后端层", modules: ["A"], tech_stack: "Go" };
  const card = generate_team_lead_card(layer);
  return card.input_sources[0].from === "主Agent"
    && card.output_targets[0].to.includes("成员");
});

test("T-0020: 组长卡 → 含越界+不确定行为规则", () => {
  const layer: LayerDefinition = { name: "前端层", modules: ["A"], tech_stack: "React" };
  const card = generate_team_lead_card(layer);
  return card.behavior_rules.some((r) => r.includes("超出"))
    && card.behavior_rules.some((r) => r.includes("不确定"));
});

test("T-0020: 组长卡 → lifecycle可自定义", () => {
  const layer: LayerDefinition = { name: "前端层", modules: ["A"], tech_stack: "React" };
  const permanent = generate_team_lead_card(layer, "permanent");
  const destroy = generate_team_lead_card(layer, "project_destroy");
  return permanent.lifecycle === "permanent"
    && destroy.lifecycle === "project_destroy";
});

// ===== T-0021: 成员人物卡生成器 =====

test("T-0021: 成员卡 → 角色含模块名+工程师", () => {
  const layer: LayerDefinition = { name: "后端层", modules: ["订单模块"], tech_stack: "Go" };
  const card = generate_member_card("订单模块", layer, []);
  return card.role.includes("订单模块") && card.role.includes("工程师");
});

test("T-0021: 成员卡 → must_do含实现/测试/审查/汇报", () => {
  const layer: LayerDefinition = { name: "后端层", modules: ["支付模块"], tech_stack: "Go" };
  const card = generate_member_card("支付模块", layer, []);
  return card.must_do.some((d) => d.includes("实现"))
    && card.must_do.some((d) => d.includes("测试"))
    && card.must_do.some((d) => d.includes("审查"))
    && card.must_do.some((d) => d.includes("汇报"));
});

test("T-0021: 成员卡 → must_not_do含跨模块/跨组/直接联系约束", () => {
  const layer: LayerDefinition = { name: "前端层", modules: ["组件库"], tech_stack: "React" };
  const card = generate_member_card("组件库", layer, []);
  return card.must_not_do.some((d) => d.includes("跨模块"))
    && card.must_not_do.some((d) => d.includes("跨组"))
    && card.must_not_do.some((d) => d.includes("直接联系"));
});

test("T-0021: 成员卡 → 附加约束合并到must_not_do", () => {
  const layer: LayerDefinition = { name: "后端层", modules: ["订单模块"], tech_stack: "Go" };
  const constraints = ["不碰数据库主键", "不使用第三方ORM"];
  const card = generate_member_card("订单模块", layer, constraints);
  return card.must_not_do.includes("不碰数据库主键")
    && card.must_not_do.includes("不使用第三方ORM");
});

test("T-0021: 成员卡 → 输入=组长, 输出=组长", () => {
  const layer: LayerDefinition = { name: "数据层", modules: ["查询优化"], tech_stack: "PostgreSQL" };
  const card = generate_member_card("查询优化", layer, []);
  return card.input_sources[0].from.includes("组长")
    && card.output_targets[0].to.includes("组长");
});

test("T-0021: 成员卡 → 行为规则指向组长(非主Agent)", () => {
  const layer: LayerDefinition = { name: "前端层", modules: ["状态管理"], tech_stack: "React" };
  const card = generate_member_card("状态管理", layer, []);
  return card.behavior_rules.every((r) => !r.includes("主Agent"))
    && card.behavior_rules.some((r) => r.includes("组长"));
});

test("T-0021: 成员卡 → lifecycle默认follow_project", () => {
  const layer: LayerDefinition = { name: "后端层", modules: ["用户模块"], tech_stack: "Go" };
  const card = generate_member_card("用户模块", layer, []);
  return card.lifecycle === "follow_project";
});

// ===== T-0023: Agent注入格式渲染 =====

const valid_card: PersonaCard = {
  name: "林一舟",
  role: "订单模块工程师",
  summary: "专注订单模块实现",
  must_do: ["实现订单CRUD", "编写状态机测试", "交付物通过组长审查"],
  must_not_do: ["不跨模块决策", "不跨组通信"],
  tech_env: { language: "Go", tools: ["git", "editor"], code_style: "严格遵循全局约定" },
  input_sources: [{ from: "后端组长", format: "模块任务卡" }],
  output_targets: [{ to: "后端组长", format: "代码 + 文档" }],
  behavior_rules: ["越界回复: 超出职责范围，请转交组长", "不确定回复: 待组长确认"],
  permission_mode: "bypassPermissions",
  lifecycle: "follow_project",
};

test("T-0023: 渲染 → 含系统指令开头", () => {
  const text = render_agent_injection(valid_card);
  return text.includes("[系统指令]");
});

test("T-0023: 渲染 → 含姓名+角色", () => {
  const text = render_agent_injection(valid_card);
  return text.includes("林一舟") && text.includes("订单模块工程师");
});

test("T-0023: 渲染 → 有5个明确小节", () => {
  const text = render_agent_injection(valid_card);
  return text.includes("## 你的职责")
    && text.includes("## 你必须做的事")
    && text.includes("## 你绝对不能做的事")
    && text.includes("## 你的技术环境")
    && text.includes("## 行为准则");
});

test("T-0023: 渲染 → must_do全部列出", () => {
  const text = render_agent_injection(valid_card);
  return text.includes("实现订单CRUD")
    && text.includes("编写状态机测试")
    && text.includes("交付物通过组长审查");
});

test("T-0023: 渲染 → must_not_do全部列出", () => {
  const text = render_agent_injection(valid_card);
  return text.includes("不跨模块决策")
    && text.includes("不跨组通信");
});

test("T-0023: 渲染 → 含输入/输出章节", () => {
  const text = render_agent_injection(valid_card);
  return text.includes("## 你的输入")
    && text.includes("## 你的输出")
    && text.includes("后端组长")
    && text.includes("模块任务卡");
});

test("T-0023: 渲染 → 含权限说明(无审批模式)", () => {
  const text = render_agent_injection(valid_card);
  return text.includes("权限") || text.includes("无审批模式");
});

test("T-0023: 渲染 → framework和code_style正确渲染", () => {
  const card_with_framework: PersonaCard = {
    ...valid_card,
    tech_env: {
      language: "TypeScript",
      framework: "React 18",
      tools: ["vscode", "git"],
      code_style: "ESLint + Prettier",
    },
  };
  const text = render_agent_injection(card_with_framework);
  return text.includes("React 18") && text.includes("ESLint + Prettier");
});

test("T-0023: 渲染 → 行为规则全部列出", () => {
  const text = render_agent_injection(valid_card);
  return text.includes("越界回复") && text.includes("不确定回复");
});

// ===== T-0024: 人物卡客户确认流程 =====

const cards: PersonaCard[] = [valid_card, { ...valid_card, name: "张思远", role: "支付模块工程师" }];

test("T-0024: create_card_review → 初始状态全pending", () => {
  const state = create_card_review(cards);
  return state.items.length === 2
    && state.items.every((i) => i.status === "pending")
    && state.current_index === 0;
});

test("T-0024: confirm_card → 状态变为confirmed", () => {
  let state = create_card_review(cards);
  state = confirm_card(state, 0);
  return state.items[0].status === "confirmed"
    && state.current_index === 1;
});

test("T-0024: confirm_card → 确认后current_index递增", () => {
  let state = create_card_review(cards);
  state = confirm_card(state, 0);
  state = confirm_card(state, 1);
  return state.current_index === 2;
});

test("T-0024: modify_card → 修改字段记录", () => {
  let state = create_card_review(cards);
  state = modify_card(state, 0, { role: "前端工程师" });
  return state.items[0].status === "modified"
    && state.items[0].card.role === "前端工程师"
    && state.items[0].modifications.role === "前端工程师";
});

test("T-0024: modify_card → 多次修改累积", () => {
  let state = create_card_review(cards);
  state = modify_card(state, 0, { role: "前端工程师" });
  state = modify_card(state, 0, { summary: "新摘要" });
  return state.items[0].card.role === "前端工程师"
    && state.items[0].card.summary === "新摘要"
    && state.items[0].modifications.role === "前端工程师"
    && state.items[0].modifications.summary === "新摘要";
});

test("T-0024: all_cards_reviewed → 全部确认后为true", () => {
  let state = create_card_review(cards);
  state = confirm_card(state, 0);
  state = confirm_card(state, 1);
  return all_cards_reviewed(state) === true;
});

test("T-0024: all_cards_reviewed → 部分确认后为false", () => {
  let state = create_card_review(cards);
  state = confirm_card(state, 0);
  return all_cards_reviewed(state) === false;
});

test("T-0024: all_cards_reviewed → 全部修改后也为true", () => {
  let state = create_card_review(cards);
  state = modify_card(state, 0, { role: "前端工程师" });
  state = modify_card(state, 1, { role: "后端工程师" });
  return all_cards_reviewed(state) === true;
});

test("T-0024: 确认流程 → confirm后不改原数组", () => {
  let state = create_card_review(cards);
  state = confirm_card(state, 0);
  // 原cards[0] 应未变
  return cards[0].role === valid_card.role
    && state.items[0].status === "confirmed";
});

// ===== generate_team 集成测试 =====

test("T-0022~0024 集成: generate_team → 返回leads+members", () => {
  const result = generate_team(ecom_summary);
  return result.leads.length === 3
    && result.members.length >= 6; // 至少每层2成员
});

test("T-0022~0024 集成: generate_team → 组长与成员角色不同", () => {
  const result = generate_team(ecom_summary);
  const lead_roles = result.leads.map((l) => l.role);
  const member_roles = result.members.map((m) => m.role);
  return lead_roles.every((r) => r.includes("组长"))
    && member_roles.every((r) => r.includes("工程师"))
    && !member_roles.some((r) => r.includes("组长"));
});

test("T-0022~0024 集成: generate_team → 所有卡permission_mode=bypassPermissions", () => {
  const result = generate_team(ecom_summary);
  return [...result.leads, ...result.members].every(
    (c) => c.permission_mode === "bypassPermissions"
  );
});

test("T-0022~0024 集成: generate_team → 成员输入来源指向对应组长", () => {
  const result = generate_team(ecom_summary);
  return result.members.every((m) =>
    m.input_sources[0].from.includes("组长")
  );
});

test("T-0022~0024 集成: generate_team → 所有名字唯一", () => {
  const result = generate_team(ecom_summary);
  const all_names = [...result.leads, ...result.members].map((c) => c.name);
  const name_set = new Set(all_names);
  return name_set.size === all_names.length;
});

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
console.log(fail === 0 ? "QA: PASS" : "QA: FAIL");
process.exit(fail > 0 ? 1 : 0);
