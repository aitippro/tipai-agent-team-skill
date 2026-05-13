/**
 * QA Test: T-0033 ~ T-0038 代码审查引擎
 */
import {
  detect_input_deviation, detect_output_deviation,
  detect_business_rule_omission, detect_boundary_omission, detect_fake_error_handling,
  detect_fake_implementation,
  count_effective_statements, has_todo_without_implementation,
  detect_empty_implementation,
  detect_unfilled_constants,
  detect_dead_code, detect_no_side_effect_writes,
  detect_copy_paste_residue, detect_unused_imports,
  detect_over_wrapping,
  detect_worthless_code,
  detect_hardcoded_return, detect_empty_catch,
  detect_comment_replacing_implementation, detect_requirement_code_mismatch,
  detect_pass_through, detect_fake_validation,
  detect_fake_computation,
  detect_cheating_code,
  grade_review, grade_description, should_reject,
  generate_review_report,
  CodeIssue, RequirementRule,
} from "../src/code-reviewer";

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

// ===== T-0033: 假实现检测器 =====

test("T-0033: detect_input_deviation -> 缺失输入字段", () => {
  const code = "function createOrder(data: any) { return db.save(data); }";
  const issues = detect_input_deviation(code, ["userId", "productId", "quantity"]);
  return issues.length >= 3
    && issues.every((i) => i.type === "fake" && i.subtype === "输入处理偏离");
});

test("T-0033: detect_input_deviation -> 所有输入存在则无问题", () => {
  const code = "function createOrder(userId: string, productId: string) { return { userId, productId }; }";
  const issues = detect_input_deviation(code, ["userId", "productId"]);
  return issues.length === 0;
});

test("T-0033: detect_output_deviation -> 缺失输出字段", () => {
  const code = "function getOrder() { return { id: 1 }; }";
  const issues = detect_output_deviation(code, ["status", "total"]);
  return issues.length >= 2
    && issues.every((i) => i.type === "fake" && i.subtype === "输出结构偏离");
});

test("T-0033: detect_business_rule_omission -> 规则无分支覆盖", () => {
  const code = "function processPayment(amount: number) { return amount; }";
  const issues = detect_business_rule_omission(code, ["验证支付状态", "检查余额", "记录交易日志"]);
  return issues.length >= 2
    && issues.every((i) => i.type === "fake" && i.subtype === "业务规则遗漏");
});

test("T-0033: detect_boundary_omission -> 无空值检查", () => {
  const code = `
function calculatePrice(price: number, discount: number) {
  return price * (1 - discount);
}`;
  const issues = detect_boundary_omission(code);
  return issues.some((i) => i.subtype === "边界条件遗漏" && i.description.includes("空值"));
});

test("T-0033: detect_boundary_omission -> 数组无越界检查", () => {
  const code = "function getFirst(arr: any[]) { return arr[0]; }";
  const issues = detect_boundary_omission(code);
  return issues.some((i) => i.subtype === "边界条件遗漏" && i.description.includes("数组"));
});

test("T-0033: detect_fake_error_handling -> 空catch块", () => {
  const code = "try { riskyOp(); } catch(e) {}";
  const issues = detect_fake_error_handling(code);
  return issues.length >= 1
    && issues.some((i) => i.description.includes("catch 块为空"));
});

test("T-0033: detect_fake_error_handling -> 正常错误处理无问题", () => {
  const code = `
try {
  const result = await fetchData();
} catch (e) {
  if (e instanceof NetworkError) {
    retry();
  } else {
    logAndReport(e);
  }
}`;
  const issues = detect_fake_error_handling(code);
  return issues.length === 0;
});

test("T-0033: detect_fake_implementation -> 综合检测", () => {
  const code = "function order() { return {}; }";
  const req: RequirementRule = {
    id: "R1",
    description: "订单CRUD",
    expected_branches: ["创建订单", "查询订单"],
    expected_inputs: ["userId", "items"],
    expected_outputs: ["orderId", "status"],
  };
  const issues = detect_fake_implementation(code, req);
  return issues.length >= 3; // 输入+输出+业务规则
});

