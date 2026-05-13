/**
 * 上下文控制系统
 *
 * T-0046: 成员上下文裁剪器
 * T-0047: 组长上下文裁剪器
 * T-0048: 主Agent上下文全量注入
 * T-0049: 上下文泄漏防护
 * T-0050: 上下文快照与恢复
 */

import { PersonaCard, ProjectArchive, ConflictRecord, SatisfactionRecord } from "./schemas";
import { StageTaskCard, ModuleTaskCard } from "./schemas";
import { ConventionRule } from "./conflict-arbitrator";

// ============ 通用类型 ============

export interface ContextSnapshot {
  role_name: string;
  role_level: "member" | "team_lead" | "lead_agent";
  created_at: string;
  content: string;
  /** 快照序列号，越大越新 */
  sequence: number;
}

// ============ T-0046: 成员上下文裁剪器 ============

export interface MemberContextInput {
  persona_card: PersonaCard;
  module_task_card: ModuleTaskCard;
  /** 上游接口定义 (组长精选) */
  upstream_interfaces: string[];
  /** 下游接口定义 (组长精选) */
  downstream_interfaces: string[];
  /** 全局约定精简版 */
  simplified_conventions: ConventionRule[];
}

export interface MemberContext {
  persona_card: PersonaCard;
  module_task_card: ModuleTaskCard;
  upstream_interfaces: string[];
  downstream_interfaces: string[];
  simplified_conventions: ConventionRule[];
}

/**
 * 仅注入成员需要的信息:
 * 人物卡 + 模块任务卡 + 上下游接口定义 + 全局约定精简版
 *
 * 不注入: 全局架构/其他模块/客户需求
 */
export function crop_member_context(input: MemberContextInput): MemberContext {
  return {
    persona_card: input.persona_card,
    module_task_card: input.module_task_card,
    upstream_interfaces: input.upstream_interfaces,
    downstream_interfaces: input.downstream_interfaces,
    simplified_conventions: input.simplified_conventions,
  };
}

/**
 * 检查是否向成员泄露了不应有的信息
 */
export function validate_member_context(ctx: MemberContext): {
  valid: boolean;
  leaks: string[];
} {
  const leaks: string[] = [];

  // 全局架构关键词检测
  const sensitive_keys = [
    "全局架构", "整个系统", "所有模块", "完整技术栈",
    "客户需求", "client requirement", "客户预算", "商业模式",
  ];

  const content_str = JSON.stringify(ctx);
  for (const key of sensitive_keys) {
    if (content_str.includes(key)) {
      leaks.push(`成员上下文中含有禁用信息: ${key}`);
    }
  }

  // 人物卡角色不能含组长/主Agent
  if (ctx.persona_card.role.includes("组长") || ctx.persona_card.role.includes("主Agent")) {
    leaks.push("成员角色异常: 不能包含组长/主Agent角色");
  }

  return { valid: leaks.length === 0, leaks };
}

// ============ T-0047: 组长上下文裁剪器 ============

export interface TeamLeadContextInput {
  /** 组内全部成员人物卡 */
  group_member_cards: PersonaCard[];
  /** 组长自己的人物卡 */
  lead_card: PersonaCard;
  /** 当前阶段卡 */
  stage_card: StageTaskCard;
  /** 其他组长的接口面 (仅接口定义，不含内部细节) */
  other_lead_interfaces: {
    lead_name: string;
    group: string;
    interface_face: string;
  }[];
  /** 全局约定全量 */
  full_conventions: ConventionRule[];
}

export interface TeamLeadContext {
  group_member_cards: PersonaCard[];
  lead_card: PersonaCard;
  stage_card: StageTaskCard;
  other_lead_interfaces: {
    lead_name: string;
    group: string;
    interface_face: string;
  }[];
  full_conventions: ConventionRule[];
}

/**
 * 只注入组长层级需要的信息:
 * 组内全员卡 + 阶段卡 + 其他组长接口面 + 全局约定全量
 *
 * 不注入: 客户需求全文/其他组内部细节/策略决策权
 */
