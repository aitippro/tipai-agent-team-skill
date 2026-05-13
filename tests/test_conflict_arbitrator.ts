/**
 * QA Test: T-0039 ~ T-0045 冲突检测与仲裁系统
 */
import {
  detect_interface_conflict, detect_all_interface_conflicts,
  InterfaceDefinition,
  detect_data_conflict,
  DataSchema, WriteOperation,
  detect_convention_violations, should_escalate_convention, create_convention_conflict,
  ConventionRule, ConventionViolation,
  detect_logic_conflict, generate_implementation_fingerprint,
  RuleImplementation,
  arbitrate, ArbitrationDecision,
  create_negotiation, record_negotiation_round,
  check_negotiation_timeout, escalate_to_main_agent,
  apply_arbitration_result,
  DEFAULT_CONVENTIONS,
  run_conflict_detection_pipeline,
} from "../src/conflict-arbitrator";

import { ConflictRecord, PersonaCard } from "../src/schemas";

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

// ============ T-0039: 接口冲突检测器 ============
console.log("\n=== T-0039: 接口冲突检测器 ===");

const iface_a: InterfaceDefinition = {
  group: "前端组",
  endpoint_or_module: "/api/users",
  fields: [
    { name: "id", type: "number", optional: false },
    { name: "name", type: "string", optional: false },
    { name: "email", type: "string", optional: true },
  ],
  description: "用户接口",
};

const iface_b_match: InterfaceDefinition = {
  group: "后端组",
  endpoint_or_module: "/api/users",
  fields: [
    { name: "id", type: "int", optional: false },
    { name: "name", type: "varchar", optional: false },
    { name: "email", type: "text", optional: true },
  ],
  description: "用户接口",
};

const iface_b_mismatch: InterfaceDefinition = {
  group: "后端组",
  endpoint_or_module: "/api/users",
  fields: [
    { name: "id", type: "string", optional: false },
    { name: "username", type: "string", optional: false },
  ],
  description: "用户接口",
};

test("T-0039: 兼容类型不产生冲突 (number/int, string/varchar)", () => {
  const c = detect_interface_conflict(iface_a, iface_b_match);
  return c === null;
});

test("T-0039: 字段名不同产生冲突 (name vs username缺失)", () => {
  const c = detect_interface_conflict(iface_a, iface_b_mismatch);
  return c !== null && c.type === "interface" && c.result.includes("缺失");
});

test("T-0039: 类型不兼容产生冲突 (number vs string)", () => {
  const c = detect_interface_conflict(iface_a, iface_b_mismatch);
  return c !== null && c.result.includes("类型不一致");
});

test("T-0039: 多个字段问题 → severity=blocking", () => {
  const c = detect_interface_conflict(iface_a, iface_b_mismatch);
  return c !== null && c.severity === "blocking";
});

test("T-0039: optional状态不一致检测", () => {
  const a: InterfaceDefinition = {
    group: "A", endpoint_or_module: "/api/x",
    fields: [{ name: "f1", type: "string", optional: true }],
    description: "",
  };
  const b: InterfaceDefinition = {
    group: "B", endpoint_or_module: "/api/x",
    fields: [{ name: "f1", type: "string", optional: false }],
    description: "",
  };
  const c = detect_interface_conflict(a, b);
  return c !== null && c.result.includes("optional");
});

test("T-0039: 单个问题 → severity=delayed", () => {
  const a: InterfaceDefinition = {
    group: "A", endpoint_or_module: "/api/x",
    fields: [
      { name: "f1", type: "string", optional: false },
      { name: "f2", type: "number", optional: false },
    ],
    description: "",
  };
  const b: InterfaceDefinition = {
    group: "B", endpoint_or_module: "/api/x",
    fields: [
      { name: "f1", type: "string", optional: false },
      { name: "f2", type: "string", optional: false },
    ],
    description: "",
  };
  const c = detect_interface_conflict(a, b);
  return c !== null && c.severity === "delayed";
});

test("T-0039: 批量检测 — 3组两两比较", () => {
  const iface_c: InterfaceDefinition = {
    group: "数据组",
    endpoint_or_module: "/api/users",
    fields: [
      { name: "user_id", type: "bigint", optional: false },
      { name: "display_name", type: "string", optional: false },
    ],
    description: "用户接口",
  };
  const conflicts = detect_all_interface_conflicts([iface_a, iface_b_mismatch, iface_c]);
  return conflicts.length >= 2;
});