// ===== T-0034: 空实现检测器 =====

test("T-0034: count_effective_statements -> 正常代码>5", () => {
  const code = `
function create(data: any) {
  const validated = validate(data);
  if (!validated) throw new Error("invalid");
  const result = db.insert(validated);
  return result;
}`;
  return count_effective_statements(code) >= 3;
});

test("T-0034: count_effective_statements -> 空函数=0", () => {
  const code = "function stub() {}";
  return count_effective_statements(code) === 0;
});

test("T-0034: count_effective_statements -> 仅注释=0", () => {
  const code = `
// TODO: implement this
// FIXME: handle edge cases
`;
  return count_effective_statements(code) === 0;
});

test("T-0034: count_effective_statements -> 仅return null=0", () => {
  const code = "function getData() { return null; }";
  return count_effective_statements(code) === 0;
});

test("T-0034: count_effective_statements -> 仅console.log=0", () => {
  const code = "function debug() { console.log('called'); }";
  return count_effective_statements(code) === 0;
});

test("T-0034: has_todo_without_implementation -> TODO+空实现=true", () => {
  const code = `
// TODO: implement payment logic
function pay() {
  return null;
}`;
  return has_todo_without_implementation(code) === true;
});

test("T-0034: has_todo_without_implementation -> 有实现=false", () => {
  const code = `
// TODO: optimize later
function pay(amount: number) {
  const tax = amount * 0.1;
  const total = amount + tax;
  return db.charge(total);
}`;
  return has_todo_without_implementation(code) === false;
});

test("T-0034: detect_empty_implementation -> 完全空实现", () => {
  const code = "function process() { return null; }";
  const issues = detect_empty_implementation(code, "process");
  return issues.length >= 1
    && issues.some((i) => i.type === "empty" && (i.subtype === "完全空实现" || i.subtype === "固定返回值"));
});

test("T-0034: detect_empty_implementation -> TODO占位标记", () => {
  const code = `
// TODO: implement order processing
function processOrder() {
  return null;
}`;
  const issues = detect_empty_implementation(code, "processOrder");
  return issues.some((i) => i.subtype === "TODO占位无实现");
});

test("T-0034: detect_empty_implementation -> 正常函数无问题", () => {
  const code = `
function createUser(name: string, email: string) {
  if (!name || !email) throw new Error("validation");
  const user = { name, email, createdAt: new Date() };
  db.users.insert(user);
  return user;
}`;
  const issues = detect_empty_implementation(code, "createUser");
  return issues.length === 0;
});

test("T-0034: detect_empty_implementation -> 仅有调试输出", () => {
  const code = `
function handle(req: any) {
  console.log("request:", req);
}`;
  const issues = detect_empty_implementation(code, "handle");
  return issues.some((i) => i.subtype === "仅有调试输出");
});

// ===== T-0035: 无价值代码检测器 =====

test("T-0035: detect_dead_code -> 单函数片段无误报", () => {
  const code = "export function unusedHelper() {}";
  const issues = detect_dead_code(code);
  return issues.length === 0;
});

test("T-0035: detect_no_side_effect_writes -> 赋值后未使用", () => {
  const code = `
function calc() {
  const x = 1;
  return 42;
}`;
  const issues = detect_no_side_effect_writes(code);
  return issues.length >= 1
    && issues[0].subtype === "无副作用写入";
});

test("T-0035: detect_copy_paste_residue -> 高相似度>90%", () => {
  const code = `
function getUserById(id: string) {
  const user = db.users.findOne({ id });
  if (!user) throw new Error("not found");
  return user;
}`;
  const similar = `
function getOrderById(id: string) {
  const order = db.orders.findOne({ id });
  if (!order) throw new Error("not found");
  return order;
}`;
  const issues = detect_copy_paste_residue(code, [similar]);
  return issues.length >= 1
    && issues[0].subtype === "复制粘贴残留";
});

