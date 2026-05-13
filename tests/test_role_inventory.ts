/**
 * QA Test: T-0058 ~ T-0063 角色库存系统
 */
import {
  write_to_inventory, InventoryWriteInput,
  rebuild_index,
  search_by_tech, search_by_score, search_by_scenario,
  search_and_match, SearchQuery, MatchResult,
  update_inventory,
  track_selection, apply_dormant_rule, sort_with_dormant_last,
  reactivate_entry, SelectionTracker,
  delete_from_inventory, confirm_deletion,
} from "../src/role-inventory";

import { PersonaCard, RoleInventory, SkillEvolution } from "../src/schemas";

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

function empty_inventory(): RoleInventory {
  return { entries: [], index: { entries: [] } };
}

function make_card(name: string, role: string, lang: string = "TypeScript", framework?: string): PersonaCard {
  return {
    name, role, summary: "测试",
    must_do: ["实现功能", "编写测试", "代码审查"],
    must_not_do: ["越界"],
    tech_env: {
      language: lang,
      framework: framework || "React",
      tools: ["Git"],
    },
    input_sources: [], output_targets: [],
    behavior_rules: ["规则1"],
    permission_mode: "bypassPermissions",
    lifecycle: "project_destroy",
  };
}

const test_evolution: SkillEvolution = {
  start: "React入门",
  mid: "React熟练",
  end: "React专家",
};

// ============ T-0058: 库存写入 ============
console.log("\n=== T-0058: 库存写入 ===");

test("T-0058: write_to_inventory 写入基础条目", () => {
  const inv = empty_inventory();
  const input: InventoryWriteInput = {
    card: make_card("张三", "前端工程师"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.5 }],
    suitable_scenarios: ["电商前端", "中后台管理"],
    unsuitable_scenarios: ["游戏引擎", "底层驱动"],
  };
  const result = write_to_inventory(input, inv);
  return result.entries.length === 1 &&
    result.entries[0].persona_card.original.name === "张三" &&
    result.entries[0].avg_score === 4.5 &&
    result.entries[0].suitable_scenarios.length === 2 &&
    result.entries[0].unsuitable_scenarios.length === 2 &&
    result.entries[0].status === "active";
});

test("T-0058: 冻结卡含 frozen_at 时间戳", () => {
  const inv = empty_inventory();
  const input: InventoryWriteInput = {
    card: make_card("张三", "前端工程师"),
    skill_evolution: test_evolution,
    history_scores: [],
    suitable_scenarios: ["前端"],
    unsuitable_scenarios: [],
  };
  const result = write_to_inventory(input, inv);
  return result.entries[0].persona_card.frozen_at.length > 0 &&
    result.entries[0].persona_card.tech_tags.length > 0;
});

test("T-0058: tech_tags 提取语言+框架+工具", () => {
  const inv = empty_inventory();
  const input: InventoryWriteInput = {
    card: make_card("张三", "前端工程师", "TypeScript", "React"),
    skill_evolution: test_evolution,
    history_scores: [],
    suitable_scenarios: [],
    unsuitable_scenarios: [],
  };
  const result = write_to_inventory(input, inv);
  const tags = result.entries[0].persona_card.tech_tags;
  return tags.includes("TypeScript") && tags.includes("React") && tags.includes("Git");
});

test("T-0058: avg_score 正确计算多项目", () => {
  const inv = empty_inventory();
  const input: InventoryWriteInput = {
    card: make_card("张三", "前端工程师"),
    skill_evolution: test_evolution,
    history_scores: [
      { project: "P1", score: 4.0 },
      { project: "P2", score: 3.0 },
      { project: "P3", score: 2.0 },
    ],
    suitable_scenarios: [],
    unsuitable_scenarios: [],
  };
  const result = write_to_inventory(input, inv);
  return result.entries[0].avg_score === 3.0;
});

test("T-0058: avg_score 空数组=0", () => {
  const inv = empty_inventory();
  const input: InventoryWriteInput = {
    card: make_card("张三", "前端工程师"),
    skill_evolution: test_evolution,
    history_scores: [],
    suitable_scenarios: [],
    unsuitable_scenarios: [],
  };
  const result = write_to_inventory(input, inv);
  return result.entries[0].avg_score === 0;
});

test("T-0058: 库存追加不覆盖已有", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端工程师"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.0 }],
    suitable_scenarios: ["前端"],
    unsuitable_scenarios: [],
  }, inv);
  inv = write_to_inventory({
    card: make_card("李四", "后端工程师"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.5 }],
    suitable_scenarios: ["后端"],
    unsuitable_scenarios: [],
  }, inv);
  return inv.entries.length === 2;
});

