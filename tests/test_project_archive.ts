/**
 * QA Test: T-0069 ~ T-0071 项目档案系统
 */
import {
  generate_project_archive, generate_archive_summary,
  ArchiveInput,
  freeze_archive, append_note, attempt_modify_protected,
  search_archive, search_archives,
  request_delete_archive, confirm_delete_archive,
  restore_from_backup, is_backup_recoverable,
} from "../src/project-archive";

import { SatisfactionRecord } from "../src/schemas";

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

function make_input(): ArchiveInput {
  const sat: SatisfactionRecord = {
    stage_id: "S-001", group_name: "前端组",
    lead_score: { quality: 4, standard: 4, collaboration: 4, bonus: 1, composite: 4.2 },
    member_details: [],
    client_modifications: [],
    final_scores: { quality: 4, standard: 4, collaboration: 4, bonus: 1, composite: 4.2 },
  };

  return {
    project_id: "P-001", project_name: "测试电商项目",
    time_range: "2026-01~2026-06",
    original_requirements: "构建电商网站",
    lead_agent: "主Agent",
    groups: [
      { name: "前端组", lead: "王五", members: ["张三", "李四"] },
      { name: "后端组", lead: "赵六", members: ["钱七"] },
    ],
    stage_records: [
      { stage_id: "S-001-前端层", completed_at: "2026-03-01", outputs: ["order-list.tsx"], satisfaction: 4.2 },
      { stage_id: "S-002-后端层", completed_at: "2026-04-01", outputs: ["order-api.ts"], satisfaction: 4.5 },
    ],
    conflict_records: [],
    fault_records: [],
    satisfaction_records: [sat],
    reusable_outputs: ["通用表单组件"],
    inventory_changes: [{ action: "add", name: "张三" }],
  };
}

// ============ T-0069: 项目档案生成器 ============
console.log("\n=== T-0069: 项目档案生成器 ===");

test("T-0069: generate_project_archive 汇总所有字段", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  return archive.project_id === "P-001" &&
    archive.project_name === "测试电商项目" &&
    archive.status === "completed" &&
    archive.team_structure.groups.length === 2 &&
    archive.team_structure.lead_agent === "主Agent" &&
    archive.stage_records.length === 2 &&
    archive.reusable_outputs.length === 1 &&
    archive.inventory_changes.length === 1;
});

test("T-0069: satisfaction_summary 正确计算 group_avg 和 project_avg", () => {
  const input = make_input();
  input.satisfaction_records = [
    { stage_id: "S-001", group_name: "前端组", lead_score: { quality:4,standard:4,collaboration:4,bonus:1,composite:4.0 }, member_details:[], client_modifications:[], final_scores:{ quality:4,standard:4,collaboration:4,bonus:1,composite:4.0 } },
  ];
  const archive = generate_project_archive(input);
  return archive.satisfaction_summary.project_avg === 4.0 &&
    archive.satisfaction_summary.group_avg["前端组"] === 4.0;
});

test("T-0069: 多阶段同组取平均", () => {
  const input = make_input();
  input.satisfaction_records = [
    { stage_id: "S-001", group_name: "前端组", lead_score: { quality:0,standard:0,collaboration:0,bonus:0,composite:4.0 }, member_details:[], client_modifications:[], final_scores:{ quality:0,standard:0,collaboration:0,bonus:0,composite:4.0 } },
    { stage_id: "S-002", group_name: "前端组", lead_score: { quality:0,standard:0,collaboration:0,bonus:0,composite:2.0 }, member_details:[], client_modifications:[], final_scores:{ quality:0,standard:0,collaboration:0,bonus:0,composite:2.0 } },
  ];
  const archive = generate_project_archive(input);
  return archive.satisfaction_summary.group_avg["前端组"] === 3.0; // (4+2)/2
});

test("T-0069: 无满意度记录时project_avg=0", () => {
  const input = make_input();
  input.satisfaction_records = [];
  const archive = generate_project_archive(input);
  return archive.satisfaction_summary.project_avg === 0;
});