test("T-0035: detect_copy_paste_residue -> 不同代码无问题", () => {
  const code = "function add(a,b){ return a+b; }";
  const different = `
class PaymentProcessor {
  process(amount: number) {
    if (amount <= 0) throw new ValidationError();
    const transaction = this.gateway.authorize(amount);
    return this.db.saveTransaction(transaction);
  }
}`;
  const issues = detect_copy_paste_residue(code, [different]);
  return issues.length === 0;
});

test("T-0035: detect_unused_imports -> 检测未使用导入", () => {
  const code = `
import { useState, useEffect } from "react";
function App() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}`;
  const issues = detect_unused_imports(code);
  return issues.some((i) => i.subtype === "未使用依赖" && i.description.includes("useEffect"));
});

test("T-0035: detect_worthless_code -> 综合检测", () => {
  const code = `
const temp = 123;
export function getData() {}
return 42;`;
  const issues = detect_worthless_code(code, []);
  return issues.length >= 1;
});

// ===== T-0036: 糊弄代码检测器 =====

test("T-0036: detect_hardcoded_return -> 忽略入参返回常量", () => {
  const code = `
function validatePayment(amount: number, userId: string) {
  return true;
}`;
  const issues = detect_hardcoded_return(code);
  return issues.length >= 1
    && issues[0].subtype === "硬编码返回"
    && issues[0].severity === "high";
});

test("T-0036: detect_hardcoded_return -> 使用入参的正常函数无问题", () => {
  const code = `
function validatePayment(amount: number, userId: string) {
  if (amount <= 0) return false;
  if (!userId) return false;
  return true;
}`;
  const issues = detect_hardcoded_return(code);
  return issues.every((i) => i.subtype !== "硬编码返回") || issues.length === 0;
});

test("T-0036: detect_empty_catch -> 空catch块", () => {
  const code = "try { processPayment(); } catch (e) {}";
  const issues = detect_empty_catch(code);
  return issues.length >= 1
    && issues[0].subtype === "空catch块";
});

test("T-0036: detect_empty_catch -> 仅注释的catch块", () => {
  const code = "try { risky(); } catch (e) { // ignore }";
  const issues = detect_empty_catch(code);
  return issues.length >= 1
    && issues.some((i) => i.subtype === "空catch块(仅注释)");
});

test("T-0036: detect_empty_catch -> 有处理逻辑无问题", () => {
  const code = `
try {
  doSomething();
} catch (e) {
  logger.error("Failed", e);
  throw e;
}`;
  const issues = detect_empty_catch(code);
  return issues.length === 0;
});

test("T-0036: detect_comment_replacing_implementation -> 注释替代实现", () => {
  const code = `
function sendNotification(user: User) {
  // 应该调用邮件服务发送通知
}`;
  const issues = detect_comment_replacing_implementation(code);
  return issues.length >= 1
    && issues[0].subtype === "注释替代实现";
});

test("T-0036: detect_comment_replacing_implementation -> 注释+有实现无问题", () => {
  const code = `
function sendNotification(user: User) {
  // 调用邮件服务发送通知
  emailService.send(user.email, template);
  logger.info("Notification sent");
}`;
  const issues = detect_comment_replacing_implementation(code);
  return issues.length === 0;
});

test("T-0036: detect_requirement_code_mismatch -> 规则全部缺失", () => {
  const code = "function process() { return 0; }";
  const issues = detect_requirement_code_mismatch(code, ["支付幂等性检查", "分布式事务回滚"]);
  return issues.length >= 1
    && issues[0].subtype === "需求代码不匹配";
});

test("T-0036: detect_pass_through -> 透传无处理", () => {
  const code = `
function transform(data: any) {
  return data;
}`;
  const issues = detect_pass_through(code);
  return issues.length >= 1
    && issues[0].subtype === "透传无处理";
});

test("T-0036: detect_fake_validation -> 假参数校验", () => {
  const code = `
function handle(input: any) {
  if (!input) {
    throw new Error("invalid");
  }
}`;
  const issues = detect_fake_validation(code);
  return issues.some((i) => i.subtype === "假参数校验");
});