test("T-0039: 完全一致接口无冲突", () => {
  const same: InterfaceDefinition = {
    group: "组C",
    endpoint_or_module: "/api/x",
    fields: [{ name: "id", type: "number", optional: false }],
    description: "",
  };
  const same2: InterfaceDefinition = {
    group: "组D",
    endpoint_or_module: "/api/x",
    fields: [{ name: "id", type: "int32", optional: false }],
    description: "",
  };
  return detect_interface_conflict(same, same2) === null;
});

test("T-0039: B侧多余字段检测", () => {
  const a: InterfaceDefinition = {
    group: "A", endpoint_or_module: "/api/x",
    fields: [{ name: "id", type: "number", optional: false }],
    description: "",
  };
  const b: InterfaceDefinition = {
    group: "B", endpoint_or_module: "/api/x",
    fields: [
      { name: "id", type: "number", optional: false },
      { name: "extra_field", type: "string", optional: false },
    ],
    description: "",
  };
  const c = detect_interface_conflict(a, b);
  return c !== null && c.result.includes("extra_field") && c.result.includes("A 侧缺失");
});

// ============ T-0040: 数据冲突检测器 ============
console.log("\n=== T-0040: 数据冲突检测器 ===");

const schema: DataSchema = {
  group: "数据组",
  tables: [
    {
      name: "users",
      columns: [
        { name: "id", type: "int", nullable: false, primary_key: true },
        { name: "name", type: "varchar", nullable: false },
        { name: "email", type: "varchar", nullable: true },
        { name: "age", type: "int", nullable: true },
      ],
    },
    {
      name: "orders",
      columns: [
        { name: "order_id", type: "int", nullable: false, primary_key: true },
        { name: "user_id", type: "int", nullable: false },
        { name: "amount", type: "decimal", nullable: false },
      ],
    },
  ],
  version: "1.0",
};

test("T-0040: 合法写操作不产生冲突", () => {
  const op: WriteOperation = {
    group: "后端组",
    table: "users",
    columns: ["id", "name", "email"],
    types: { id: "number", name: "string", email: "string" },
    operation: "INSERT",
  };
  return detect_data_conflict(op, schema) === null;
});

test("T-0040: 表不存在 → blocking冲突", () => {
  const op: WriteOperation = {
    group: "后端组",
    table: "products",
    columns: ["id"],
    types: { id: "int" },
    operation: "INSERT",
  };
  const c = detect_data_conflict(op, schema);
  return c !== null && c.severity === "blocking" && c.result.includes("不存在");
});

test("T-0040: 列不存在于Schema", () => {
  const op: WriteOperation = {
    group: "后端组",
    table: "users",
    columns: ["id", "name", "phone"],
    types: { id: "int", name: "string", phone: "string" },
    operation: "INSERT",
  };
  const c = detect_data_conflict(op, schema);
  return c !== null && c.result.includes("phone") && c.result.includes("不存在");
});

test("T-0040: 类型不匹配", () => {
  const op: WriteOperation = {
    group: "后端组",
    table: "users",
    columns: ["id", "name"],
    types: { id: "string", name: "string" },
    operation: "UPDATE",
  };
  const c = detect_data_conflict(op, schema);
  return c !== null && c.result.includes("类型不匹配");
});

test("T-0040: INSERT缺少非空列 → blocking", () => {
  const op: WriteOperation = {
    group: "后端组",
    table: "users",
    columns: ["email"],
    types: { email: "string" },
    operation: "INSERT",
  };
  const c = detect_data_conflict(op, schema);
  return c !== null && c.severity === "blocking" && c.result.includes("非空列");
});

test("T-0040: UPDATE不检查非空列", () => {
  const op: WriteOperation = {
    group: "后端组",
    table: "users",
    columns: ["email"],
    types: { email: "string" },
    operation: "UPDATE",
  };
  return detect_data_conflict(op, schema) === null;
});

test("T-0040: 兼容数据类型不冲突 (decimal/number)", () => {
  const op: WriteOperation = {
    group: "后端组",
    table: "orders",
    columns: ["order_id", "user_id", "amount"],
    types: { order_id: "number", user_id: "number", amount: "float" },
    operation: "INSERT",
  };
  return detect_data_conflict(op, schema) === null;
});