export function crop_team_lead_context(input: TeamLeadContextInput): TeamLeadContext {
  return {
    group_member_cards: input.group_member_cards,
    lead_card: input.lead_card,
    stage_card: input.stage_card,
    other_lead_interfaces: input.other_lead_interfaces,
    full_conventions: input.full_conventions,
  };
}

/**
 * 检查是否向组长泄露了不应有的信息
 */
export function validate_team_lead_context(ctx: TeamLeadContext): {
  valid: boolean;
  leaks: string[];
} {
  const leaks: string[] = [];
  const content_str = JSON.stringify(ctx);

  const forbidden = [
    "客户需求全文", "客户偏好画像", "角色库存",
    "策略决策权", "其他组内部细节",
    "满意度历史", "故障记录",
  ];

  for (const key of forbidden) {
    if (content_str.includes(key)) {
      leaks.push(`组长上下文中含有禁用信息: ${key}`);
    }
  }

  // 其他组长接口面不能含成员级别细节
  for (const iface of ctx.other_lead_interfaces) {
    if (iface.interface_face.includes("成员") && iface.interface_face.includes("评价")) {
      leaks.push(`组长接口面含组内评价: ${iface.lead_name}`);
    }
  }

  return { valid: leaks.length === 0, leaks };
}

// ============ T-0048: 主Agent上下文全量注入 ============

export interface LeadAgentContextInput {
  all_persona_cards: PersonaCard[];
  client_requirements: string;
  global_conventions: ConventionRule[];
  project_archive?: ProjectArchive;
  preference_profile?: string;
  role_inventory?: string;
  conflict_records: ConflictRecord[];
  satisfaction_history: SatisfactionRecord[];
}

export interface LeadAgentContext {
  all_persona_cards: PersonaCard[];
  client_requirements: string;
  global_conventions: ConventionRule[];
  project_archive?: ProjectArchive;
  preference_profile?: string;
  role_inventory?: string;
  conflict_records: ConflictRecord[];
  satisfaction_history: SatisfactionRecord[];
  /** 角色分布统计 */
  role_summary: {
    total: number;
    leads: number;
    members: number;
    groups: string[];
  };
}

/**
 * 主Agent上下文全量注入:
 * 所有人物卡 + 客户需求 + 全局约定 + 项目档案 + 偏好画像 + 角色库存 + 冲突记录 + 满意度历史
 */
export function inject_lead_agent_context(input: LeadAgentContextInput): LeadAgentContext {
  const role_summary = build_role_summary(input.all_persona_cards);

  return {
    all_persona_cards: input.all_persona_cards,
    client_requirements: input.client_requirements,
    global_conventions: input.global_conventions,
    project_archive: input.project_archive,
    preference_profile: input.preference_profile,
    role_inventory: input.role_inventory,
    conflict_records: input.conflict_records,
    satisfaction_history: input.satisfaction_history,
    role_summary,
  };
}

function build_role_summary(cards: PersonaCard[]): {
  total: number;
  leads: number;
  members: number;
  groups: string[];
} {
  const leads = cards.filter((c) => c.role.includes("组长")).length;
  const members = cards.filter((c) => !c.role.includes("组长") && !c.role.includes("主Agent")).length;
  const groups = [...new Set(
    cards
      .filter((c) => c.role.includes("组"))
      .map((c) => {
        const m = c.role.match(/(\S+组)/);
        return m ? m[1] : c.role;
      })
  )];

  return { total: cards.length, leads, members, groups };
}

/**
 * 检查主Agent上下文完整性
 */
export function validate_lead_agent_context(ctx: LeadAgentContext): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!ctx.client_requirements || ctx.client_requirements.length === 0) {
    missing.push("缺少客户需求");
  }
  if (ctx.all_persona_cards.length === 0) {
    missing.push("缺少人物卡");
  }
  if (ctx.global_conventions.length === 0) {
    missing.push("缺少全局约定");
  }

  return { valid: missing.length === 0, missing };
}

// ============ T-0049: 上下文泄漏防护 ============

export interface LeakDetection {
  detected: boolean;
  severity: "warning" | "blocking";
  source: string;
  target: string;
  leak_type: string;
  details: string[];
}

