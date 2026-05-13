/**
 * T-0005: PersonaCard 生成时验证
 *
 * 验证规则：
 * - 必填字段不得为空
 * - must_do 至少 3 条
 * - must_not_do 至少 2 条
 * - behavior_rules 默认包含"越界回复"和"不确定回复"
 * - permission_mode 默认 "bypassPermissions"
 */

import { PersonaCard, StageTaskCard, ModuleTaskCard } from "./schemas";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validate_persona_card(card: PersonaCard): ValidationResult {
  const errors: ValidationError[] = [];

  // 必填字段非空
  if (!card.name || card.name.trim().length === 0) {
    errors.push({ field: "name", message: "姓名不能为空" });
  }
  if (!card.role || card.role.trim().length === 0) {
    errors.push({ field: "role", message: "角色不能为空" });
  }
  if (!card.summary || card.summary.trim().length === 0) {
    errors.push({ field: "summary", message: "一句话概述不能为空" });
  }
  if (card.summary && card.summary.length > 20) {
    errors.push({ field: "summary", message: `概述需≤20字，当前${card.summary.length}字` });
  }

  // must_do 至少 3 条
  if (!card.must_do || card.must_do.length < 3) {
    errors.push({ field: "must_do", message: `核心能力至少3条，当前${card.must_do?.length ?? 0}条` });
  }

  // must_not_do 至少 2 条
  if (!card.must_not_do || card.must_not_do.length < 2) {
    errors.push({ field: "must_not_do", message: `能力边界至少2条，当前${card.must_not_do?.length ?? 0}条` });
  }

  // behavior_rules 含两条硬回复
  if (!card.behavior_rules) {
    errors.push({ field: "behavior_rules", message: "行为准则不能为空" });
  } else {
    const has_overflow = card.behavior_rules.some((r) => r.includes("越界") || r.includes("超出") || r.includes("职责范围"));
    const has_uncertain = card.behavior_rules.some((r) => r.includes("不确定") || r.includes("待") || r.includes("确认"));
    if (!has_overflow) {
      errors.push({ field: "behavior_rules", message: "缺少越界回复规则" });
    }
    if (!has_uncertain) {
      errors.push({ field: "behavior_rules", message: "缺少不确定回复规则" });
    }
  }

  // permission_mode 默认 bypassPermissions
  if (!card.permission_mode) {
    errors.push({ field: "permission_mode", message: "权限模式不能为空" });
  } else if (!["bypassPermissions", "default"].includes(card.permission_mode)) {
    errors.push({ field: "permission_mode", message: `权限模式非法: ${card.permission_mode}` });
  }

  // lifecycle 必须为有效值
  if (!card.lifecycle) {
    errors.push({ field: "lifecycle", message: "生命周期不能为空" });
  } else if (!["permanent", "project_destroy", "follow_project"].includes(card.lifecycle)) {
    errors.push({ field: "lifecycle", message: `生命周期值非法: ${card.lifecycle}` });
  }

  // tech_env 至少有一个字段
  if (!card.tech_env || Object.keys(card.tech_env).length === 0) {
    errors.push({ field: "tech_env", message: "技术环境至少填写一项" });
  }

  // input_sources 至少 1 个
  if (!card.input_sources || card.input_sources.length === 0) {
    errors.push({ field: "input_sources", message: "至少指定一个输入源" });
  }

  // output_targets 至少 1 个
  if (!card.output_targets || card.output_targets.length === 0) {
    errors.push({ field: "output_targets", message: "至少指定一个交付目标" });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证阶段任务卡
 */
export function validate_stage_task_card(card: StageTaskCard): ValidationResult {
  const errors: ValidationError[] = [];

  if (!card.stage_id) errors.push({ field: "stage_id", message: "阶段ID不能为空" });
  if (!card.goal) errors.push({ field: "goal", message: "目标不能为空" });
  if (!card.to) errors.push({ field: "to", message: "接收者不能为空" });
  if (!card.deadline) errors.push({ field: "deadline", message: "交付时间不能为空" });
  if (!card.acceptance_criteria || card.acceptance_criteria.length === 0) {
    errors.push({ field: "acceptance_criteria", message: "验收标准至少一条" });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证模块任务卡
 */
export function validate_module_task_card(card: ModuleTaskCard): ValidationResult {
  const errors: ValidationError[] = [];

  if (!card.module_id) errors.push({ field: "module_id", message: "模块ID不能为空" });
  if (!card.from) errors.push({ field: "from", message: "发件者不能为空" });
  if (!card.to) errors.push({ field: "to", message: "收件者不能为空" });
  if (!card.tasks || card.tasks.length === 0) {
    errors.push({ field: "tasks", message: "任务列表至少一项" });
  }
  if (!card.output_format) errors.push({ field: "output_format", message: "输出格式不能为空" });
  if (!card.deadline) errors.push({ field: "deadline", message: "交付时间不能为空" });

  return { valid: errors.length === 0, errors };
}
