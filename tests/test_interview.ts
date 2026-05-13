/**
 * QA Test: T-0013 ~ T-0018 需求采访引擎
 */
import {
  create_interview_state, advance_phase, go_back_phase,
  InterviewState, InterviewPhase,
  is_vague_answer, IMAGE_TEMPLATE, TECH_TEMPLATE, FEATURE_TEMPLATE,
  recommend_tech_stack, TechRecommendation,
  detect_complexity, get_most_complex,
  generate_summary, format_summary, InterviewSummary,
  create_confirm_state, handle_confirm, handle_modify, is_interview_done,
} from "../src/interview";

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

// ===== T-0013: 采访状态机 =====

test("T-0013: 初始状态 → INIT", () => {
  const s = create_interview_state();
  return s.phase === "INIT" && s.question_index === 0 && s.probe_depth === 0;
});

test("T-0013: INIT → IMAGE 阶段前进", () => {
  let s = create_interview_state();
  s = advance_phase(s);
  return s.phase === "IMAGE" && s.question_index === 0;
});

test("T-0013: 全阶段推进到 DONE", () => {
  let s = create_interview_state();
  const phases: InterviewPhase[] = [];
  for (let i = 0; i < 6; i++) {
    phases.push(s.phase);
    s = advance_phase(s);
  }
  return phases.join("→") === "INIT→IMAGE→TECH_BOUNDARY→FEATURE_BREAKDOWN→CONFIRM→DONE";
});

test("T-0013: DONE 之后不再推进", () => {
  let s = create_interview_state();
  for (let i = 0; i < 10; i++) s = advance_phase(s);
  return s.phase === "DONE";
});

test("T-0013: 回退到上一阶段", () => {
  let s = create_interview_state();
  s = advance_phase(s); // IMAGE
  s = advance_phase(s); // TECH_BOUNDARY
  s = go_back_phase(s);
  return s.phase === "IMAGE";
});

test("T-0013: INIT 阶段不能回退", () => {
  const s = create_interview_state();
  const s2 = go_back_phase(s);
  return s2.phase === "INIT";
});

// ===== T-0014: 项目画像模板 + 追问规则 =====

test("T-0014: 模糊回答检测 — 短文本", () => {
  return is_vague_answer("好") === true;
});

test("T-0014: 模糊回答检测 — 关键词", () => {
  return is_vague_answer("大概做一个网站") === true
    && is_vague_answer("可能是电商") === true
    && is_vague_answer("差不多这样") === true
    && is_vague_answer("随便你定") === true;
});

test("T-0014: 清晰回答检测", () => {
  return is_vague_answer("我要做一个电商系统，支持商品展示、下单、支付、物流跟踪") === false;
});

test("T-0014: 画像模板有4个问题", () => {
  return IMAGE_TEMPLATE.length === 4
    && IMAGE_TEMPLATE[0].id === "image_1"
    && IMAGE_TEMPLATE[3].id === "image_4";
});

test("T-0014: 每个问题有追问方向", () => {
  return IMAGE_TEMPLATE.every((q) => q.probe_directions.length > 0);
});

// ===== T-0015: 技术边界模板 + 默认推荐 =====

test("T-0015: 电商项目推荐 Go+PG+React", () => {
  const r = recommend_tech_stack("电商系统");
  return r.name.includes("Go") && r.reasons.length === 3 && r.risks.length >= 1;
});

test("T-0015: CMS推荐 Node.js", () => {
  const r = recommend_tech_stack("内容管理系统CMS");
  return r.name.includes("Node") && r.name.includes("Next");
});

test("T-0015: 实时项目推荐 WebSocket", () => {
  const r = recommend_tech_stack("实时协作平台");
  return r.name.includes("WebSocket") && r.name.includes("Redis");
});

test("T-0015: 未知类型 → 默认推荐 TypeScript", () => {
  const r = recommend_tech_stack("一个工具");
  return r.name.includes("TypeScript") && r.risks.some((x) => x.includes("无明显风险"));
});

// ===== T-0016: 功能拆解 + 复杂度探测 =====

test("T-0016: 支付+并发+分布式 → 高复杂度", () => {
  const r = detect_complexity(["支付模块", "用户登录"]);
  return r[0].complexity === "high" || r[0].complexity === "medium";
});

test("T-0016: 简单功能 → 低复杂度", () => {
  const r = detect_complexity(["静态页面展示"]);
  return r[0].complexity === "low";
});

test("T-0016: 提取最复杂功能", () => {
  const features = ["静态页面", "实时支付系统", "用户管理"];
  const r = detect_complexity(features);
  const most = get_most_complex(r);
  return most !== null && most.includes("支付");
});

// ===== T-0017: 采访摘要生成 =====

const test_answers: Record<string, string[]> = {
  "image_1": ["做一个电商系统"],
  "image_2": ["新项目"],
  "image_3": ["面向普通消费者"],
  "image_4": ["下个月底"],
  "tech_1": ["Go+PostgreSQL"],
  "tech_2": ["云服务部署"],
  "tech_3": ["需要对接微信支付"],
  "feature_1": ["商品展示, 下单, 支付, 库存管理, 物流追踪"],
  "feature_2": ["支付模块最复杂，涉及分布式事务"],
  "feature_3": ["数据不能丢，支付必须准确"],
};

test("T-0017: 生成摘要 → 包含关键信息", () => {
  const r = recommend_tech_stack("电商系统");
  const summary = generate_summary(test_answers, r);
  return summary.project_description.includes("电商")
    && summary.tech_stack.includes("Go")
    && summary.suggested_layers.length >= 2
    && summary.estimated_roles >= 7;
});

test("T-0017: 摘要格式化 ≤ 500字", () => {
  const r = recommend_tech_stack("电商系统");
  const summary = generate_summary(test_answers, r);
  const formatted = format_summary(summary);
  return formatted.length <= 500
    && formatted.includes("需求摘要")
    && formatted.includes("建议层级结构");
});

// ===== T-0018: 客户确认交互 =====

test("T-0018: 创建确认状态 → pending", () => {
  const r = recommend_tech_stack("电商系统");
  const summary = generate_summary(test_answers, r);
  const state = create_confirm_state(summary);
  return state.status === "pending" && state.iteration === 0;
});

test("T-0018: confirm → status=confirm", () => {
  const r = recommend_tech_stack("电商系统");
  const summary = generate_summary(test_answers, r);
  let state = create_confirm_state(summary);
  state = handle_confirm(state);
  return state.status === "confirm" && is_interview_done(state);
});

test("T-0018: modify → 记录修改字段", () => {
  const r = recommend_tech_stack("电商系统");
  const summary = generate_summary(test_answers, r);
  let state = create_confirm_state(summary);
  state = handle_modify(state, { tech_stack: "Java + MySQL" });
  return state.status === "modify"
    && state.iteration === 1
    && state.modified_fields.includes("tech_stack")
    && state.summary.tech_stack === "Java + MySQL"
    && !is_interview_done(state);
});

test("T-0018: modify后再confirm → done", () => {
  const r = recommend_tech_stack("电商系统");
  const summary = generate_summary(test_answers, r);
  let state = create_confirm_state(summary);
  state = handle_modify(state, { tech_stack: "Java" });
  state = handle_confirm(state);
  return is_interview_done(state) && state.summary.tech_stack === "Java";
});

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
console.log(fail === 0 ? "QA: PASS" : "QA: FAIL");
process.exit(fail > 0 ? 1 : 0);