const SENSITIVE_PATTERNS = {
  requirement: [
    "客户需求", "client requirement", "客户说", "用户需求文档",
    "需求规格", "PRD", "产品需求", "原始需求", "业务需求",
  ],
  preference: [
    "偏好", "preference", "客户喜欢", "客户倾向",
    "风格偏好", "审美", "个人喜好",
  ],
  evaluation: [
    "评分", "满意度", "不称职", "能力差", "表现不好",
    "低分", "差评", "评价差", "工作态度", "不可靠",
  ],
  conflict_detail: [
    "内部冲突细节", "冲突详情", "具体矛盾",
    "谁对谁错", "责任归属", "过错方",
  ],
  other_group_internal: [
    "组内实现细节", "内部架构", "代码审查意见",
    "成员技能短板", "内部讨论", "组内分歧",
  ],
};

/**
 * 检测组长派活时是否携带需求原文/偏好/评价
 */
export function detect_task_dispatch_leak(
  task_message: string,
  sender: string
): LeakDetection | null {
  const details: string[] = [];

  for (const p of SENSITIVE_PATTERNS.requirement) {
    if (task_message.includes(p)) {
      details.push(`包含需求信息: "${p}"`);
    }
  }
  for (const p of SENSITIVE_PATTERNS.preference) {
    if (task_message.includes(p)) {
      details.push(`包含偏好信息: "${p}"`);
    }
  }
  for (const p of SENSITIVE_PATTERNS.evaluation) {
    if (task_message.includes(p)) {
      details.push(`包含评价信息: "${p}"`);
    }
  }

  if (details.length === 0) return null;

  return {
    detected: true,
    severity: details.some((d) => d.includes("评价") || d.includes("满意度")) ? "blocking" : "warning",
    source: sender,
    target: "成员",
    leak_type: "任务下发泄露",
    details,
  };
}

/**
 * 检测成员通信是否越界 (跨组通信/直接联系主Agent)
 */
export function detect_member_cross_boundary_leak(
  message: string,
  sender: string,
  sender_group: string,
  target: string,
  target_group?: string,
  target_role?: string
): LeakDetection | null {
  const details: string[] = [];

  // 检测是否跨组通信
  if (target_group && target_group !== sender_group) {
    details.push(`成员 ${sender}(${sender_group}) 越界通信至 ${target}(${target_group})`);
  }

  // 检测是否直接联系主Agent
  if (target_role === "lead_agent" || target === "主Agent") {
    details.push(`成员 ${sender} 越级直接联系主Agent`);
  }

  // 检测是否泄露组内信息
  for (const p of SENSITIVE_PATTERNS.other_group_internal) {
    if (message.includes(p)) {
      details.push(`成员通信包含组内信息: "${p}"`);
    }
  }

  if (details.length === 0) return null;

  return {
    detected: true,
    severity: "blocking",
    source: sender,
    target,
    leak_type: "成员越界通信",
    details,
  };
}

/**
 * 检测组长间通信是否泄露组内评价
 */
export function detect_lead_evaluation_leak(
  message: string,
  sender: string,
  _sender_group: string
): LeakDetection | null {
  const details: string[] = [];

  for (const p of SENSITIVE_PATTERNS.evaluation) {
    if (message.includes(p)) {
      details.push(`组长间通信包含评价: "${p}"`);
    }
  }

  if (details.length === 0) return null;

  return {
    detected: true,
    severity: "blocking",
    source: sender,
    target: "其他组长",
    leak_type: "组长泄露组内评价",
    details,
  };
}

/**
 * 检测主Agent汇报是否暴露内部冲突细节
 */
export function detect_agent_report_leak(
  report: string
): LeakDetection | null {
  const details: string[] = [];

  for (const p of SENSITIVE_PATTERNS.conflict_detail) {
    if (report.includes(p)) {
      details.push(`汇报包含冲突细节: "${p}"`);
    }
  }

  // 检测是否暴露成员个人评价
  const member_eval_pattern = /(\S+)\s*(评分|得分|评价)\s*(低|差|不)/g;
  let match;
  while ((match = member_eval_pattern.exec(report)) !== null) {
    details.push(`汇报暴露成员个人评价: ${match[0]}`);
  }

  if (details.length === 0) return null;

  return {
    detected: true,
    severity: "warning",
    source: "主Agent",
    target: "客户",
    leak_type: "主Agent汇报泄露内部细节",
    details,
  };
}