test("T-0040: detected_by含数据权威标记", () => {
  const op: WriteOperation = {
    group: "后端组",
    table: "products",
    columns: ["id"],
    types: { id: "int" },
    operation: "INSERT",
  };
  const c = detect_data_conflict(op, schema);
  return c !== null && c.detected_by.includes("数据权威");
});

test("T-0040: parties包含操作方和Schema方", () => {
  const op: WriteOperation = {
    group: "后端组",
    table: "users",
    columns: ["id", "name", "phone"],
    types: {},
    operation: "UPDATE",
  };
  const c = detect_data_conflict(op, schema);
  return c !== null && c.parties.includes("后端组") && c.parties.includes("数据组");
});

// ============ T-0041: 约定冲突检测器 ============
console.log("\n=== T-0041: 约定冲突检测器 ===");

const test_conventions: ConventionRule[] = [
  { id: "C001", category: "响应格式", rule: "统一使用code字段", required_pattern: "code" },
  { id: "C002", category: "错误处理", rule: "禁止process.exit", forbidden_pattern: "process.exit" },
  { id: "C005", category: "日志", rule: "禁止console.log", forbidden_pattern: "console.log" },
  { id: "C006", category: "鉴权", rule: "必须包含auth", required_pattern: "auth" },
];

const good_code = `
import { auth } from './middleware';
function handler(req, res) {
  const result = processData(req.body);
  res.json({ code: 200, data: result });
}
`;

const bad_code = `
function handler(req, res) {
  console.log("debug");
  process.exit(1);
  res.json({ status: 200, data: null });
}
`;

test("T-0041: 合规代码无违规", () => {
  const violations = detect_convention_violations(good_code, test_conventions);
  return violations.length === 0;
});

test("T-0041: 缺少required_pattern检测", () => {
  const violations = detect_convention_violations(bad_code, test_conventions);
  const missing_code = violations.find(v => v.convention_id === "C001");
  return missing_code !== undefined && missing_code.description.includes("缺少约定模式");
});

test("T-0041: forbidden_pattern检测 (console.log)", () => {
  const violations = detect_convention_violations(bad_code, test_conventions);
  const has_console = violations.some(v => v.convention_id === "C005");
  return has_console;
});

test("T-0041: forbidden_pattern检测 (process.exit)", () => {
  const violations = detect_convention_violations(bad_code, test_conventions);
  const has_exit = violations.some(v => v.convention_id === "C002");
  return has_exit;
});

test("T-0041: forbidden检测含行号", () => {
  const violations = detect_convention_violations(bad_code, test_conventions);
  const console_v = violations.find(v => v.convention_id === "C005");
  return console_v !== undefined && console_v.line > 0;
});

test("T-0041: >=3处偏离 → 应上报", () => {
  const violations = detect_convention_violations(bad_code, test_conventions);
  return violations.length >= 3 && should_escalate_convention(violations);
});

test("T-0041: <3处偏离 → 不上报", () => {
  const small_violations: ConventionViolation[] = [
    { convention_id: "C001", rule: "x", line: 1, description: "d" },
    { convention_id: "C002", rule: "y", line: 2, description: "d" },
  ];
  return !should_escalate_convention(small_violations);
});

test("T-0041: 生成冲突记录含成员名和违规数", () => {
  const violations = detect_convention_violations(bad_code, test_conventions);
  const record = create_convention_conflict("张三", "后端组", violations);
  return record.type === "convention" &&
    record.result.includes("张三") &&
    record.result.includes(`${violations.length} 处`) &&
    record.parties.includes("后端组") &&
    record.parties.includes("主Agent");
});

test("T-0041: >=5处违规 → severity=blocking", () => {
  const many: ConventionViolation[] = Array.from({ length: 6 }, (_, i) => ({
    convention_id: `C${i}`, rule: "x", line: i, description: "d",
  }));
  const record = create_convention_conflict("测试", "组A", many);
  return record.severity === "blocking";
});

test("T-0041: <5处违规 → severity=delayed", () => {
  const few: ConventionViolation[] = Array.from({ length: 3 }, (_, i) => ({
    convention_id: `C${i}`, rule: "x", line: i, description: "d",
  }));
  const record = create_convention_conflict("测试", "组A", few);
  return record.severity === "delayed";
});