// ============ T-0059: 库存索引 ============
console.log("\n=== T-0059: 库存索引 ===");

test("T-0059: rebuild_index 生成索引条目", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端工程师"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.5 }],
    suitable_scenarios: ["电商"],
    unsuitable_scenarios: [],
  }, inv);
  const index = rebuild_index(inv.entries);
  return index.entries.length === 1 &&
    index.entries[0].name === "张三" &&
    index.entries[0].avg_score === 4.5;
});

test("T-0059: search_by_tech 技术栈检索", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端工程师", "TypeScript"),
    skill_evolution: test_evolution, history_scores: [], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);
  inv = write_to_inventory({
    card: make_card("李四", "后端工程师", "Python"),
    skill_evolution: test_evolution, history_scores: [], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);
  const index = rebuild_index(inv.entries);
  const result = search_by_tech(index, "Python");
  return result.length === 1 && result[0].name === "李四";
});

test("T-0059: search_by_tech 模糊匹配", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端工程师", "TypeScript"),
    skill_evolution: test_evolution, history_scores: [], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);
  const index = rebuild_index(inv.entries);
  return search_by_tech(index, "typescript").length === 1 &&
    search_by_tech(index, "type").length === 1;
});

test("T-0059: search_by_score 范围检索", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端"), skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.5 }], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);
  inv = write_to_inventory({
    card: make_card("李四", "后端"), skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 2.5 }], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);
  const index = rebuild_index(inv.entries);
  return search_by_score(index, 4.0).length === 1 &&
    search_by_score(index, 0, 3.0).length === 1 &&
    search_by_score(index, 1.0, 5.0).length === 2;
});

test("T-0059: search_by_scenario 场景检索", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端"), skill_evolution: test_evolution,
    history_scores: [], suitable_scenarios: ["电商前端", "中后台"], unsuitable_scenarios: [],
  }, inv);
  const index = rebuild_index(inv.entries);
  const result = search_by_scenario(index, "电商");
  return result.length === 1;
});

// ============ T-0060: 库存检索匹配 ============
console.log("\n=== T-0060: 库存检索匹配 ===");

test("T-0060: search_and_match 技术栈+场景加权排序", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端工程师", "TypeScript", "React"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.0 }],
    suitable_scenarios: ["电商前端"],
    unsuitable_scenarios: [],
  }, inv);
  inv = write_to_inventory({
    card: make_card("李四", "后端工程师", "Python", "Django"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.5 }],
    suitable_scenarios: ["后端API"],
    unsuitable_scenarios: [],
  }, inv);
  const query: SearchQuery = {
    tech_stack: ["TypeScript", "React"],
    module_features: ["电商"],
  };
  const results = search_and_match(inv, query);
  return results.length >= 1 && results[0].entry.persona_card.original.name === "张三";
});

test("T-0060: 过滤 <3.0 分条目", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("低分卡", "前端工程师", "TypeScript"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 2.0 }],
    suitable_scenarios: ["前端"],
    unsuitable_scenarios: [],
  }, inv);
  const query: SearchQuery = {
    tech_stack: ["TypeScript"],
    module_features: ["前端"],
  };
  const results = search_and_match(inv, query);
  return results.length === 0;
});

test("T-0060: 过滤不适合场景", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("王五", "游戏引擎工程师", "C++"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.8 }],
    suitable_scenarios: ["游戏引擎"],
    unsuitable_scenarios: ["电商", "中后台"],
  }, inv);
  const query: SearchQuery = {
    tech_stack: ["C++"],
    module_features: ["游戏"],
    target_scenarios: ["电商"],
  };
  const results = search_and_match(inv, query);
  return results.length === 0;
});

test("T-0060: 过滤休眠卡", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("休眠卡", "前端", "TypeScript"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.0 }],
    suitable_scenarios: ["前端"],
    unsuitable_scenarios: [],
  }, inv);
  // 手动设为休眠
  inv.entries[0].status = "dormant";
  const query: SearchQuery = {
    tech_stack: ["TypeScript"],
    module_features: ["前端"],
  };
  const results = search_and_match(inv, query);
  return results.length === 0;
});

test("T-0060: 返回 Top N 限制", () => {
  let inv = empty_inventory();
  for (let i = 0; i < 5; i++) {
    inv = write_to_inventory({
      card: make_card(`人员${i}`, "前端工程师", "TypeScript"),
      skill_evolution: test_evolution,
      history_scores: [{ project: "P1", score: 4.0 }],
      suitable_scenarios: ["电商前端"],
      unsuitable_scenarios: [],
    }, inv);
  }
  const query: SearchQuery = {
    tech_stack: ["TypeScript"],
    module_features: ["电商"],
  };
  const results = search_and_match(inv, query, 3);
  return results.length === 3 && results[0].rank === 1 && results[2].rank === 3;
});

