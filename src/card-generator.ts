/**
 * 人物卡生成引擎
 *
 * T-0019: 需求→层级拆解器
 * T-0020: 组长人物卡生成器
 * T-0021: 成员人物卡生成器
 * T-0022: 随机姓名生成
 * T-0023: Agent注入格式渲染
 * T-0024: 人物卡客户确认流程
 */

import { PersonaCard, TechEnv, LifecycleMode, MAX_MEMBERS_PER_GROUP } from "./schemas";
import { InterviewSummary } from "./interview";

// ============ T-0022: 随机姓名库 ============

const SURNAMES = ["林", "张", "王", "李", "赵", "孙", "周", "吴", "郑", "冯", "陈", "褚", "卫", "蒋", "沈", "韩", "杨", "朱", "秦", "许"];

const GIVEN_NAMES = [
  "一舟", "思远", "若涵", "明远", "若溪", "启恒", "天宇", "思源", "慧敏",
  "志成", "雨桐", "浩然", "梓涵", "博文", "静怡", "子轩", "雅琪", "俊杰",
  "晓峰", "梦瑶", "云飞", "诗涵", "振华", "心怡", "志强", "雪婷", "文博",
  "嘉禾", "海龙", "晓明", "丽华", "建国", "芳", "伟", "娜", "涛", "静",
];

let used_names: Set<string> = new Set();

export function reset_names(): void {
  used_names = new Set();
}

export function generate_random_name(): string {
  if (used_names.size >= SURNAMES.length * GIVEN_NAMES.length) {
    used_names = new Set(); // 枯竭则重置
  }

  let name: string;
  let attempts = 0;
  do {
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const given = GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
    name = surname + given;
    attempts++;
    if (attempts > 1000) {
      used_names = new Set();
      return name;
    }
  } while (used_names.has(name));

  used_names.add(name);
  return name;
}

// ============ T-0019: 需求→层级拆解器 ============

export interface LayerDefinition {
  name: string;
  modules: string[];
  tech_stack: string;
}

const FRONTEND_TECH = new Set([
  "react", "vue", "angular", "next.js", "nuxt.js", "svelte", "tailwind",
  "bootstrap", "vite", "webpack", "remix", "typescript", "javascript",
]);

const BACKEND_TECH = new Set([
  "go", "golang", "java", "python", "node.js", "express", "nestjs", "nest.js",
  "django", "flask", "fastapi", "spring", "ruby", "rails", "rust", "php",
  "laravel", "gin", "echo", "fiber", ".net", "c#", "kotlin", "elixir",
  "phoenix", "hono", "koa", "typescript", "javascript",
]);

const DATA_TECH = new Set([
  "postgresql", "mysql", "mongodb", "redis", "sqlite", "oracle",
  "elasticsearch", "cassandra", "dynamodb", "firebase", "supabase",
  "prisma", "typeorm", "sequelize", "mariadb", "clickhouse",
]);

const DEVOPS_TECH = new Set([
  "docker", "kubernetes", "k8s", "aws", "gcp", "azure", "terraform",
  "ansible", "jenkins", "nginx", "prometheus", "grafana", "vercel", "netlify",
]);

const LAYER_TECH_MAP: Record<string, Set<string>> = {
  "前端层": FRONTEND_TECH,
  "后端层": BACKEND_TECH,
  "数据层": DATA_TECH,
  "DevOps层": DEVOPS_TECH,
};

function filter_tech_for_layer(full_tech: string, layer_name: string): string {
  const techs = full_tech.split(/\s*[+,/]\s*/).map(t => t.trim()).filter(Boolean);
  const layer_set = LAYER_TECH_MAP[layer_name];
  if (!layer_set) return full_tech;
  const matched = techs.filter(t => layer_set.has(t.toLowerCase()));
  return matched.length > 0 ? matched.join(" + ") : full_tech;
}