// ============ T-0042: 逻辑冲突检测器 ============
console.log("\n=== T-0042: 逻辑冲突检测器 ===");

test("T-0042: 同一规则不同实现不同组 → 冲突", () => {
  const impls: RuleImplementation[] = [
    { rule_id: "R001", rule_description: "折扣计算", location: "order.ts", group: "前端组", fingerprint: "abc123" },
    { rule_id: "R001", rule_description: "折扣计算", location: "pricing.ts", group: "后端组", fingerprint: "def456" },
  ];
  const conflicts = detect_logic_conflict(impls);
  return conflicts.length === 1 && conflicts[0].type === "logic" && conflicts[0].severity === "blocking";
});

test("T-0042: 同一规则相同fingerprint → 无冲突", () => {
  const impls: RuleImplementation[] = [
    { rule_id: "R001", rule_description: "折扣计算", location: "order.ts", group: "前端组", fingerprint: "same" },
    { rule_id: "R001", rule_description: "折扣计算", location: "pricing.ts", group: "后端组", fingerprint: "same" },
  ];
  return detect_logic_conflict(impls).length === 0;
});

test("T-0042: 不同规则不冲突", () => {
  const impls: RuleImplementation[] = [
    { rule_id: "R001", rule_description: "折扣计算", location: "a.ts", group: "A", fingerprint: "aaa" },
    { rule_id: "R002", rule_description: "税计算", location: "b.ts", group: "B", fingerprint: "bbb" },
  ];
  return detect_logic_conflict(impls).length === 0;
});

test("T-0042: 同组不同实现不算冲突", () => {
  const impls: RuleImplementation[] = [
    { rule_id: "R001", rule_description: "折扣计算", location: "v1.ts", group: "后端组", fingerprint: "aaa" },
    { rule_id: "R001", rule_description: "折扣计算", location: "v2.ts", group: "后端组", fingerprint: "bbb" },
  ];
  return detect_logic_conflict(impls).length === 0;
});

test("T-0042: 多规则多冲突", () => {
  const impls: RuleImplementation[] = [
    { rule_id: "R001", rule_description: "折扣", location: "a.ts", group: "A", fingerprint: "a1" },
    { rule_id: "R001", rule_description: "折扣", location: "b.ts", group: "B", fingerprint: "b1" },
    { rule_id: "R002", rule_description: "税率", location: "c.ts", group: "C", fingerprint: "c1" },
    { rule_id: "R002", rule_description: "税率", location: "d.ts", group: "D", fingerprint: "d1" },
  ];
  return detect_logic_conflict(impls).length === 2;
});

test("T-0042: 冲突记录含parties和位置信息", () => {
  const impls: RuleImplementation[] = [
    { rule_id: "R001", rule_description: "折扣", location: "order.ts", group: "前端组", fingerprint: "x" },
    { rule_id: "R001", rule_description: "折扣", location: "pricing.ts", group: "后端组", fingerprint: "y" },
  ];
  const c = detect_logic_conflict(impls)[0];
  return c.parties.includes("前端组") && c.parties.includes("后端组") &&
    c.result.includes("order.ts") && c.result.includes("pricing.ts");
});

test("T-0042: fingerprint对结构相同代码相同", () => {
  const code1 = `function calc(a, b) { return a + b; }`;
  const code2 = `function add(x, y) { return x + y; }`;
  const fp1 = generate_implementation_fingerprint(code1);
  const fp2 = generate_implementation_fingerprint(code2);
  return fp1 === fp2;
});

test("T-0042: fingerprint对结构不同代码不同", () => {
  const code1 = `function calc(a, b) { return a + b; }`;
  const code2 = `function calc(a, b) { if (a > 0) { return a * b; } return 0; }`;
  const fp1 = generate_implementation_fingerprint(code1);
  const fp2 = generate_implementation_fingerprint(code2);
  return fp1 !== fp2;
});

test("T-0042: fingerprint忽略注释", () => {
  const code1 = `function f() { return 1; }`;
  const code2 = `// this is a comment\nfunction f() { return 1; }`;
  const fp1 = generate_implementation_fingerprint(code1);
  const fp2 = generate_implementation_fingerprint(code2);
  return fp1 === fp2;
});