test("T-0060: 结果含推荐理由", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端工程师", "TypeScript", "React"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.5 }],
    suitable_scenarios: ["电商前端"],
    unsuitable_scenarios: [],
  }, inv);
  const query: SearchQuery = {
    tech_stack: ["TypeScript"],
    module_features: ["电商"],
  };
  const results = search_and_match(inv, query);
  return results.length > 0 && results[0].reasons.length > 0;
});

test("T-0060: 场景匹配度权重高于评分", () => {
  let inv = empty_inventory();
  // A: 场景完美匹配但评分低
  inv = write_to_inventory({
    card: make_card("A", "前端"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 3.0 }],
    suitable_scenarios: ["电商前端", "中后台管理", "移动端H5"],
    unsuitable_scenarios: [],
  }, inv);
  // B: 场景不匹配但评分高
  inv = write_to_inventory({
    card: make_card("B", "后端"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 5.0 }],
    suitable_scenarios: ["后端API"],
    unsuitable_scenarios: [],
  }, inv);
  const query: SearchQuery = {
    tech_stack: [],
    module_features: ["电商"],
  };
  const results = search_and_match(inv, query);
  // A 场景匹配应排在前
  return results.length >= 1 && results[0].entry.persona_card.original.name === "A";
});

// ============ T-0061: 库存更新 ============
console.log("\n=== T-0061: 库存更新 ===");

test("T-0061: update_inventory 同名覆盖", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端工程师"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.0 }],
    suitable_scenarios: ["前端"],
    unsuitable_scenarios: [],
  }, inv);

  inv = update_inventory({
    card: make_card("张三", "前端高级工程师"),
    skill_evolution: { start: "R1", mid: "R2", end: "R3" },
    history_scores: [{ project: "P2", score: 4.5 }],
    suitable_scenarios: ["前端", "全栈"],
    unsuitable_scenarios: [],
  }, inv);

  const entry = inv.entries[0];
  return inv.entries.length === 1 &&
    entry.persona_card.original.role === "前端高级工程师" &&
    entry.suitable_scenarios.includes("全栈") &&
    entry.history_scores.length === 2;
});

test("T-0061: update_inventory 评分汇总重算", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 3.0 }],
    suitable_scenarios: [],
    unsuitable_scenarios: [],
  }, inv);

  inv = update_inventory({
    card: make_card("张三", "前端"),
    skill_evolution: test_evolution,
    history_scores: [{ project: "P2", score: 5.0 }],
    suitable_scenarios: [],
    unsuitable_scenarios: [],
  }, inv);

  return inv.entries[0].avg_score === 4.0; // (3+5)/2
});

test("T-0061: update_inventory 新名字追加", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端"),
    skill_evolution: test_evolution,
    history_scores: [],
    suitable_scenarios: [],
    unsuitable_scenarios: [],
  }, inv);

  inv = update_inventory({
    card: make_card("李四", "后端"),
    skill_evolution: test_evolution,
    history_scores: [],
    suitable_scenarios: [],
    unsuitable_scenarios: [],
  }, inv);

  return inv.entries.length === 2;
});

test("T-0061: update_inventory 技能演进追加", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端"),
    skill_evolution: { start: "A", mid: "B", end: "C" },
    history_scores: [],
    suitable_scenarios: [],
    unsuitable_scenarios: [],
  }, inv);

  inv = update_inventory({
    card: make_card("张三", "前端"),
    skill_evolution: { start: "", mid: "", end: "D" },
    history_scores: [],
    suitable_scenarios: [],
    unsuitable_scenarios: [],
  }, inv);

  return inv.entries[0].skill_evolution.start === "A" &&
    inv.entries[0].skill_evolution.mid === "C" &&
    inv.entries[0].skill_evolution.end === "D";
});

// ============ T-0062: 库存降级 ============
console.log("\n=== T-0062: 库存降级 ===");

test("T-0062: track_selection 记录选中/未选中", () => {
  const tracker: SelectionTracker[] = [];
  const updated = track_selection(
    ["张三"], // 被选中的
    ["张三", "李四"], // 所有候选人
    tracker
  );
  const zs = updated.find(t => t.name === "张三")!;
  const ls = updated.find(t => t.name === "李四")!;
  return zs.consecutive_not_selected === 0 &&
    zs.last_selected_at !== undefined &&
    ls.consecutive_not_selected === 1;
});