test("T-0069: generate_archive_summary 包含关键信息", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  const summary = generate_archive_summary(archive);
  return summary.includes("测试电商项目") &&
    summary.includes("P-001") &&
    summary.includes("2 组") &&
    summary.includes("0 次");
});

// ============ T-0070: 档案只读保护 ============
console.log("\n=== T-0070: 档案只读保护 ===");

test("T-0070: freeze_archive 冻结档案", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  const frozen = freeze_archive(archive);
  return frozen.readonly === true &&
    frozen.frozen_at.length > 0 &&
    frozen.notes.length === 0;
});

test("T-0070: append_note 追加备注", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  let frozen = freeze_archive(archive);
  frozen = append_note(frozen, "主Agent", "项目已验收通过");
  frozen = append_note(frozen, "客户", "确认无误");
  return frozen.notes.length === 2 &&
    frozen.notes[0].author === "主Agent" &&
    frozen.notes[1].author === "客户";
});

test("T-0070: attempt_modify_protected 拒绝修改", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  const frozen = freeze_archive(archive);
  const result = attempt_modify_protected(frozen);
  return !result.allowed && result.reason.includes("冻结");
});

test("T-0070: search_archive 按项目名检索", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  return search_archive(archive, { project_name: "电商" }) === true &&
    search_archive(archive, { project_name: "不存在" }) === false;
});

test("T-0070: search_archive 按角色名检索", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  return search_archive(archive, { role_name: "张三" }) === true &&
    search_archive(archive, { role_name: "王五" }) === true &&
    search_archive(archive, { role_name: "不存在" }) === false;
});

test("T-0070: search_archive 按日期范围检索", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  return search_archive(archive, { date_from: "2026-01", date_to: "2026-12" }) === true &&
    search_archive(archive, { date_from: "2027-01" }) === false;
});

test("T-0070: search_archives 批量检索", () => {
  const input1 = make_input();
  const input2 = { ...make_input(), project_id: "P-002", project_name: "CMS项目" };
  const archives = [generate_project_archive(input1), generate_project_archive(input2)];
  const results = search_archives(archives, { project_name: "电商" });
  return results.length === 1 && results[0].project_id === "P-001";
});

// ============ T-0071: 档案删除 ============
console.log("\n=== T-0071: 档案删除 ===");

test("T-0071: request_delete_archive 创建删除请求", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  const req = request_delete_archive(archive, "客户");
  return req.confirmed === false && req.requested_by === "客户";
});

test("T-0071: confirm_delete_archive 未确认拒绝", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  const req = request_delete_archive(archive, "客户");
  const result = confirm_delete_archive(req, false);
  return !result.success && result.message.includes("二次确认");
});

test("T-0071: confirm_delete_archive 客户确认后删除", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  const req = request_delete_archive(archive, "客户");
  const result = confirm_delete_archive(req, true);
  return result.success && result.deleted_backup !== undefined &&
    result.message.includes("30天");
});

test("T-0071: confirm_delete_archive 非客户无法删除", () => {
  const input = make_input();
  const archive = generate_project_archive(input);
  const req = request_delete_archive(archive, "主Agent");
  const result = confirm_delete_archive(req, true);
  return !result.success && result.message.includes("仅客户可删除");
});

test("T-0071: restore_from_backup 从备份恢复", () => {
  const input = make_input();
  const backup = generate_project_archive(input);
  const result = restore_from_backup(backup);
  return result.restored.project_name === "测试电商项目" &&
    result.message.includes("恢复");
});

test("T-0071: is_backup_recoverable 30天内可恢复", () => {
  const recent = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
  return is_backup_recoverable(recent) === true;
});

test("T-0071: is_backup_recoverable 超过30天不可恢复", () => {
  const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  return is_backup_recoverable(old) === false;
});

// ============ 汇总 ============
console.log(`\n总计: ${pass + fail} 测试, ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