// ============ T-0043: 仲裁决策引擎 ============
console.log("\n=== T-0043: 仲裁决策引擎 ===");

test("T-0043: convention冲突 → side_a(全局约定为准)", () => {
  const conflict: ConflictRecord = {
    conflict_id: "C-CONV-1", type: "convention", parties: ["后端组", "主Agent"],
    severity: "delayed", detected_by: "后端组组长", detection_time: new Date().toISOString(),
    resolution_path: "lead_arbitration", result: "偏离3处",
  };
  const d = arbitrate(conflict);
  return d.resolution === "side_a" && d.reason.includes("全局约定");
});

test("T-0043: data冲突 → side_b(数据Schema方)", () => {
  const conflict: ConflictRecord = {
    conflict_id: "C-DATA-1", type: "data", parties: ["后端组", "数据组"],
    severity: "blocking", detected_by: "数据组组长", detection_time: new Date().toISOString(),
    resolution_path: "lead_arbitration", result: "列类型不匹配",
  };
  const d = arbitrate(conflict);
  return d.resolution === "side_b" && d.winner === "数据组";
});

test("T-0043: interface冲突+有需求 → compromise", () => {
  const conflict: ConflictRecord = {
    conflict_id: "C-IFACE-1", type: "interface", parties: ["前端组", "后端组"],
    severity: "delayed", detected_by: "前端组组长", detection_time: new Date().toISOString(),
    resolution_path: "negotiation", result: "字段不一致",
  };
  const d = arbitrate(conflict, { requirements: "用户接口必须包含email" });
  return d.resolution === "compromise" && d.reason.includes("需求");
});

test("T-0043: interface冲突+无需求 → client_decision", () => {
  const conflict: ConflictRecord = {
    conflict_id: "C-IFACE-2", type: "interface", parties: ["前端组", "后端组"],
    severity: "delayed", detected_by: "前端组组长", detection_time: new Date().toISOString(),
    resolution_path: "negotiation", result: "字段不一致",
  };
  const d = arbitrate(conflict);
  return d.resolution === "client_decision" && d.reason.includes("客户");
});

test("T-0043: logic冲突 → 基于理由评分选择", () => {
  const conflict: ConflictRecord = {
    conflict_id: "C-LOGIC-1", type: "logic", parties: ["前端组", "后端组"],
    severity: "blocking", detected_by: "主Agent", detection_time: new Date().toISOString(),
    resolution_path: "lead_arbitration", result: "不同实现",
  };
  const d = arbitrate(conflict, {
    side_a_rationale: "这种方式性能更优，且符合安全规范",
    side_b_rationale: "简单实现",
  });
  return d.resolution === "side_a" && d.winner === "前端组";
});

test("T-0043: logic冲突 → B方更优时选B", () => {
  const conflict: ConflictRecord = {
    conflict_id: "C-LOGIC-2", type: "logic", parties: ["前端组", "后端组"],
    severity: "blocking", detected_by: "主Agent", detection_time: new Date().toISOString(),
    resolution_path: "lead_arbitration", result: "不同实现",
  };
  const d = arbitrate(conflict, {
    side_a_rationale: "简单",
    side_b_rationale: "这种方式安全且性能更优，还有更好的可维护性和扩展性设计",
  });
  return d.resolution === "side_b" && d.winner === "后端组";
});

test("T-0043: logic冲突无context → 默认side_a(分数相等)", () => {
  const conflict: ConflictRecord = {
    conflict_id: "C-LOGIC-3", type: "logic", parties: ["A", "B"],
    severity: "blocking", detected_by: "主Agent", detection_time: new Date().toISOString(),
    resolution_path: "lead_arbitration", result: "不同实现",
  };
  const d = arbitrate(conflict);
  return d.resolution === "side_a";
});

test("T-0043: 所有决策都有decided_at", () => {
  const types: ConflictRecord[] = [
    { conflict_id: "C1", type: "convention", parties: ["A", "B"], severity: "delayed", detected_by: "X", detection_time: "", resolution_path: "negotiation", result: "t" },
    { conflict_id: "C2", type: "data", parties: ["A", "B"], severity: "blocking", detected_by: "X", detection_time: "", resolution_path: "negotiation", result: "t" },
    { conflict_id: "C3", type: "interface", parties: ["A", "B"], severity: "delayed", detected_by: "X", detection_time: "", resolution_path: "negotiation", result: "t" },
    { conflict_id: "C4", type: "logic", parties: ["A", "B"], severity: "blocking", detected_by: "X", detection_time: "", resolution_path: "negotiation", result: "t" },
  ];
  return types.every(c => {
    const d = arbitrate(c);
    return d.decided_at !== undefined && d.decided_at.length > 0;
  });
});

