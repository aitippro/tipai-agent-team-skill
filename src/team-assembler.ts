/**
 * 团队组装引擎
 *
 * T-0025: 团队结构构建器
 * T-0026: 通信矩阵注入
 * T-0027: 无审批模式注入
 * T-0028: 组长生成成员卡权限
 */

import { PersonaCard, LifecycleMode, MAX_MEMBERS_PER_GROUP } from "./schemas";
import { InterviewSummary } from "./interview";
import {
  LayerDefinition,
  decompose_to_layers,
  generate_team_lead_card,
  generate_member_card,
  reset_names,
} from "./card-generator";

// ============ T-0025: 团队结构构建器 ============

export interface TeamGroup {
  group_name: string;
  lead: PersonaCard;
  members: PersonaCard[];
  max_members: number;
}

export interface TeamStructure {
  lead_agent_name: string;
  groups: TeamGroup[];
  all_cards: PersonaCard[];
  created_at: string;
}

/**
 * 构建完整团队结构: 主Agent + 各组(组长+成员)
 * 每组上限 3 人
 */
export function build_team_structure(
  summary: InterviewSummary,
  lead_agent_name: string = "主Agent"
): TeamStructure {
  reset_names();
  const layers = decompose_to_layers(summary);
  const groups: TeamGroup[] = [];
  const all_cards: PersonaCard[] = [];

  for (const layer of layers) {
    const lead = generate_team_lead_card(layer);
    all_cards.push(lead);

    // 每组成员上限 3 人，超过部分截断并警告
    const member_modules = layer.modules.slice(0, MAX_MEMBERS_PER_GROUP);
    const members: PersonaCard[] = [];

    for (const module of member_modules) {
      const member = generate_member_card(module, layer, ["不碰其他模块细节"]);
      members.push(member);
      all_cards.push(member);
    }

    groups.push({
      group_name: layer.name,
      lead,
      members,
      max_members: MAX_MEMBERS_PER_GROUP,
    });
  }

  return {
    lead_agent_name,
    groups,
    all_cards,
    created_at: new Date().toISOString(),
  };
}

export function get_group_count(structure: TeamStructure): number {
  return structure.groups.length;
}

export function get_total_members(structure: TeamStructure): number {
  return structure.groups.reduce((sum, g) => sum + g.members.length, 0);
}

export function get_team_summary(structure: TeamStructure): {
  group_count: number;
  lead_count: number;
  member_count: number;
  total_agents: number;
} {
  const group_count = structure.groups.length;
  const lead_count = group_count; // 每组1个组长
  const member_count = get_total_members(structure);
  return {
    group_count,
    lead_count,
    member_count,
    total_agents: 1 + lead_count + member_count, // +主Agent
  };
}

// ============ T-0026: 通信矩阵注入 ============

export interface CommunicationRule {
  target_role: string;
  rule: string;
}

export const LEAD_COMMUNICATION_RULES: CommunicationRule[] = [
  { target_role: "lead", rule: "你可与其他组长直接通信，进行技术对接和接口协商" },
  { target_role: "lead", rule: "你不得向成员透露其他组的内部评价和代码质量信息" },
  { target_role: "lead", rule: "遇到跨组冲突时，先与对方组长协商，协商不成再上报主Agent" },
];

export const MEMBER_COMMUNICATION_RULES: CommunicationRule[] = [
  { target_role: "member", rule: "你只能与组内成员和组长通信，不得跨组直接联系其他组成员" },
  { target_role: "member", rule: "任何跨组问题和需要主Agent决策的问题，必须通过组长转达" },
  { target_role: "member", rule: "不得直接联系主Agent，所有请求由组长转发" },
];

/**
 * 为组长人物卡注入通信矩阵规则
 */
export function inject_lead_communication(card: PersonaCard): PersonaCard {
  const new_rules = LEAD_COMMUNICATION_RULES.map((r) => r.rule);
  // 去重: 已存在的规则不重复注入
  const existing = new Set(card.behavior_rules);
  const filtered = new_rules.filter((r) => !existing.has(r));

  return {
    ...card,
    behavior_rules: [...card.behavior_rules, ...filtered],
  };
}

