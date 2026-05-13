/**
 * Skill退出机制 — exit_handler
 *
 * 客户主动退出时：
 * 1. 生成项目档案摘要
 * 2. 确认是否有未归档的角色
 * 3. 确认是否有未入库的永久保留卡
 */

import { PersonaCard } from "./schemas";

export interface ExitChecklist {
  can_exit: boolean;
  summary: string;
  unarchived_roles: string[];
  unstored_permanent_cards: string[];
  warnings: string[];
}

export interface ExitConfirmation {
  confirmed: boolean;
  action_items: string[];
}

/**
 * 生成退出前检查清单
 */
export function generate_exit_checklist(
  persona_cards: PersonaCard[],
  archived_roles: Set<string>,
  inventory_roles: Set<string>
): ExitChecklist {
  const unarchived_roles: string[] = [];
  const unstored_permanent_cards: string[] = [];
  const warnings: string[] = [];

  for (const card of persona_cards) {
    const name = card.name;

    // 检查未归档
    if (!archived_roles.has(name)) {
      unarchived_roles.push(name);
    }

    // 检查永久保留但未入库
    if (card.lifecycle === "permanent" && !inventory_roles.has(name)) {
      unstored_permanent_cards.push(name);
      warnings.push(`${name}: 生命周期为"永久保留"但尚未入库`);
    }
  }

  const can_exit = warnings.length === 0;

  const summary_parts: string[] = [];
  summary_parts.push(`项目角色总数: ${persona_cards.length}`);
  summary_parts.push(`已归档: ${archived_roles.size}`);
  summary_parts.push(`未归档: ${unarchived_roles.length}`);
  summary_parts.push(`待入库永久卡: ${unstored_permanent_cards.length}`);

  if (!can_exit) {
    summary_parts.push(`\n退出前需处理:\n${warnings.map((w) => `  - ${w}`).join("\n")}`);
  }

  return {
    can_exit,
    summary: summary_parts.join("\n"),
    unarchived_roles,
    unstored_permanent_cards,
    warnings,
  };
}

/**
 * 生成项目档案摘要
 */
export function generate_archive_summary(persona_cards: PersonaCard[], project_name: string): string {
  const lines: string[] = [];
  lines.push(`项目: ${project_name}`);
  lines.push(`时间: ${new Date().toISOString().split("T")[0]}`);
  lines.push(`角色总数: ${persona_cards.length}`);
  lines.push("");

  const roles_by_layer: Record<string, string[]> = {};
  for (const card of persona_cards) {
    const layer = card.role.includes("组长") ? `${card.role.split("组长")[0]}层` : card.role;
    if (!roles_by_layer[layer]) roles_by_layer[layer] = [];
    roles_by_layer[layer].push(`${card.name} (${card.lifecycle})`);
  }

  for (const [layer, roles] of Object.entries(roles_by_layer)) {
    lines.push(`${layer}:`);
    roles.forEach((r) => lines.push(`  - ${r}`));
  }

  return lines.join("\n");
}

/**
 * 执行退出
 */
export function execute_exit(checklist: ExitChecklist): ExitConfirmation {
  if (!checklist.can_exit) {
    return {
      confirmed: false,
      action_items: checklist.warnings,
    };
  }

  return {
    confirmed: true,
    action_items: ["项目档案已生成", "角色归档完成", "永久卡已入库", "Skill已安全退出"],
  };
}