test("T-0043: convention决策含convention_update", () => {
  const conflict: ConflictRecord = {
    conflict_id: "C-CONV-X", type: "convention", parties: ["A", "主Agent"],
    severity: "delayed", detected_by: "A组长", detection_time: "", resolution_path: "lead_arbitration", result: "偏离5处",
  };
  const d = arbitrate(conflict);
  return d.convention_update !== undefined;
});

// ============ T-0044: 协商超时检测 ============
console.log("\n=== T-0044: 协商超时检测 ===");

test("T-0044: 创建协商状态", () => {
  const n = create_negotiation("C-001");
  return n.conflict_id === "C-001" && n.rounds === 0 && n.max_rounds === 2 && n.status === "negotiating";
});

test("T-0044: 自定义max_rounds", () => {
  const n = create_negotiation("C-002", 5);
  return n.max_rounds === 5;
});

test("T-0044: 记录一轮协商", () => {
  const n = create_negotiation("C-001", 2);
  const after = record_negotiation_round(n);
  return after.rounds === 1 && after.status === "negotiating";
});

test("T-0044: 超过max_rounds → 自动escalated", () => {
  let n = create_negotiation("C-001", 2);
  n = record_negotiation_round(n);
  n = record_negotiation_round(n);
  n = record_negotiation_round(n);
  return n.status === "escalated" && n.rounds === 3;
});

test("T-0044: 轮次达到max → 检测应超时", () => {
  let n = create_negotiation("C-001", 2);
  n = record_negotiation_round(n);
  n = record_negotiation_round(n);
  return check_negotiation_timeout(n);
});

test("T-0044: 轮次未达上限 → 不超时", () => {
  let n = create_negotiation("C-001", 3);
  n = record_negotiation_round(n);
  return !check_negotiation_timeout(n);
});

test("T-0044: 已escalated → 不再超时", () => {
  let n = create_negotiation("C-001", 2);
  n = { ...n, status: "escalated" as const };
  return !check_negotiation_timeout(n);
});

test("T-0044: 已resolved → 不再超时", () => {
  let n = create_negotiation("C-001", 2);
  n = { ...n, status: "resolved" as const, rounds: 10 };
  return !check_negotiation_timeout(n);
});

test("T-0044: 时间超30分钟 → 超时", () => {
  let n = create_negotiation("C-001", 10);
  const past = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  n = { ...n, rounds: 1, last_round_at: past };
  return check_negotiation_timeout(n);
});

test("T-0044: 升级到主Agent → 暂停相关组", () => {
  const n = create_negotiation("C-001", 2);
  const conflict: ConflictRecord = {
    conflict_id: "C-001", type: "interface", parties: ["前端组", "后端组"],
    severity: "delayed", detected_by: "前端组组长", detection_time: "",
    resolution_path: "negotiation", result: "字段不一致",
  };
  const result = escalate_to_main_agent(n, conflict);
  return result.state.status === "escalated" &&
    result.conflict.severity === "blocking" &&
    result.conflict.result.includes("协商超时升级") &&
    result.suspended_groups.includes("前端组") &&
    result.suspended_groups.includes("后端组");
});

// ============ T-0045: 仲裁结果写入 ============
console.log("\n=== T-0045: 仲裁结果写入 ===");

function make_test_card(name: string, role: string): PersonaCard {
  return {
    name, role, summary: "测试",
    must_do: ["实现"], must_not_do: ["越界"],
    tech_env: { language: "TypeScript" },
    input_sources: [], output_targets: [],
    behavior_rules: ["规则1"],
    permission_mode: "bypassPermissions",
    lifecycle: "project_destroy",
  };
}