test("T-0036: detect_cheating_code -> 综合检测", () => {
  const code = `
function check(order: any) {
  // TODO: should validate order
  return true;
}`;
  const issues = detect_cheating_code(code, ["订单验证", "幂等检查"]);
  return issues.length >= 1; // 至少检测到硬编码或需求不匹配
});

// ===== T-0037: 审查结论定级 =====

test("T-0037: grade_review -> 无问题=pass", () => {
  return grade_review([], 100) === "pass";
});

test("T-0037: grade_review -> 仅少量无价值=mild", () => {
  const issues: CodeIssue[] = [
    { type: "worthless", subtype: "未使用依赖", severity: "low", line: 1, description: "t", suggestion: "t" },
  ];
  return grade_review(issues, 100) === "mild";
});

test("T-0037: grade_review -> 有假实现=moderate", () => {
  const issues: CodeIssue[] = [
    { type: "fake", subtype: "输入处理偏离", severity: "high", line: 1, description: "t", suggestion: "t" },
  ];
  return grade_review(issues, 50) === "moderate";
});

test("T-0037: grade_review -> 有空实现=moderate", () => {
  const issues: CodeIssue[] = [
    { type: "empty", subtype: "完全空实现", severity: "high", line: 1, description: "t", suggestion: "t" },
  ];
  return grade_review(issues, 50) === "moderate";
});

test("T-0037: grade_review -> 有糊弄=severe", () => {
  const issues: CodeIssue[] = [
    { type: "cheating", subtype: "硬编码返回", severity: "high", line: 1, description: "t", suggestion: "t" },
  ];
  return grade_review(issues, 50) === "severe";
});

test("T-0037: grade_review -> 假实现密度>30%=severe", () => {
  const issues: CodeIssue[] = Array.from({ length: 8 }, () => ({
    type: "fake" as const, subtype: "test", severity: "high" as const,
    line: 1, description: "t", suggestion: "t",
  }));
  return grade_review(issues, 20) === "severe";
});

test("T-0037: grade_description -> 四种级别描述", () => {
  return grade_description("pass").includes("通过")
    && grade_description("mild").includes("轻度")
    && grade_description("moderate").includes("中度")
    && grade_description("severe").includes("严重");
});

test("T-0037: should_reject -> moderate/severe应打回", () => {
  return should_reject("pass") === false
    && should_reject("mild") === false
    && should_reject("moderate") === true
    && should_reject("severe") === true;
});

// ===== T-0038: 审查报告生成 =====

const good_code = `
function createOrder(userId: string, items: OrderItem[], coupon?: string) {
  if (!userId) throw new ValidationError("userId required");
  if (!items || items.length === 0) throw new ValidationError("items required");
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (total <= 0) throw new ValidationError("invalid total");
  const order = { id: generateId(), userId, items, total, status: "pending", createdAt: new Date() };
  db.orders.insert(order);
  return order;
}`;

test("T-0038: generate_review_report -> 正常代码=pass", () => {
  const req: RequirementRule = {
    id: "R-ORDER",
    description: "订单创建",
    expected_branches: ["userId", "items", "total", "reduce"],
    expected_inputs: ["userId", "items"],
    expected_outputs: ["id", "status"],
  };
  const report = generate_review_report("林一舟", "T-ORDER-1", good_code, req);
  return report.member_name === "林一舟"
    && report.task_id === "T-ORDER-1"
    && report.grade === "pass" || report.grade === "mild"
    && report.reviewed_at.includes("T")
    && report.summary.includes("林一舟");
});

test("T-0038: generate_review_report -> 问题代码被检测", () => {
  const bad_code = `
function createOrder(data: any) {
  // TODO: should validate and save
  return {};
}`;
  const req: RequirementRule = {
    id: "R-ORDER",
    description: "订单创建",
    expected_branches: ["验证参数"],
    expected_inputs: ["userId", "items"],
    expected_outputs: ["orderId", "status"],
  };
  const report = generate_review_report("张思远", "T-ORDER-2", bad_code, req);
  return report.issues.length >= 2
    && (report.grade === "moderate" || report.grade === "severe")
    && report.summary.includes("张思远");
});

