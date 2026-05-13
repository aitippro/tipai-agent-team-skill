/**
 * 容错机制
 *
 * T-0064: 故障分类器
 * T-0065: 成员级别故障处理
 * T-0066: 组长级别故障处理
 * T-0067: 自动恢复
 * T-0068: 故障记录
 */

import { FaultRecord, FaultLevel, PersonaCard, ProjectArchive, StructuredArchive, StageTaskCard, RoleInventory } from "./schemas";
import { ReviewResult } from "./code-reviewer";
import { ContextSnapshot, restore_from_snapshot } from "./context-control";
import { SearchQuery, search_and_match } from "./role-inventory";

// ============ T-0064: 故障分类器 ============

export interface FaultEvent {
  role_name: string;
  role_type: "member" | "team_lead" | "lead_agent";
  description: string;
  context?: string;
  review_reports?: ReviewResult[];
  /** 连续失败次数 */
  consecutive_failures: number;
  /** 是否涉及死锁 */
  is_deadlock?: boolean;
  /** 是否协商超时 */
  negotiation_timeout?: boolean;
}

/**
 * 4 级故障分类规则引擎:
 * - self_heal: 单次/偶发，可自行修复
 * - need_intervention: 连续2次失败，需组长/主Agent介入
 * - need_replace: 连续3次失败，需替换角色
 * - need_pause: 死锁/系统级故障，需暂停项目
 */
export function classify_fault(event: FaultEvent): {
  level: FaultLevel;
  suggestion: string;
  fault_pattern: string;
} {
  // 死锁检测 → need_pause
  if (event.is_deadlock) {
    return {
      level: "need_pause",
      suggestion: "检测到死锁，需暂停相关任务并强制定序",
      fault_pattern: "死锁: 多角色循环等待",
    };
  }

  // 协商超时 → need_intervention
  if (event.negotiation_timeout) {
    return {
      level: "need_intervention",
      suggestion: "组长间协商超时，主Agent直接仲裁",
      fault_pattern: "协商超时: 组长间无法达成一致",
    };
  }

  // 连续3次+ → need_replace
  if (event.consecutive_failures >= 3) {
    return {
      level: "need_replace",
      suggestion: `连续 ${event.consecutive_failures} 次失败，建议从库存检索替换角色`,
      fault_pattern: "连续失败: 角色无法胜任当前任务",
    };
  }

  // 连续2次 → need_intervention
  if (event.consecutive_failures >= 2) {
    const intervenor = event.role_type === "team_lead" ? "主Agent" : "组长";
    return {
      level: "need_intervention",
      suggestion: `连续 ${event.consecutive_failures} 次失败，${intervenor}需介入`,
      fault_pattern: "重复失败: 需外部介入",
    };
  }

  // 单次 → self_heal
  return {
    level: "self_heal",
    suggestion: "单次故障，给出修改意见后可自行修复",
    fault_pattern: "偶发故障: 短期可自行修复",
  };
}

// ============ T-0065: 成员级别故障处理 ============

export interface MemberFaultState {
  member_name: string;
  group_name: string;
  rejection_count: number;
  last_rejection_reason?: string;
  last_fix_deadline?: string;
  rejected_reports: ReviewResult[];
  status: "active" | "warned" | "escalated" | "replaced";
}

export interface RejectAction {
  member_name: string;
  reject_reason: string;
  fix_suggestions: string[];
  deadline_hours: number;
}

/**
 * 单次打回 → 组长给修改意见 + 重做时限
 */
export function handle_single_reject(
  state: MemberFaultState,
  action: RejectAction
): { state: MemberFaultState; message: string } {
  const deadline = new Date(Date.now() + action.deadline_hours * 3600 * 1000).toISOString();

  const updated: MemberFaultState = {
    ...state,
    rejection_count: state.rejection_count + 1,
    last_rejection_reason: action.reject_reason,
    last_fix_deadline: deadline,
    status: "warned",
  };

  return {
    state: updated,
    message: `成员 ${action.member_name} 代码被打回: ${action.reject_reason}。` +
      `修改建议: ${action.fix_suggestions.join(", ")}。` +
      `重做时限: ${deadline}`,
  };
}

/**
 * 连续2次 → 升级主Agent + 附带审查记录
 */
export function escalate_to_lead_agent(
  state: MemberFaultState
): { state: MemberFaultState; escalation_report: string } {
  const updated: MemberFaultState = {
    ...state,
    status: "escalated",
  };

  const report = `[升级] 成员 ${state.member_name}(${state.group_name}) ` +
    `连续 ${state.rejection_count} 次被打回。` +
    `最近审查记录: ${state.rejected_reports.map((r) => r.summary).join(" | ")}`;

  return { state: updated, escalation_report: report };
}