test("T-0045: 有convention_update时更新全局约定", () => {
  const decision: ArbitrationDecision = {
    conflict_id: "C-001", resolution: "compromise",
    reason: "接口对齐", convention_update: "新增约定: email必填",
    decided_at: new Date().toISOString(),
  };
  const conflict: ConflictRecord = {
    conflict_id: "C-001", type: "interface", parties: ["前端组", "后端组"],
    severity: "delayed", detected_by: "前端组组长", detection_time: "",
    resolution_path: "negotiation", result: "字段不一致",
  };
  const result = apply_arbitration_result(decision, conflict, [], []);
  return result.updated_conventions.length === 1 &&
    result.updated_conventions[0].rule.includes("email必填") &&
    result.updated_conventions[0].category === "arbitration";
});

test("T-0045: 无convention_update → 不新增约定", () => {
  const decision: ArbitrationDecision = {
    conflict_id: "C-001", resolution: "side_b",
    reason: "数据Schema为准", decided_at: new Date().toISOString(),
  };
  const conflict: ConflictRecord = {
    conflict_id: "C-001", type: "data", parties: ["后端组", "数据组"],
    severity: "blocking", detected_by: "数据组组长", detection_time: "",
    resolution_path: "lead_arbitration", result: "类型不匹配",
  };
  const result = apply_arbitration_result(decision, conflict, [], []);
  return result.updated_conventions.length === 0;
});

test("T-0045: 冲突方人物卡被打标记", () => {
  const decision: ArbitrationDecision = {
    conflict_id: "C-001", resolution: "side_a",
    reason: "全局约定为准", decided_at: new Date().toISOString(),
  };
  const conflict: ConflictRecord = {
    conflict_id: "C-001", type: "convention", parties: ["前端组", "主Agent"],
    severity: "delayed", detected_by: "前端组组长", detection_time: "",
    resolution_path: "lead_arbitration", result: "偏离3处",
  };
  const cards = [make_test_card("王五", "前端组工程师"), make_test_card("李四", "后端组工程师")];
  const result = apply_arbitration_result(decision, conflict, [], cards);
  const marked = result.updated_cards.find(c => c.name === "王五");
  return marked !== undefined &&
    marked.behavior_rules.some(r => r.includes("仲裁标记")) &&
    marked.behavior_rules.some(r => r.includes("C-001"));
});

test("T-0045: 不相关方人物卡不被标记", () => {
  const decision: ArbitrationDecision = {
    conflict_id: "C-001", resolution: "side_a",
    reason: "全局约定为准", decided_at: new Date().toISOString(),
  };
  const conflict: ConflictRecord = {
    conflict_id: "C-001", type: "convention", parties: ["前端组", "主Agent"],
    severity: "delayed", detected_by: "前端组组长", detection_time: "",
    resolution_path: "lead_arbitration", result: "偏离3处",
  };
  const cards = [make_test_card("独立人", "独立组工程师")];
  const result = apply_arbitration_result(decision, conflict, [], cards);
  const unmarked = result.updated_cards.find(c => c.name === "独立人");
  return unmarked !== undefined && !unmarked.behavior_rules.some(r => r.includes("仲裁标记"));
});

test("T-0045: archive_entry含已仲裁标记", () => {
  const decision: ArbitrationDecision = {
    conflict_id: "C-001", resolution: "compromise",
    reason: "折中方案", decided_at: new Date().toISOString(),
  };
  const conflict: ConflictRecord = {
    conflict_id: "C-001", type: "interface", parties: ["A", "B"],
    severity: "delayed", detected_by: "A组长", detection_time: "",
    resolution_path: "negotiation", result: "接口不一致",
  };
  const result = apply_arbitration_result(decision, conflict, [], []);
  return result.archive_entry.result.includes("已仲裁") &&
    result.archive_entry.result.includes("compromise") &&
    result.archive_entry.resolved_at === decision.decided_at;
});

test("T-0045: compromise → resolution_path=negotiation", () => {
  const decision: ArbitrationDecision = {
    conflict_id: "C-001", resolution: "compromise",
    reason: "折中", decided_at: new Date().toISOString(),
  };
  const conflict: ConflictRecord = {
    conflict_id: "C-001", type: "interface", parties: ["A", "B"],
    severity: "delayed", detected_by: "A", detection_time: "",
    resolution_path: "negotiation", result: "x",
  };
  const result = apply_arbitration_result(decision, conflict, [], []);
  return result.archive_entry.resolution_path === "negotiation";
});

