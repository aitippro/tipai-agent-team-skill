/**
 * 项目档案系统
 *
 * T-0069: 项目档案生成器
 * T-0070: 档案只读保护
 * T-0071: 档案删除
 */

import { ProjectArchive, ConflictRecord, FaultRecord, SatisfactionRecord } from "./schemas";

// ============ T-0069: 项目档案生成器 ============

export interface ArchiveInput {
  project_id: string;
  project_name: string;
  time_range: string;
  original_requirements: string;
  lead_agent: string;
  groups: { name: string; lead: string; members: string[] }[];
  stage_records: { stage_id: string; completed_at: string; outputs: string[]; satisfaction: number }[];
  conflict_records: ConflictRecord[];
  fault_records: FaultRecord[];
  satisfaction_records: SatisfactionRecord[];
  reusable_outputs: string[];
  inventory_changes: { action: "add" | "remove" | "update"; name: string }[];
  /** 归档时备注 */
  notes?: string[];
}

/**
 * 汇总生成完整项目档案
 */
export function generate_project_archive(input: ArchiveInput): ProjectArchive {
  // 计算满意度总评
  const group_avg: Record<string, number> = {};
  let total_satisfaction = 0;
  let satisfaction_count = 0;

  for (const record of input.satisfaction_records) {
    const score = record.final_scores.composite;
    if (!group_avg[record.group_name]) {
      group_avg[record.group_name] = score;
    } else {
      group_avg[record.group_name] = (group_avg[record.group_name] + score) / 2;
    }
    total_satisfaction += score;
    satisfaction_count++;
  }

  const project_avg = satisfaction_count > 0
    ? Math.round((total_satisfaction / satisfaction_count) * 100) / 100
    : 0;

  return {
    project_id: input.project_id,
    project_name: input.project_name,
    time_range: input.time_range,
    status: "completed",
    original_requirements: input.original_requirements,
    team_structure: {
      lead_agent: input.lead_agent,
      groups: input.groups,
    },
    stage_records: input.stage_records,
    conflict_records: input.conflict_records,
    fault_records: input.fault_records,
    satisfaction_summary: { group_avg, project_avg },
    reusable_outputs: input.reusable_outputs,
    inventory_changes: input.inventory_changes,
  };
}

/**
 * 生成只读档案摘要 (不含敏感细节)
 */
export function generate_archive_summary(archive: ProjectArchive): string {
  const lines: string[] = [];
  lines.push(`项目: ${archive.project_name} (${archive.project_id})`);
  lines.push(`时间: ${archive.time_range}`);
  lines.push(`状态: ${archive.status}`);
  lines.push(`团队: ${archive.team_structure.groups.length} 组, 主Agent=${archive.team_structure.lead_agent}`);
  lines.push(`阶段: ${archive.stage_records.length} 个`);
  lines.push(`冲突: ${archive.conflict_records.length} 次`);
  lines.push(`故障: ${archive.fault_records.length} 次`);
  lines.push(`满意度: 项目平均 ${archive.satisfaction_summary.project_avg}`);
  lines.push(`可复用产出: ${archive.reusable_outputs.length} 项`);
  return lines.join("\n");
}

// ============ T-0070: 档案只读保护 ============

export interface ArchiveNote {
  date: string;
  author: string;
  content: string;
}

export interface ProtectedArchive {
  archive: ProjectArchive;
  /** 归档时间 */
  frozen_at: string;
  /** 只读标记 */
  readonly: true;
  /** 追加的备注 (仅允许追加，不可删除) */
  notes: ArchiveNote[];
}

/**
 * 冻结档案 → 生成后禁止修改核心字段
 */
export function freeze_archive(archive: ProjectArchive): ProtectedArchive {
  return {
    archive: { ...archive },
    frozen_at: new Date().toISOString(),
    readonly: true,
    notes: [],
  };
}

/**
 * 追加备注 (唯一允许的写入操作)
 */
export function append_note(
  protected_archive: ProtectedArchive,
  author: string,
  content: string
): ProtectedArchive {
  const note: ArchiveNote = {
    date: new Date().toISOString(),
    author,
    content,
  };

  return {
    ...protected_archive,
    notes: [...protected_archive.notes, note],
  };
}

/**
 * 尝试修改冻结档案 → 拒绝
 */
export function attempt_modify_protected(
  protected_archive: ProtectedArchive
): { allowed: false; reason: string } {
  return {
    allowed: false,
    reason: `档案已于 ${protected_archive.frozen_at} 冻结，禁止修改。仅允许追加备注。`,
  };
}

export interface ArchiveSearchQuery {
  project_name?: string;
  tech_stack?: string;
  date_from?: string;
  date_to?: string;
  role_name?: string;
}

/**
 * 按条件检索档案
 */
export function search_archive(
  archive: ProjectArchive,
  query: ArchiveSearchQuery
): boolean {
  let match = true;

  if (query.project_name) {
    match = match && archive.project_name.includes(query.project_name);
  }

  if (query.role_name) {
    const all_members = archive.team_structure.groups.flatMap((g) =>
      [g.lead, ...g.members]
    );
    match = match && all_members.some((m) => m.includes(query.role_name!));
  }

  if (query.date_from) {
    match = match && archive.time_range >= query.date_from;
  }

  if (query.date_to) {
    match = match && archive.time_range <= query.date_to;
  }

  return match;
}

/**
 * 批量检索多个档案
 */
export function search_archives(
  archives: ProjectArchive[],
  query: ArchiveSearchQuery
): ProjectArchive[] {
  return archives.filter((a) => search_archive(a, query));
}

// ============ T-0071: 档案删除 ============

export interface DeleteRequest {
  archive: ProjectArchive;
  requested_by: string;
  confirmed: boolean;
}

export interface DeleteResult {
  success: boolean;
  message: string;
  /** 删除前备份 (客户30天内可恢复) */
  deleted_backup?: ProjectArchive;
}

/**
 * 仅客户主动要求可删除
 */
export function request_delete_archive(
  archive: ProjectArchive,
  requested_by: string
): DeleteRequest {
  return { archive, requested_by, confirmed: false };
}

/**
 * 二次确认后执行删除
 */
export function confirm_delete_archive(
  request: DeleteRequest,
  confirmed: boolean
): DeleteResult {
  if (!confirmed) {
    return { success: false, message: "需要二次确认才能删除项目档案" };
  }

  if (request.requested_by !== "客户" && request.requested_by !== "client") {
    return {
      success: false,
      message: `仅客户可删除项目档案，当前请求者: ${request.requested_by}`,
    };
  }

  return {
    success: true,
    message: `项目档案 ${request.archive.project_name}(${request.archive.project_id}) 已删除。30天内可通过备份恢复。`,
    deleted_backup: { ...request.archive },
  };
}

/**
 * 从备份恢复档案 (30天内)
 */
export function restore_from_backup(
  backup: ProjectArchive
): { restored: ProjectArchive; message: string } {
  return {
    restored: { ...backup },
    message: `项目档案 ${backup.project_name} 已从备份恢复`,
  };
}

/**
 * 检查备份是否在恢复期内
 */
export function is_backup_recoverable(
  deleted_at: string
): boolean {
  const delete_time = new Date(deleted_at).getTime();
  const now = Date.now();
  const days = (now - delete_time) / (1000 * 60 * 60 * 24);
  return days <= 30;
}