/**
 * 连续3次 → 主Agent判定替换
 */
export function decide_member_replacement(
  state: MemberFaultState,
  inventory?: RoleInventory,
  replacement_query?: SearchQuery
): {
  state: MemberFaultState;
  decision: "replace_from_inventory" | "regenerate" | "keep";
  replacement_card?: PersonaCard;
  reason: string;
} {
  if (state.rejection_count < 3) {
    return { state, decision: "keep", reason: "不足3次，暂不替换" };
  }

  // 尝试从库存检索
  if (inventory && replacement_query) {
    const matches = search_and_match(inventory, replacement_query, 1);
    if (matches.length > 0) {
      return {
        state: { ...state, status: "replaced" },
        decision: "replace_from_inventory",
        replacement_card: matches[0].entry.persona_card.original,
        reason: `从库存检索到匹配角色: ${matches[0].entry.persona_card.original.name}`,
      };
    }
  }

  return {
    state: { ...state, status: "replaced" },
    decision: "regenerate",
    reason: "库存无匹配，需重新生成角色",
  };
}

/**
 * 旧卡标记失败原因入库
 */
export function mark_failed_card(
  card: PersonaCard,
  state: MemberFaultState
): PersonaCard {
  return {
    ...card,
    lifecycle: "project_destroy",
    behavior_rules: [
      ...card.behavior_rules,
      `[故障记录] 连续${state.rejection_count}次被打回: ${state.last_rejection_reason || "未知原因"}`,
    ],
  };
}

// ============ T-0066: 组长级别故障处理 ============

export interface LeadFaultState {
  lead_name: string;
  group_name: string;
  audit_miss_count: number;
  last_miss_detail?: string;
  negotiation_timeouts: number;
  warnings: string[];
  status: "active" | "warned" | "replaced";
}

/**
 * 审核漏判 → 主Agent抽查发现 → 警告 + 记录
 */
export function warn_lead_audit_miss(
  state: LeadFaultState,
  detail: string
): { state: LeadFaultState; warning: string } {
  const warning = `[警告] 组长 ${state.lead_name}(${state.group_name}) 审核漏判: ${detail}`;

  return {
    state: {
      ...state,
      audit_miss_count: state.audit_miss_count + 1,
      last_miss_detail: detail,
      warnings: [...state.warnings, warning],
      status: (state.audit_miss_count + 1) >= 2 ? "warned" : state.status,
    },
    warning,
  };
}

/**
 * 连续漏判 → 替换组长
 */
export function decide_lead_replacement(
  state: LeadFaultState,
  audit_miss_threshold: number = 3
): {
  state: LeadFaultState;
  should_replace: boolean;
  reason: string;
} {
  if (state.audit_miss_count >= audit_miss_threshold) {
    return {
      state: { ...state, status: "replaced" },
      should_replace: true,
      reason: `组长 ${state.lead_name} 连续 ${state.audit_miss_count} 次审核漏判，建议替换`,
    };
  }

  return {
    state,
    should_replace: false,
    reason: "未达替换阈值",
  };
}

/**
 * 协商僵持超时 → 主Agent直接仲裁
 */
export function forced_arbitration_for_timeout(
  state: LeadFaultState,
  conflict_id: string
): {
  state: LeadFaultState;
  arbitration_decision: string;
} {
  return {
    state: {
      ...state,
      negotiation_timeouts: state.negotiation_timeouts + 1,
    },
    arbitration_decision: `[强制仲裁] 冲突 ${conflict_id}: 组长 ${state.lead_name} 协商超时，主Agent直接裁决`,
  };
}

// ============ T-0067: 自动恢复 ============

export interface MemberRecoveryContext {
  completed_task_ids: string[];
  accepted_outputs: string[];
  current_task?: string;
}

export interface LeadRecoveryContext {
  group_archive: StructuredArchive[];
  current_stage_card: StageTaskCard;
  group_name: string;
}

/**
 * 成员替换 → 继承已完成任务上下文，不重做已验收
 */
export function recover_member_context(
  old_member_name: string,
  new_card: PersonaCard,
  completed: MemberRecoveryContext
): {
  new_card: PersonaCard;
  recovery_note: string;
} {
  const tasks_list = completed.completed_task_ids.join(", ");
  const outputs_list = completed.accepted_outputs.join(", ");

  const updated_card: PersonaCard = {
    ...new_card,
    behavior_rules: [
      ...new_card.behavior_rules,
      `[恢复] 继承自 ${old_member_name}，已完成任务: ${tasks_list || "无"}`,
      `[恢复] 已验收产出: ${outputs_list || "无"} — 不重做`,
    ],
  };

  return {
    new_card: updated_card,
    recovery_note: `${new_card.name} 替换 ${old_member_name}，已继承上下文`,
  };
}