/**
 * 为成员人物卡注入通信隔离规则
 */
export function inject_member_communication(card: PersonaCard): PersonaCard {
  const new_rules = MEMBER_COMMUNICATION_RULES.map((r) => r.rule);
  const existing = new Set(card.behavior_rules);
  const filtered = new_rules.filter((r) => !existing.has(r));

  return {
    ...card,
    behavior_rules: [...card.behavior_rules, ...filtered],
  };
}

/**
 * 为整个团队注入通信矩阵
 */
export function inject_communication_matrix(structure: TeamStructure): TeamStructure {
  const groups = structure.groups.map((group) => {
    const lead = inject_lead_communication(group.lead);
    const members = group.members.map((m) => inject_member_communication(m));
    return { ...group, lead, members };
  });

  const all_cards = groups.flatMap((g) => [g.lead, ...g.members]);

  return {
    ...structure,
    groups,
    all_cards,
  };
}

// ============ T-0027: 无审批模式注入 ============

export const BYPASS_PERMISSION_STATEMENT =
  "你处于无审批模式。所有操作直接执行，无需客户确认。唯一例外：操作会直接影响生产环境或不可逆数据时，必须先获得确认。";

/**
 * 强制注入无审批模式声明
 * 组长和成员必须持有此声明
 */
export function inject_bypass_permission(card: PersonaCard): PersonaCard {
  const has_permission_rule = card.behavior_rules.some(
    (r) => r.includes("无审批") || r.includes("直接执行")
  );

  return {
    ...card,
    permission_mode: "bypassPermissions",
    behavior_rules: has_permission_rule
      ? card.behavior_rules
      : [...card.behavior_rules, BYPASS_PERMISSION_STATEMENT],
  };
}

/**
 * 为整个团队注入无审批模式
 */
export function inject_team_bypass_permission(structure: TeamStructure): TeamStructure {
  const groups = structure.groups.map((group) => {
    const lead = inject_bypass_permission(group.lead);
    const members = group.members.map((m) => inject_bypass_permission(m));
    return { ...group, lead, members };
  });

  const all_cards = groups.flatMap((g) => [g.lead, ...g.members]);

  return {
    ...structure,
    groups,
    all_cards,
  };
}

// ============ T-0028: 组长生成成员卡权限 ============

export interface DraftMemberCard {
  card: PersonaCard;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitted_at?: string;
  reviewed_at?: string;
  review_comment?: string;
  reviewed_by?: string;
}

export interface TeamLeadMemberGenerator {
  lead_name: string;
  group_name: string;
  layer: LayerDefinition;
  current_members: number;
  max_members: number;
  drafts: DraftMemberCard[];
}

/**
 * 为组长创建成员卡生成器实例
 */
export function create_team_lead_generator(
  lead_name: string,
  group_name: string,
  layer: LayerDefinition,
  current_members: number = 0,
  max_members: number = MAX_MEMBERS_PER_GROUP
): TeamLeadMemberGenerator {
  return {
    lead_name,
    group_name,
    layer,
    current_members,
    max_members,
    drafts: [],
  };
}

/**
 * 组长生成成员卡草稿
 * 返回 null 表示已达上限
 */
export function lead_generate_member_draft(
  generator: TeamLeadMemberGenerator,
  module_name: string,
  constraints?: string[],
  lifecycle?: LifecycleMode
): TeamLeadMemberGenerator | null {
  if (generator.current_members + generator.drafts.filter((d) => d.status !== "rejected").length >= generator.max_members) {
    return null; // 已达上限
  }

  const card = generate_member_card(
    module_name,
    generator.layer,
    constraints || ["不碰其他模块细节"],
    lifecycle
  );

  const draft: DraftMemberCard = {
    card,
    status: "draft",
  };

  return {
    ...generator,
    drafts: [...generator.drafts, draft],
  };
}