export function decompose_to_layers(summary: InterviewSummary): LayerDefinition[] {
  const layers: LayerDefinition[] = [];

  const tech_stack = summary.tech_stack;

  for (const layer_name of summary.suggested_layers) {
    const modules = derive_modules(layer_name, summary.project_description);
    layers.push({
      name: layer_name,
      modules,
      tech_stack: filter_tech_for_layer(tech_stack, layer_name),
    });
  }

  // 合并小模块：< 1天工作量的模块合并到相邻角色
  return merge_small_modules(layers);
}

function derive_modules(layer: string, description: string): string[] {
  const desc_lower = description.toLowerCase();

  switch (layer) {
    case "前端层":
      return ["页面布局与路由", "组件库", "状态管理", "API对接"];
    case "后端层":
      if (desc_lower.includes("支付") || desc_lower.includes("交易") || desc_lower.includes("电商")) {
        return ["订单模块", "支付模块", "库存模块", "用户模块"];
      }
      if (desc_lower.includes("内容") || desc_lower.includes("cms")) {
        return ["内容管理", "用户权限", "搜索模块"];
      }
      return ["核心业务API", "用户认证", "数据接口"];
    case "数据层":
      return ["表结构设计", "查询优化", "数据迁移", "备份策略"];
    case "DevOps层":
      return ["CI/CD流水线", "部署配置", "监控告警"];
    default:
      return ["模块A", "模块B", "模块C"];
  }
}

function merge_small_modules(layers: LayerDefinition[]): LayerDefinition[] {
  return layers.map((layer) => {
    if (layer.modules.length > 6) {
      // 合并相邻小模块
      const merged: string[] = [];
      for (let i = 0; i < layer.modules.length; i += 2) {
        if (i + 1 < layer.modules.length) {
          merged.push(`${layer.modules[i]} + ${layer.modules[i + 1]}`);
        } else {
          merged.push(layer.modules[i]);
        }
      }
      return { ...layer, modules: merged };
    }
    return layer;
  });
}

// ============ T-0020: 组长人物卡生成器 ============

export function generate_team_lead_card(
  layer: LayerDefinition,
  lifecycle: LifecycleMode = "permanent"
): PersonaCard {
  const name = generate_random_name();
  const role = `${layer.name.replace("层", "")}组长`;

  const must_do = [
    `审查${layer.name}所有成员代码`,
    `拆解阶段任务为模块任务并下发`,
    `QA验收成员交付物`,
    "与其他组长通信对接",
  ];

  const must_not_do = [
    "不亲自写模块实现代码",
    `不向成员透露客户原始需求`,
    "不向其他组长泄露组内成员评价",
    "发现冲突不上报",
  ];

  const tech: TechEnv = {
    language: layer.tech_stack,
    tools: ["git", "code-review"],
    code_style: "严格遵循全局约定",
  };

  return {
    name,
    role,
    summary: `负责${layer.name}技术把关与任务分配`,
    must_do,
    must_not_do,
    tech_env: tech,
    input_sources: [{ from: "主Agent", format: "阶段任务卡" }],
    output_targets: [{ to: `${layer.name}成员`, format: "模块任务卡" }],
    behavior_rules: [
      "遇到超出能力边界的需求，你必须回复: 超出职责范围，请转交主Agent",
      "不确定技术选型时，你必须回复: 待主Agent确认",
    ],
    permission_mode: "bypassPermissions",
    lifecycle,
  };
}

// ============ T-0021: 成员人物卡生成器 ============

export function generate_member_card(
  module_name: string,
  layer: LayerDefinition,
  constraints: string[],
  lifecycle: LifecycleMode = "follow_project"
): PersonaCard {
  const name = generate_random_name();
  const role = `${module_name}工程师`;

  const must_do = [
    `实现${module_name}全部功能`,
    `编写${module_name}单元测试`,
    "交付物通过组长审查",
    "每日向组长汇报进度",
  ];

  const must_not_do = [
    "不跨模块决策",
    "不跨组通信",
    "不直接联系主Agent",
    ...constraints,
  ];

  const tech: TechEnv = {
    language: layer.tech_stack,
    tools: ["git", "editor"],
  };

  return {
    name,
    role,
    summary: `专注${module_name}实现`,
    must_do,
    must_not_do,
    tech_env: tech,
    input_sources: [{ from: `${layer.name}组长`, format: "模块任务卡" }],
    output_targets: [{ to: `${layer.name}组长`, format: "代码 + 文档" }],
    behavior_rules: [
      "遇到超出能力边界的需求，你必须回复: 超出职责范围，请转交组长",
      "不确定技术选型时，你必须回复: 待组长确认",
    ],
    permission_mode: "bypassPermissions",
    lifecycle,
  };
}