/**
 * 一站式泄漏检测
 */
export function run_leak_detection(
  message: string,
  sender: string,
  sender_role: "lead_agent" | "team_lead" | "member",
  sender_group?: string,
  target?: string,
  target_group?: string,
  target_role?: string
): LeakDetection[] {
  const leaks: LeakDetection[] = [];

  if (sender_role === "team_lead") {
    // 组长派活检测
    const task_leak = detect_task_dispatch_leak(message, sender);
    if (task_leak) leaks.push(task_leak);

    // 组长间通信检测
    const eval_leak = detect_lead_evaluation_leak(message, sender, sender_group || "");
    if (eval_leak) leaks.push(eval_leak);
  }

  if (sender_role === "member") {
    const cross = detect_member_cross_boundary_leak(
      message, sender, sender_group || "",
      target || "", target_group, target_role
    );
    if (cross) leaks.push(cross);
  }

  if (sender_role === "lead_agent") {
    const report_leak = detect_agent_report_leak(message);
    if (report_leak) leaks.push(report_leak);
  }

  return leaks;
}

// ============ T-0050: 上下文快照与恢复 ============

/**
 * 为指定角色创建上下文快照
 */
export function create_context_snapshot(
  role_name: string,
  role_level: "member" | "team_lead" | "lead_agent",
  content: object,
  existing_snapshots: ContextSnapshot[] = []
): ContextSnapshot {
  const existing = existing_snapshots.filter((s) => s.role_name === role_name);
  const max_seq = existing.reduce((max, s) => Math.max(max, s.sequence), 0);

  return {
    role_name,
    role_level,
    created_at: new Date().toISOString(),
    content: JSON.stringify(content),
    sequence: max_seq + 1,
  };
}

/**
 * 从快照恢复上下文
 */
export function restore_from_snapshot(
  role_name: string,
  snapshots: ContextSnapshot[]
): { snapshot: ContextSnapshot | null; available: ContextSnapshot[] } {
  const role_snapshots = snapshots
    .filter((s) => s.role_name === role_name)
    .sort((a, b) => b.sequence - a.sequence);

  const available = role_snapshots.filter((s) => {
    const age = Date.now() - new Date(s.created_at).getTime();
    return age < 24 * 60 * 60 * 1000; // 24h内有效
  });

  if (available.length === 0) return { snapshot: null, available: role_snapshots };

  // 最近快照解析回对象
  const snapshot = available[0];
  try {
    const parsed = {
      ...snapshot,
      parsed_content: JSON.parse(snapshot.content),
    } as ContextSnapshot & { parsed_content: object };
    return { snapshot: parsed, available: role_snapshots };
  } catch {
    return { snapshot: null, available: role_snapshots };
  }
}

/**
 * 批量创建快照
 */
export function batch_create_snapshots(
  roles: { name: string; level: "member" | "team_lead" | "lead_agent"; content: object }[],
  existing_snapshots: ContextSnapshot[] = []
): ContextSnapshot[] {
  const new_snapshots = [...existing_snapshots];
  for (const r of roles) {
    new_snapshots.push(create_context_snapshot(r.name, r.level, r.content, existing_snapshots));
  }
  return new_snapshots;
}

/**
 * 清理过期快照
 */
export function prune_expired_snapshots(
  snapshots: ContextSnapshot[],
  max_age_hours: number = 24
): ContextSnapshot[] {
  const cutoff = Date.now() - max_age_hours * 60 * 60 * 1000;
  return snapshots.filter((s) => new Date(s.created_at).getTime() > cutoff);
}

/**
 * 获取指定角色的快照历史
 */
export function get_snapshot_history(
  role_name: string,
  snapshots: ContextSnapshot[]
): ContextSnapshot[] {
  return snapshots
    .filter((s) => s.role_name === role_name)
    .sort((a, b) => b.sequence - a.sequence);
}

/**
 * 检查是否有可用快照用于故障恢复
 */
export function has_recoverable_snapshot(
  role_name: string,
  snapshots: ContextSnapshot[]
): boolean {
  const result = restore_from_snapshot(role_name, snapshots);
  return result.snapshot !== null;
}