/**
 * 组长替换 → 继承组内档案 + 当前阶段卡
 */
export function recover_lead_context(
  old_lead_name: string,
  new_lead_name: string,
  recovery: LeadRecoveryContext
): {
  recovery_note: string;
  inherited: LeadRecoveryContext;
} {
  return {
    recovery_note: `${new_lead_name} 替换 ${old_lead_name}，继承组 "${recovery.group_name}" 的档案(${recovery.group_archive.length}条)+阶段卡(${recovery.current_stage_card.stage_id})`,
    inherited: recovery,
  };
}

/**
 * 上下文丢失 → 从快照恢复
 */
export function recover_from_snapshot(
  role_name: string,
  snapshots: ContextSnapshot[]
): {
  recovered: boolean;
  snapshot?: ContextSnapshot;
  message: string;
} {
  const result = restore_from_snapshot(role_name, snapshots);

  if (!result.snapshot) {
    return {
      recovered: false,
      message: `无法恢复 ${role_name}: 无有效快照（24h内）`,
    };
  }

  return {
    recovered: true,
    snapshot: result.snapshot,
    message: `${role_name} 从快照恢复 (seq=${result.snapshot.sequence})`,
  };
}

export interface DeadlockGroup {
  members: string[];
  waiting_on: string[];
}

/**
 * 死锁检测 → 强制定序
 */
export function detect_deadlock(
  wait_graph: Record<string, string[]> // role → waiting_on_roles
): { has_deadlock: boolean; cycle: string[]; fix_order: string[] } {
  const visited = new Set<string>();
  const in_stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): string[] | null {
    visited.add(node);
    in_stack.add(node);
    path.push(node);

    for (const next of (wait_graph[node] || [])) {
      if (!visited.has(next)) {
        const result = dfs(next);
        if (result) return result;
      } else if (in_stack.has(next)) {
        // 找到环
        const cycle_start = path.indexOf(next);
        return path.slice(cycle_start);
      }
    }

    path.pop();
    in_stack.delete(node);
    return null;
  }

  for (const node of Object.keys(wait_graph)) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) {
        // 强制定序: 字典序最小的先执行
        const fix_order = [...cycle].sort();
        return { has_deadlock: true, cycle, fix_order };
      }
    }
  }

  return { has_deadlock: false, cycle: [], fix_order: [] };
}

/**
 * 产出冲突 → 败方废弃冲突部分，从仲裁点继续
 */
export function resolve_output_conflict(
  winner_name: string,
  loser_name: string,
  conflict_description: string,
  loser_card: PersonaCard
): {
  updated_loser_card: PersonaCard;
  resolution_note: string;
} {
  return {
    updated_loser_card: {
      ...loser_card,
      behavior_rules: [
        ...loser_card.behavior_rules,
        `[冲突裁决] 在冲突 "${conflict_description}" 中败于 ${winner_name}，废弃冲突部分`,
      ],
    },
    resolution_note: `${loser_name} 废弃与 ${winner_name} 的冲突产出，从仲裁点继续`,
  };
}

// ============ T-0068: 故障记录 ============

export interface FaultRecordInput {
  role_name: string;
  role_type: "member" | "team_lead" | "lead_agent";
  fault_description: string;
  fault_level: FaultLevel;
  fault_pattern: string;
  suggestion: string;
}

/**
 * 创建故障档案
 */
export function create_fault_record(input: FaultRecordInput, existing: FaultRecord[]): FaultRecord {
  const existing_for_role = existing.filter((f) => f.role_name === input.role_name);

  const fault: FaultRecord = {
    fault_id: `F-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role_name: input.role_name,
    fault_count: existing_for_role.length + 1,
    latest_fault: {
      date: new Date().toISOString(),
      description: input.fault_description,
    },
    fault_pattern: input.fault_pattern,
    suggestion: input.suggestion,
    level: input.fault_level,
  };

  return fault;
}

/**
 * 写入项目档案
 */
export function write_fault_to_archive(
  fault: FaultRecord,
  archive: ProjectArchive
): ProjectArchive {
  return {
    ...archive,
    fault_records: [...archive.fault_records, fault],
  };
}

/**
 * 获取指定角色的故障历史
 */
export function get_role_fault_history(
  role_name: string,
  archive: ProjectArchive
): FaultRecord[] {
  return archive.fault_records.filter((f) => f.role_name === role_name);
}

/**
 * 检查角色是否达到替换阈值
 */
export function check_replacement_threshold(
  role_name: string,
  archive: ProjectArchive,
  threshold: number = 3
): boolean {
  const faults = get_role_fault_history(role_name, archive);
  const severe_faults = faults.filter(
    (f) => f.level === "need_replace" || f.level === "need_pause"
  );
  return severe_faults.length >= threshold;
}
