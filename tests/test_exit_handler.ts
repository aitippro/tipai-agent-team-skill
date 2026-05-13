/**
 * QA Test: T-0003 Skill退出机制
 */
import { generate_exit_checklist, generate_archive_summary, execute_exit } from "../src/exit-handler";
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

// Test data
const cards: PersonaCard[] = [
  {
    name: "林一舟", role: "后端组长", summary: "后端技术把关",
    must_do: ["审查代码"], must_not_do: ["写细节代码"],
    tech_env: { language: "Go" },
    input_sources: [{ from: "主Agent", format: "阶段任务卡" }],
    output_targets: [{ to: "后端成员", format: "模块任务卡" }],
    behavior_rules: ["越界回复"], permission_mode: "bypassPermissions",
    lifecycle: "permanent",
  },
  {
    name: "张思远", role: "后端成员", summary: "支付模块",
    must_do: ["支付API"], must_not_do: ["碰数据库"],
    tech_env: { language: "Go" },
    input_sources: [{ from: "后端组长", format: "模块任务卡" }],
    output_targets: [{ to: "后端组长", format: "代码" }],
    behavior_rules: ["越界回复"], permission_mode: "bypassPermissions",
    lifecycle: "project_destroy",
  },
];

// === All archived & in inventory → clean exit ===
test("全部归档+入库 → can_exit=true", () => {
  const archived = new Set(["林一舟", "张思远"]);
  const inventory = new Set(["林一舟"]);
  const result = generate_exit_checklist(cards, archived, inventory);
  return result.can_exit === true && result.warnings.length === 0;
});

// === Permanent card not in inventory → warning ===
test("永久保留卡未入库 → can_exit=false + warning", () => {
  const archived = new Set(["林一舟", "张思远"]);
  const inventory = new Set<string>(); // 林一舟 permanent but not in inventory
  const result = generate_exit_checklist(cards, archived, inventory);
  return result.can_exit === false
    && result.unstored_permanent_cards.includes("林一舟")
    && result.warnings.some((w) => w.includes("林一舟") && w.includes("尚未入库"));
});

// === Unarchived roles ===
test("未归档角色 → detected", () => {
  const archived = new Set<string>();
  const inventory = new Set<string>();
  const result = generate_exit_checklist(cards, archived, inventory);
  return result.unarchived_roles.length === 2
    && result.unarchived_roles.includes("林一舟")
    && result.unarchived_roles.includes("张思远");
});

// === Archive summary ===
test("档案摘要 → 包含项目名和角色", () => {
  const summary = generate_archive_summary(cards, "电商系统");
  return summary.includes("电商系统")
    && summary.includes("林一舟")
    && summary.includes("张思远")
    && summary.includes("permanent")
    && summary.includes("project_destroy");
});

// === Execute exit: not clean → refused ===
test("执行退出: 有警告 → confirmed=false", () => {
  const archived = new Set(["林一舟"]);
  const inventory = new Set<string>();
  const checklist = generate_exit_checklist(cards, archived, inventory);
  const result = execute_exit(checklist);
  return result.confirmed === false && result.action_items.length > 0;
});

// === Execute exit: clean → confirmed ===
test("执行退出: 无警告 → confirmed=true", () => {
  const archived = new Set(["林一舟", "张思远"]);
  const inventory = new Set(["林一舟"]);
  const checklist = generate_exit_checklist(cards, archived, inventory);
  const result = execute_exit(checklist);
  return result.confirmed === true
    && result.action_items.some((a) => a.includes("已安全退出"));
});

// === Edge: empty cards ===
test("边界: 空角色列表 → can_exit=true", () => {
  const result = generate_exit_checklist([], new Set(), new Set());
  return result.can_exit === true && result.summary.includes("0");
});

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
console.log(fail === 0 ? "QA: PASS" : "QA: FAIL");
process.exit(fail > 0 ? 1 : 0);