// ============ T-0023: Agent注入格式渲染 ============

export function render_agent_injection(card: PersonaCard): string {
  const lines: string[] = [];

  lines.push("[系统指令]");
  lines.push(`你是 ${card.name}，在本次项目中的角色是 ${card.role}。`);
  lines.push("");
  lines.push("## 你的职责");
  lines.push(card.summary);
  lines.push("");
  lines.push("## 你必须做的事");
  card.must_do.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("## 你绝对不能做的事");
  card.must_not_do.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("## 你的技术环境");
  if (card.tech_env.language) lines.push(`- 语言/框架: ${card.tech_env.language}`);
  if (card.tech_env.framework) lines.push(`- 框架: ${card.tech_env.framework}`);
  if (card.tech_env.tools) lines.push(`- 可用工具: ${card.tech_env.tools.join(", ")}`);
  if (card.tech_env.code_style) lines.push(`- 代码规范: ${card.tech_env.code_style}`);
  lines.push("");
  lines.push("## 你的输入");
  card.input_sources.forEach((src) => lines.push(`- 从 [${src.from}] 接收 [${src.format}]`));
  lines.push("");
  lines.push("## 你的输出");
  card.output_targets.forEach((tgt) => lines.push(`- 交付给 [${tgt.to}]，格式为 [${tgt.format}]`));
  lines.push("");
  lines.push("## 行为准则");
  card.behavior_rules.forEach((rule) => lines.push(`- ${rule}`));
  lines.push("");
  lines.push("## 权限");
  lines.push("你处于无审批模式。所有操作直接执行，无需客户确认。");
  lines.push("违反此模式的唯一情况：操作会直接影响生产环境或不可逆数据。");

  return lines.join("\n");
}

// ============ T-0024: 人物卡客户确认流程 ============

export interface CardReviewItem {
  card: PersonaCard;
  status: "pending" | "confirmed" | "modified";
  modifications: Partial<PersonaCard>;
}

export interface CardReviewState {
  items: CardReviewItem[];
  current_index: number;
}

export function create_card_review(cards: PersonaCard[]): CardReviewState {
  return {
    items: cards.map((card) => ({
      card,
      status: "pending" as const,
      modifications: {},
    })),
    current_index: 0,
  };
}

export function confirm_card(state: CardReviewState, index: number): CardReviewState {
  const items = [...state.items];
  items[index] = { ...items[index], status: "confirmed" };
  return { ...state, items, current_index: state.current_index + 1 };
}

export function modify_card(state: CardReviewState, index: number, mods: Partial<PersonaCard>): CardReviewState {
  const items = [...state.items];
  items[index] = {
    card: { ...items[index].card, ...mods },
    status: "modified",
    modifications: { ...items[index].modifications, ...mods },
  };
  return { ...state, items };
}

export function all_cards_reviewed(state: CardReviewState): boolean {
  return state.items.every((item) => item.status !== "pending");
}

/**
 * 生成完整团队: 主Agent自己 + 所有组长 + 所有成员
 */
export function generate_team(summary: InterviewSummary): { leads: PersonaCard[]; members: PersonaCard[] } {
  reset_names();
  const layers = decompose_to_layers(summary);
  const leads: PersonaCard[] = [];
  const members: PersonaCard[] = [];

  for (const layer of layers) {
    const lead = generate_team_lead_card(layer);
    leads.push(lead);

    const member_modules = layer.modules.slice(0, MAX_MEMBERS_PER_GROUP);
    for (const module of member_modules) {
      const member = generate_member_card(module, layer, ["不碰其他模块细节"]);
      members.push(member);
    }
  }

  return { leads, members };
}