test("T-0045: client_decision → resolution_path=client_decision", () => {
  const decision: ArbitrationDecision = {
    conflict_id: "C-001", resolution: "client_decision",
    reason: "客户选择", decided_at: new Date().toISOString(),
  };
  const conflict: ConflictRecord = {
    conflict_id: "C-001", type: "interface", parties: ["A", "B"],
    severity: "delayed", detected_by: "A", detection_time: "",
    resolution_path: "negotiation", result: "x",
  };
  const result = apply_arbitration_result(decision, conflict, [], []);
  return result.archive_entry.resolution_path === "client_decision";
});

test("T-0045: side_a/side_b → resolution_path=lead_arbitration", () => {
  const decision: ArbitrationDecision = {
    conflict_id: "C-001", resolution: "side_a",
    reason: "A方更优", decided_at: new Date().toISOString(),
  };
  const conflict: ConflictRecord = {
    conflict_id: "C-001", type: "logic", parties: ["A", "B"],
    severity: "blocking", detected_by: "主Agent", detection_time: "",
    resolution_path: "lead_arbitration", result: "x",
  };
  const result = apply_arbitration_result(decision, conflict, [], []);
  return result.archive_entry.resolution_path === "lead_arbitration";
});

test("T-0045: result对象完整性", () => {
  const decision: ArbitrationDecision = {
    conflict_id: "C-001", resolution: "compromise",
    reason: "折中", convention_update: "新约定", decided_at: new Date().toISOString(),
  };
  const conflict: ConflictRecord = {
    conflict_id: "C-001", type: "interface", parties: ["A", "B"],
    severity: "delayed", detected_by: "A", detection_time: "",
    resolution_path: "negotiation", result: "x",
  };
  const result = apply_arbitration_result(decision, conflict, [], []);
  return result.result.decision === decision &&
    result.result.original_conflict === conflict &&
    result.result.convention_updates.length === 1 &&
    result.result.resolved_at === decision.decided_at;
});

// ============ 集成测试 ============
console.log("\n=== 集成测试 ===");

test("集成: DEFAULT_CONVENTIONS含8条规则", () => {
  return DEFAULT_CONVENTIONS.length === 8;
});

test("集成: run_conflict_detection_pipeline全链路", () => {
  const interfaces: InterfaceDefinition[] = [
    { group: "前端", endpoint_or_module: "/api/user", fields: [{ name: "id", type: "string" }], description: "" },
    { group: "后端", endpoint_or_module: "/api/user", fields: [{ name: "id", type: "number" }], description: "" },
  ];

  const data_schema: DataSchema = {
    group: "数据", tables: [{ name: "users", columns: [
      { name: "id", type: "int", nullable: false },
      { name: "name", type: "varchar", nullable: false },
    ] }], version: "1.0",
  };

  const operations: WriteOperation[] = [{
    group: "后端", table: "users", columns: ["id", "phone"],
    types: { id: "int", phone: "string" }, operation: "INSERT",
  }];

  const code_with_violations = `
function handle() {
  console.log("debug");
  process.exit(1);
  return { status: 200 };
}
`;
  const member_code_map = { "张三": code_with_violations };

  const implementations: RuleImplementation[] = [
    { rule_id: "R1", rule_description: "折扣", location: "a.ts", group: "前端", fingerprint: "x" },
    { rule_id: "R1", rule_description: "折扣", location: "b.ts", group: "后端", fingerprint: "y" },
  ];

  const cards = [make_test_card("前端组长", "前端组长"), make_test_card("后端组长", "后端组长")];

  const result = run_conflict_detection_pipeline(
    interfaces, operations, data_schema,
    member_code_map, implementations,
    DEFAULT_CONVENTIONS, cards
  );

  return result.conflicts.length >= 3 &&
    result.decisions.length === result.conflicts.length &&
    result.results.length === result.conflicts.length;
});

test("集成: pipeline空输入无冲突", () => {
  const empty_schema: DataSchema = { group: "数据", tables: [], version: "1.0" };
  const result = run_conflict_detection_pipeline([], [], empty_schema, {}, [], [], []);
  return result.conflicts.length === 0 && result.decisions.length === 0;
});

// ============ 汇总 ============
console.log(`\n总计: ${pass + fail} 测试, ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
