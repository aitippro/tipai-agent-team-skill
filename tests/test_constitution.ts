/**
 * QA Test: T-0002 宪章强制检测器
 */
import { check_constitution, is_halt_required, AgentAction } from "../src/constitution";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function test(name: string, fn: () => boolean) {
  try {
    if (fn()) {
      pass++;
      console.log(`PASS: ${name}`);
    } else {
      fail++;
      const msg = `FAIL: ${name}`;
      console.error(msg);
      failures.push(msg);
    }
  } catch (e) {
    fail++;
    const msg = `FAIL: ${name} — ${e}`;
    console.error(msg);
    failures.push(msg);
  }
}

// === Article 0: Skill即容器 ===
test("跳过采访 → violation + halt", () => {
  const r = check_constitution({ role: "lead", action: "skip_interview" });
  return !r.pass && r.results[0].halt === true && r.results[0].reason.includes("第〇条");
});

test("绕过人物卡 → violation + halt", () => {
  const r = check_constitution({ role: "lead", action: "skip_persona_card" });
  return !r.pass && r.results[0].halt === true;
});

test("正常操作 → pass", () => {
  const r = check_constitution({ role: "lead", action: "start_interview" });
  return r.pass;
});

// === Article 1: 不可越级 ===
test("成员直接联系主Agent → violation + halt", () => {
  const r = check_constitution({ role: "member", action: "member_to_lead_direct" });
  return !r.pass && r.results[1].halt === true;
});

test("成员跨组通信 → violation + halt", () => {
  const r = check_constitution({ role: "member", action: "member_cross_group" });
  return !r.pass && r.results[1].halt === true;
});

test("主Agent直接给成员派活 → violation + halt", () => {
  const r = check_constitution({ role: "lead", action: "lead_to_member_direct" });
  return !r.pass && r.results[1].halt === true;
});

// === Article 2: 交付做实 ===
test("假实现 → violation (no halt)", () => {
  const r = check_constitution({ role: "member", action: "fake_implementation" });
  return !r.pass && r.results[2].halt === false;
});

test("空实现 → violation (no halt)", () => {
  const r = check_constitution({ role: "member", action: "empty_implementation" });
  return !r.pass && r.results[2].halt === false;
});

test("组长失职 → violation (no halt)", () => {
  const r = check_constitution({ role: "team_lead", action: "team_lead_negligence" });
  return !r.pass && r.results[2].halt === false;
});

// === Article 3: 冲突不沉默 ===
test("隐瞒冲突 → violation", () => {
  const r = check_constitution({ role: "team_lead", action: "suppress_conflict" });
  return !r.pass && r.results[3].reason.includes("第三条");
});

test("协商超时未上报 → violation", () => {
  const r = check_constitution({ role: "team_lead", action: "negotiation_timeout_not_escalated" });
  return !r.pass;
});

// === Article 4: 上下文最小化 ===
test("泄露需求原文 → violation", () => {
  const r = check_constitution({ role: "team_lead", action: "leak_original_requirement" });
  return !r.pass && r.results[4].reason.includes("第四条");
});

test("泄露成员评价 → violation", () => {
  const r = check_constitution({ role: "team_lead", action: "leak_member_evaluation" });
  return !r.pass && r.results[4].reason.includes("第四条");
});

// === Article 5: 偏好遵从 ===
test("预设满意度分数 → violation", () => {
  const r = check_constitution({ role: "lead", action: "preset_satisfaction_score" });
  return !r.pass && r.results[5].reason.includes("第五条");
});

// === Article 6: 可追溯 ===
test("决策未记录 → violation", () => {
  const r = check_constitution({ role: "lead", action: "unrecorded_decision" });
  return !r.pass && r.results[6].reason.includes("第六条");
});

test("试图修改档案 → violation", () => {
  const r = check_constitution({ role: "member", action: "modify_archive" });
  return !r.pass;
});

// === Article 7: 客户最终裁定 ===
test("破例未记录 → violation", () => {
  const r = check_constitution({ role: "lead", action: "override_without_record" });
  return !r.pass && r.results[7].reason.includes("第七条");
});

// === 边界条件 ===
test("空 action → pass", () => {
  const r = check_constitution({ role: "lead", action: "" });
  return r.pass;
});

test("未知 action → pass (不误报)", () => {
  const r = check_constitution({ role: "member", action: "unknown_test_action" });
  return r.pass;
});

test("is_halt_required with halt violation → true", () => {
  const r = check_constitution({ role: "lead", action: "skip_interview" });
  return is_halt_required(r) === true;
});

test("is_halt_required with non-halt violation → false", () => {
  const r = check_constitution({ role: "member", action: "fake_implementation" });
  return is_halt_required(r) === false;
});

test("8条宪章全部覆盖", () => {
  const articles = new Set<number>();
  // 触发每条规则的violation以确保覆盖
  const actions: AgentAction[] = [
    { role: "lead", action: "skip_interview" },        // 第0条
    { role: "member", action: "member_to_lead_direct" }, // 第1条
    { role: "member", action: "fake_implementation" },   // 第2条
    { role: "team_lead", action: "suppress_conflict" },  // 第3条
    { role: "team_lead", action: "leak_original_requirement" }, // 第4条
    { role: "lead", action: "preset_satisfaction_score" }, // 第5条
    { role: "lead", action: "unrecorded_decision" },     // 第6条
    { role: "lead", action: "override_without_record" }, // 第7条
  ];
  for (const a of actions) {
    const r = check_constitution(a);
    for (const rr of r.results) {
      if (!rr.pass) articles.add(rr.article);
    }
  }
  return articles.size === 8;
});

// === Summary ===
console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
if (fail > 0) {
  console.error("失败项:");
  failures.forEach((f) => console.error(`  ${f}`));
}
console.log(fail === 0 ? "QA: PASS" : "QA: FAIL");
process.exit(fail > 0 ? 1 : 0);