test("T-0062: track_selection 连续未选中递增", () => {
  let tracker: SelectionTracker[] = [];
  tracker = track_selection(["张三"], ["张三", "李四"], tracker);
  tracker = track_selection(["张三"], ["张三", "李四"], tracker);
  const ls = tracker.find(t => t.name === "李四")!;
  return ls.consecutive_not_selected === 2;
});

test("T-0062: track_selection 选中后重置计数", () => {
  let tracker: SelectionTracker[] = [];
  tracker = track_selection(["张三"], ["张三", "李四"], tracker);
  tracker = track_selection(["张三"], ["张三", "李四"], tracker);
  tracker = track_selection(["李四"], ["张三", "李四"], tracker);
  const ls = tracker.find(t => t.name === "李四")!;
  return ls.consecutive_not_selected === 0;
});

test("T-0062: apply_dormant_rule 连续2次标记dormant", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端"), skill_evolution: test_evolution,
    history_scores: [], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);
  inv = write_to_inventory({
    card: make_card("李四", "后端"), skill_evolution: test_evolution,
    history_scores: [], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);

  const tracker: SelectionTracker[] = [
    { name: "张三", consecutive_not_selected: 0 },
    { name: "李四", consecutive_not_selected: 2 },
  ];

  const updated = apply_dormant_rule(inv, tracker);
  const zs = updated.entries.find(e => e.persona_card.original.name === "张三")!;
  const ls = updated.entries.find(e => e.persona_card.original.name === "李四")!;
  return zs.status === "active" && ls.status === "dormant";
});

test("T-0062: sort_with_dormant_last 休眠卡排末尾", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("A", "前端"), skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.5 }], suitable_scenarios: ["前端"], unsuitable_scenarios: [],
  }, inv);
  inv = write_to_inventory({
    card: make_card("B", "前端"), skill_evolution: test_evolution,
    history_scores: [{ project: "P1", score: 4.5 }], suitable_scenarios: ["前端"], unsuitable_scenarios: [],
  }, inv);
  // 手动标记B为dormant
  inv.entries[1].status = "dormant";

  const results: MatchResult[] = [
    { entry: inv.entries[1], match_score: 90, reasons: ["高匹配"], rank: 0 },
    { entry: inv.entries[0], match_score: 80, reasons: ["一般"], rank: 0 },
  ];

  const sorted = sort_with_dormant_last(results);
  return sorted[0].entry.persona_card.original.name === "A" &&
    sorted[1].entry.persona_card.original.name === "B";
});

test("T-0062: reactivate_entry 重新激活", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端"), skill_evolution: test_evolution,
    history_scores: [], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);
  inv.entries[0].status = "dormant";
  inv.index.entries[0].status = "dormant";

  const result = reactivate_entry(inv, "张三");
  return result.entries[0].status === "active" &&
    result.index.entries[0].status === "active";
});

// ============ T-0063: 库存删除 ============
console.log("\n=== T-0063: 库存删除 ===");

test("T-0063: delete_from_inventory 移除条目", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端"), skill_evolution: test_evolution,
    history_scores: [], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);
  inv = write_to_inventory({
    card: make_card("李四", "后端"), skill_evolution: test_evolution,
    history_scores: [], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);

  const result = delete_from_inventory(inv, "张三");
  return result.inventory.entries.length === 1 &&
    result.inventory.entries[0].persona_card.original.name === "李四" &&
    result.deleted !== null &&
    result.deleted.persona_card.original.name === "张三";
});

test("T-0063: delete_from_inventory 不存在返回null", () => {
  const inv = empty_inventory();
  const result = delete_from_inventory(inv, "不存在");
  return result.inventory === inv && result.deleted === null;
});

test("T-0063: confirm_deletion 未确认拒绝删除", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端"), skill_evolution: test_evolution,
    history_scores: [], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);

  const result = confirm_deletion(inv, "张三", false);
  return !result.success && result.inventory.entries.length === 1;
});

test("T-0063: confirm_deletion 确认后执行删除", () => {
  let inv = empty_inventory();
  inv = write_to_inventory({
    card: make_card("张三", "前端"), skill_evolution: test_evolution,
    history_scores: [], suitable_scenarios: [], unsuitable_scenarios: [],
  }, inv);

  const result = confirm_deletion(inv, "张三", true);
  return result.success && result.inventory.entries.length === 0 &&
    result.message.includes("永久删除");
});

test("T-0063: confirm_deletion 不存在角色", () => {
  const inv = empty_inventory();
  const result = confirm_deletion(inv, "不存在", true);
  return !result.success && result.message.includes("未找到");
});

// ============ 汇总 ============
console.log(`\n总计: ${pass + fail} 测试, ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