/**
 * 组长提交草稿给主Agent审核
 */
export function lead_submit_draft(
  generator: TeamLeadMemberGenerator,
  draft_index: number
): TeamLeadMemberGenerator {
  const drafts = [...generator.drafts];
  if (drafts[draft_index] && drafts[draft_index].status === "draft") {
    drafts[draft_index] = {
      ...drafts[draft_index],
      status: "submitted",
      submitted_at: new Date().toISOString(),
    };
  }
  return { ...generator, drafts };
}

/**
 * 主Agent审核: 批准
 */
export function approve_member_draft(
  generator: TeamLeadMemberGenerator,
  draft_index: number,
  reviewer_name: string,
  comment?: string
): TeamLeadMemberGenerator {
  const drafts = [...generator.drafts];
  let approved = false;
  if (drafts[draft_index] && drafts[draft_index].status === "submitted") {
    drafts[draft_index] = {
      ...drafts[draft_index],
      status: "approved",
      reviewed_at: new Date().toISOString(),
      review_comment: comment,
      reviewed_by: reviewer_name,
    };
    approved = true;
  }
  return {
    ...generator,
    drafts,
    current_members: approved ? generator.current_members + 1 : generator.current_members,
  };
}

/**
 * 主Agent审核: 修正
 */
export function modify_and_approve_member_draft(
  generator: TeamLeadMemberGenerator,
  draft_index: number,
  modifications: Partial<PersonaCard>,
  reviewer_name: string,
  comment?: string
): TeamLeadMemberGenerator {
  const drafts = [...generator.drafts];
  let approved = false;
  if (drafts[draft_index] && drafts[draft_index].status === "submitted") {
    const modified_card: PersonaCard = {
      ...drafts[draft_index].card,
      ...modifications,
    };
    drafts[draft_index] = {
      ...drafts[draft_index],
      card: modified_card,
      status: "approved",
      reviewed_at: new Date().toISOString(),
      review_comment: comment || "主Agent已修正部分字段",
      reviewed_by: reviewer_name,
    };
    approved = true;
  }
  return {
    ...generator,
    drafts,
    current_members: approved ? generator.current_members + 1 : generator.current_members,
  };
}

/**
 * 主Agent审核: 打回
 */
export function reject_member_draft(
  generator: TeamLeadMemberGenerator,
  draft_index: number,
  reviewer_name: string,
  reason: string
): TeamLeadMemberGenerator {
  const drafts = [...generator.drafts];
  if (drafts[draft_index] && drafts[draft_index].status === "submitted") {
    drafts[draft_index] = {
      ...drafts[draft_index],
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      review_comment: reason,
      reviewed_by: reviewer_name,
    };
  }
  return { ...generator, drafts };
}

/**
 * 获取已批准的成员卡列表
 */
export function get_approved_members(generator: TeamLeadMemberGenerator): PersonaCard[] {
  return generator.drafts
    .filter((d) => d.status === "approved")
    .map((d) => d.card);
}

/**
 * 检查是否已达成员上限（含待处理草稿，与 lead_generate_member_draft 定义一致）
 */
export function is_at_max_capacity(generator: TeamLeadMemberGenerator): boolean {
  const effective_count = generator.current_members + generator.drafts.filter((d) => d.status !== "rejected").length;
  return effective_count >= generator.max_members;
}

/**
 * 检查是否有待审核的草稿
 */
export function has_pending_review(generator: TeamLeadMemberGenerator): boolean {
  return generator.drafts.some((d) => d.status === "submitted");
}

// ============ 完整团队组装流程 ============

/**
 * 一站式团队组装: 构建 + 通信矩阵 + 无审批
 */
export function assemble_team(
  summary: InterviewSummary,
  lead_agent_name?: string
): TeamStructure {
  const structure = build_team_structure(summary, lead_agent_name);
  const with_communication = inject_communication_matrix(structure);
  const with_permission = inject_team_bypass_permission(with_communication);
  return with_permission;
}