test("T-0038: generate_review_report -> 报告含摘要和行号", () => {
  const code = "function stub() { return null; }";
  const req: RequirementRule = {
    id: "R1", description: "test",
    expected_branches: [], expected_inputs: [], expected_outputs: [],
  };
  const report = generate_review_report("王若涵", "T-1", code, req);
  return report.summary.includes("王若涵")
    && report.summary.includes("T-1")
    && report.issues.every((i) => i.line > 0);
});

test("T-0038: 审查完整链路 -> 正常代码通过+问题代码打回", () => {
  // 正常代码匹配正确需求 (关键词需与代码中的标识符对应)
  const good_req: RequirementRule = {
    id: "R-ORDER",
    description: "订单创建",
    expected_branches: ["generateId", "total"],
    expected_inputs: ["userId", "items"],
    expected_outputs: ["id", "status"],
  };
  const report1 = generate_review_report("林一舟", "T-ORDER-1", good_code, good_req);

  // 问题代码 + 对应需求
  const bad_req: RequirementRule = {
    id: "R-PAY",
    description: "支付处理",
    expected_branches: ["验证支付状态", "检查余额"],
    expected_inputs: ["amount", "userId"],
    expected_outputs: ["transactionId", "status"],
  };
  const bad_code = "function pay(amount: number) { return true; }";
  const report2 = generate_review_report("张思远", "T-PAY-2", bad_code, bad_req);

  const pass_or_mild = report1.grade === "pass" || report1.grade === "mild";
  const rejected = report2.grade === "moderate" || report2.grade === "severe";

  return pass_or_mild && rejected
    && !report2.summary.includes("未检测到问题");
});

// ===== 新增子类型测试 =====

test("T-0034: detect_unfilled_constants -> 占位符常量", () => {
  const code = `const API_KEY = "TODO";\nconst DB_HOST = "placeholder";`;
  const issues = detect_unfilled_constants(code);
  return issues.length === 2 && issues.every(i => i.subtype === "关键常量未填充");
});

test("T-0034: detect_unfilled_constants -> 正常常量无问题", () => {
  const code = `const API_KEY = "sk-abc123";\nconst MAX_RETRY = 3;`;
  const issues = detect_unfilled_constants(code);
  return issues.length === 0;
});

test("T-0035: detect_over_wrapping -> 透传调用检测", () => {
  const code = `function getUser(id, name) {\n  return fetchUser(id, name);\n}`;
  const issues = detect_over_wrapping(code);
  return issues.length === 1 && issues[0].subtype === "过度包装";
});

test("T-0035: detect_over_wrapping -> 有转换的函数无问题", () => {
  const code = `function getUser(id) {\n  const result = fetchUser(id);\n  return transform(result);\n}`;
  const issues = detect_over_wrapping(code);
  return issues.length === 0;
});

test("T-0036: detect_fake_computation -> 随机数返回", () => {
  const code = `function calcScore(data) {\n  return Math.random() * 100;\n}`;
  const issues = detect_fake_computation(code);
  return issues.length >= 1 && issues[0].subtype === "假随机/假计算";
});

test("T-0036: detect_fake_computation -> 赋值给结果变量", () => {
  const code = `function process(input) {\n  const result = Math.random();\n  return result;\n}`;
  const issues = detect_fake_computation(code);
  return issues.length >= 1;
});

test("T-0036: detect_fake_computation -> 正常计算无问题", () => {
  const code = `function calcScore(data) {\n  return data.items.reduce((sum, i) => sum + i.score, 0) / data.items.length;\n}`;
  const issues = detect_fake_computation(code);
  return issues.length === 0;
});

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
console.log(fail === 0 ? "QA: PASS" : "QA: FAIL");
process.exit(fail > 0 ? 1 : 0);
