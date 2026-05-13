/**
 * 代码审查引擎
 *
 * T-0033: 假实现检测器 (5 subtypes)
 * T-0034: 空实现检测器 (5 subtypes)
 * T-0035: 无价值代码检测器 (6 subtypes)
 * T-0036: 糊弄代码检测器 (6 subtypes)
 * T-0037: 审查结论定级
 * T-0038: 审查报告生成
 */

// ============ 通用类型 ============

export interface CodeIssue {
  type: "fake" | "empty" | "worthless" | "cheating";
  subtype: string;
  severity: "low" | "medium" | "high";
  line: number;
  description: string;
  suggestion: string;
}

export type ReviewGrade = "pass" | "mild" | "moderate" | "severe";

export interface ReviewResult {
  member_name: string;
  task_id: string;
  issues: CodeIssue[];
  grade: ReviewGrade;
  summary: string;
  reviewed_at: string;
}

export interface RequirementRule {
  id: string;
  description: string;
  expected_branches: string[]; // 期望的代码分支关键词
  expected_inputs: string[];   // 期望的输入字段
  expected_outputs: string[];  // 期望的输出字段
}

// ============ T-0033: 假实现检测器 ============

/**
 * 1. 输入处理偏离: 对比需求字段数 vs 实际入参
 */
export function detect_input_deviation(
  code: string,
  expected_inputs: string[]
): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const code_lower = code.toLowerCase();

  for (const input of expected_inputs) {
    if (!code_lower.includes(input.toLowerCase())) {
      const line = find_line_containing(code, "function") || find_line_containing(code, "const") || 1;
      issues.push({
        type: "fake",
        subtype: "输入处理偏离",
        severity: "high",
        line,
        description: `缺少期望的输入字段: ${input}`,
        suggestion: `在函数参数或请求解析中添加 ${input} 的处理`,
      });
    }
  }

  return issues;
}

/**
 * 2. 输出结构偏离: 对比下游契约 vs 实际返回值
 */
export function detect_output_deviation(
  code: string,
  expected_outputs: string[]
): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const code_lower = code.toLowerCase();

  for (const output of expected_outputs) {
    if (!code_lower.includes(output.toLowerCase())) {
      const return_line = find_line_containing(code, "return");
      issues.push({
        type: "fake",
        subtype: "输出结构偏离",
        severity: "high",
        line: return_line,
        description: `返回结构中缺少期望的字段: ${output}`,
        suggestion: `在返回值中添加 ${output} 字段`,
      });
    }
  }

  return issues;
}

/**
 * 3. 业务规则遗漏: 需求规则逐条映射到代码分支
 */
export function detect_business_rule_omission(
  code: string,
  expected_branches: string[]
): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const code_lower = code.toLowerCase();

  for (const branch of expected_branches) {
    const keyword = branch.toLowerCase();
    if (!code_lower.includes(keyword)) {
      issues.push({
        type: "fake",
        subtype: "业务规则遗漏",
        severity: "high",
        line: 1,
        description: `业务规则未在代码中体现: ${branch}`,
        suggestion: `添加条件分支处理: if (${branch}) { ... }`,
      });
    }
  }

  return issues.filter((_, i) => i < 5); // 最多5条
}

/**
 * 4. 边界条件遗漏: 检测空值/零值/极限值/并发冲突处理
 */
export function detect_boundary_omission(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];

  // 检测函数参数是否有空值检查
  const function_params = extract_function_params(code);
  for (const func of function_params) {
    if (func.params.length > 0 && func.body) {
      const has_null_check = /\bif\s*\(/.test(func.body) &&
        (func.body.toLowerCase().includes("null") ||
         func.body.toLowerCase().includes("undefined") ||
         func.body.toLowerCase().includes("!"));
      if (!has_null_check && func.body.trim().length > 10) {
        issues.push({
          type: "fake",
          subtype: "边界条件遗漏",
          severity: "medium",
          line: func.start_line,
          description: `函数缺少入参空值检查 (params: ${func.params.join(", ")})`,
          suggestion: "添加入参空值/零值边界检查: if (!param) throw new Error(...)",
        });
      }
    }
  }

  // 数组/集合操作无边界检查
  // 排除：解构赋值 (const [a,b])、数组字面量 ([1,2])、可选链(?.)、at()安全访问
  const is_destructuring = /\b(?:const|let|var)\s*\[/.test(code) || /\(\s*\[/.test(code);
  if (!is_destructuring && code.includes("[") && code.includes("]") && !code.includes(".length") && !code.includes("?.") && !code.includes("at(")) {
    const line = find_line_containing(code, "[");
    issues.push({
      type: "fake",
      subtype: "边界条件遗漏",
      severity: "medium",
      line,
      description: "数组访问缺少越界检查",
      suggestion: "访问数组前检查索引: if (index < arr.length) { ... }",
    });
  }

  // 并发相关: 有共享状态无锁
  if (/\bmap\[|\bMap<|\bvar\s+\w+\s+map\[/.test(code) && !/\b(sync\.|Mutex|RWMutex|\.lock|\.unlock|atomic\.)/.test(code)) {
    issues.push({
      type: "fake",
      subtype: "边界条件遗漏",
      severity: "high",
      line: 1,
      description: "检测到共享状态(map)但无并发保护",
      suggestion: "使用 sync.Mutex 或 sync.RWMutex 保护共享状态",
    });
  }

  return issues;
}

/**
 * 5. 错误路径假覆盖: 检测catch-all异常处理
 */
export function detect_fake_error_handling(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];

  // 空的 catch 块
  if (code.includes("catch") && code.includes("{}") ||
      code.includes("catch") && code.includes("()")) {
    // 检查 catch 块内容
    const catch_pattern = /catch\s*(\([^)]*\))?\s*\{([^}]*)\}/g;
    let match;
    while ((match = catch_pattern.exec(code)) !== null) {
      const catch_body = match[2].trim();
      // catch 块为空或仅有注释/日志
      if (catch_body.length === 0 ||
          catch_body.startsWith("//") ||
          catch_body === "console.log" ||
          catch_body === "console.error" ||
          catch_body.startsWith("// TODO")) {
        issues.push({
          type: "fake",
          subtype: "错误路径假覆盖",
          severity: "high",
          line: get_line_number(code, match.index),
          description: "catch 块为空或仅有占位日志，未做实际错误处理",
          suggestion: "实现具体错误恢复逻辑: 重试/降级/补偿事务/通知",
        });
      }
    }
  }

  // try 但没有对应的错误类型区分
  if (code.includes("try {") && code.includes("catch") && !code.includes("instanceof") && !code.includes("Error")) {
    issues.push({
      type: "fake",
      subtype: "错误路径假覆盖",
      severity: "medium",
      line: find_line_containing(code, "try {"),
      description: "异常处理未区分错误类型，可能掩盖严重错误",
      suggestion: "根据错误类型分别处理: catch (ValidationError e) { ... } catch (DBError e) { ... }",
    });
  }

  // 函数返回 error 但调用方未检查
  const returns_error = /\breturn\s+(nil|undefined|null),\s*(err|error)/i.test(code) ||
    /\breturn\s+(err|error)/i.test(code);
  if (returns_error && !code.includes("if err") && !code.includes("if (err") && !code.includes("if error")) {
    issues.push({
      type: "fake",
      subtype: "错误路径假覆盖",
      severity: "medium",
      line: 1,
      description: "函数返回错误类型但未检测到调用方对错误的检查",
      suggestion: "在调用方添加: if err != nil { return err } 或 try-catch",
    });
  }

  return issues;
}

/**
 * 综合假实现检测 (涵盖5个子类)
 */
export function detect_fake_implementation(
  code: string,
  requirements: RequirementRule
): CodeIssue[] {
  return [
    ...detect_input_deviation(code, requirements.expected_inputs),
    ...detect_output_deviation(code, requirements.expected_outputs),
    ...detect_business_rule_omission(code, requirements.expected_branches),
    ...detect_boundary_omission(code),
    ...detect_fake_error_handling(code),
  ];
}

// ============ T-0034: 空实现检测器 ============

/**
 * 计算有效语句数 (排除注释/空行/仅括号/仅return null/TODO)
 */
export function count_effective_statements(code: string): number {
  // 预处理: 将单行函数拆分为多行，提取函数体
  const expanded = code.replace(
    /(function\s+\w*\s*\([^)]*\))\s*\{([^}]*)\}/g,
    "$1 {\n$2\n}"
  );

  const lines = expanded.split("\n");
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // 跳过空行
    if (trimmed.length === 0) continue;
    // 跳过注释
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;
    // 跳过仅括号 或 以{结尾的行(函数签名等)
    if (trimmed === "{" || trimmed === "}" || trimmed === "};" || trimmed === ");" || trimmed.endsWith("{")) continue;
    // 跳过空return/throw
    if (/^return\s*;?\s*$/.test(trimmed)) continue;
    if (/^throw\s*;?\s*$/.test(trimmed)) continue;
    // 跳过占位return: return null/undefined/0/nil/true/false/""/''/{}/[]
    if (/^return\s+(null|undefined|nil|true|false|0|-1|\"\"|''|\{\}|\[\]);?\s*$/.test(trimmed)) continue;
    // 跳过仅 TODO/FIXME 注释
    if (/^\/\/\s*(TODO|FIXME)/.test(trimmed)) continue;
    // 跳过 import/package/module 声明
    if (trimmed.startsWith("import ") || trimmed.startsWith("export ") || trimmed.startsWith("package ") || trimmed.startsWith("module ")) continue;
    // 跳过类型声明/接口声明 (无实现)
    if (trimmed.startsWith("type ") || trimmed.startsWith("interface ")) continue;
    // 跳过空函数声明行
    if (trimmed.startsWith("func ") && trimmed.endsWith("{}")) continue;
    if (trimmed.startsWith("function") && /\{\s*\}$/.test(trimmed)) continue;
    // 跳过仅日志行
    if (/^console\.(log|error|warn)\(/.test(trimmed)) continue;

    // 有效语句
    count++;
  }

  return count;
}

/**
 * 检查是否仅有 TODO 而无实现
 */
export function has_todo_without_implementation(code: string): boolean {
  const has_todo = code.includes("TODO") || code.includes("FIXME") || code.includes("待实现");
  if (!has_todo) return false;

  const effective = count_effective_statements(code);
  return effective <= 1;
}

/**
 * 空实现检测器
 */
export function detect_empty_implementation(code: string, function_name?: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const effective = count_effective_statements(code);

  // 1. 有效语句数过低
  if (effective <= 0) {
    issues.push({
      type: "empty",
      subtype: "完全空实现",
      severity: "high",
      line: 1,
      description: `${function_name || "函数"} 无有效实现语句 (有效语句数: ${effective})`,
      suggestion: "实现完整的业务逻辑",
    });
  } else if (effective === 1) {
    issues.push({
      type: "empty",
      subtype: "近乎空实现",
      severity: "high",
      line: 1,
      description: `仅有 1 条有效语句，疑似占位实现`,
      suggestion: "补充完整的业务逻辑处理",
    });
  }

  // 2. TODO + 无实现 → 重点标记
  if (has_todo_without_implementation(code)) {
    issues.push({
      type: "empty",
      subtype: "TODO占位无实现",
      severity: "high",
      line: find_line_containing(code, "TODO") || 1,
      description: "代码中仅有 TODO 标记，无实际实现",
      suggestion: "移除 TODO 并完成实现，或标记为待排期",
    });
  }

  // 3. 函数返回固定值 (非错误)
  const return_patterns = [
    { pattern: /return\s+(true|false);?\s*$/, msg: "函数始终返回固定布尔值" },
    { pattern: /return\s+"";?\s*$/, msg: "函数始终返回空字符串" },
    { pattern: /return\s+\[\];?\s*$/, msg: "函数始终返回空数组" },
    { pattern: /return\s+\{\};?\s*$/, msg: "函数始终返回空对象" },
    { pattern: /return\s+null;?\s*$/, msg: "函数始终返回 null" },
    { pattern: /return\s+undefined;?\s*$/, msg: "函数始终返回 undefined" },
    { pattern: /return\s+0;?\s*$/, msg: "函数始终返回 0" },
    { pattern: /return\s+nil;?\s*$/, msg: "函数始终返回 nil" },
  ];

  const return_line = code.split("\n").find((l) => /^\s*return\s/.test(l.trim()));
  if (return_line && effective <= 2) {
    for (const { pattern, msg } of return_patterns) {
      if (pattern.test(return_line.trim())) {
        issues.push({
          type: "empty",
          subtype: "固定返回值",
          severity: "high",
          line: find_line_containing(code, "return") || 1,
          description: msg,
          suggestion: "实现真实的数据获取和处理逻辑",
        });
        break;
      }
    }
  }

  // 4. 仅有 console.log / fmt.Println 等调试输出
  const all_lines = code.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const non_debug_lines = all_lines.filter((l) =>
    !l.startsWith("//") &&
    !l.startsWith("console.") &&
    !l.startsWith("fmt.Print") &&
    !l.startsWith("log.") &&
    !l.startsWith("print(") &&
    l !== "{" && l !== "}" && l !== "};"
  );
  if (non_debug_lines.length <= 1) {
    issues.push({
      type: "empty",
      subtype: "仅有调试输出",
      severity: "medium",
      line: 1,
      description: "代码中仅有日志/打印语句，无业务逻辑",
      suggestion: "移除调试代码，实现业务逻辑",
    });
  }

  return issues;
}

/**
 * 关键常量未填充: 常量定义为占位符值，从未被实际赋值
 */
export function detect_unfilled_constants(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const lines = code.split("\n");

  const placeholder_values = [
    /^["'](?:TODO|FIXME|placeholder|default|xxx|test|example|sample|changeme|replace_me|TBD)["']$/i,
    /^["']['"]$/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const const_match = line.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Z_][A-Z0-9_]*)\s*(?::\s*\w+\s*)?=\s*(.+?)[\s;]*$/);
    if (const_match) {
      const name = const_match[1];
      const value = const_match[2].trim();
      if (placeholder_values.some((p) => p.test(value))) {
        issues.push({
          type: "empty",
          subtype: "关键常量未填充",
          severity: "medium",
          line: i + 1,
          description: `常量 ${name} 的值为占位符: ${value}`,
          suggestion: "替换为实际的配置值",
        });
      }
    }
  }

  return issues;
}

// ============ T-0035: 无价值代码检测器 ============

/**
 * 1. 死代码检测: 定义但从未使用的函数/变量
 */
export function detect_dead_code(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];

  // 检测定义了但代码逻辑中未真正使用的导出函数
  const export_funcs = extract_exported_functions(code);
  for (const func of export_funcs) {
    if (func.body && count_effective_statements(func.body) === 0) {
      issues.push({
        type: "worthless",
        subtype: "死代码",
        severity: "medium",
        line: func.start_line,
        description: `导出函数 ${func.name} 无有效实现`,
        suggestion: "移除或实现该导出函数",
      });
    }
  }

  return issues;
}

/**
 * 2. 无副作用写入: 变量被赋值为固定值但从未被读取
 */
export function detect_no_side_effect_writes(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];

  // 检测 const x = ... ; // 后续未使用
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const const_match = line.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(.+);?/);
    if (const_match) {
      const var_name = const_match[1];
      const value = const_match[2];
      // 检查后续行是否使用该变量
      const rest_code = lines.slice(i + 1).join("\n");
      if (!rest_code.includes(var_name) && value.length < 5) {
        issues.push({
          type: "worthless",
          subtype: "无副作用写入",
          severity: "low",
          line: i + 1,
          description: `变量 ${var_name} 赋值为常量但后续未使用`,
          suggestion: `移除未使用的变量 ${var_name}`,
        });
      }
    }
  }

  return issues;
}

/**
 * 3. 复制粘贴残留: 检测高度相似代码段
 */
export function detect_copy_paste_residue(
  code: string,
  sibling_codes?: string[]
): CodeIssue[] {
  const issues: CodeIssue[] = [];

  if (!sibling_codes || sibling_codes.length === 0) return issues;

  const code_normalized = normalize_code(code);

  for (const sibling of sibling_codes) {
    const sibling_normalized = normalize_code(sibling);
    const similarity = calculate_similarity(code_normalized, sibling_normalized);

    if (similarity > 0.9) {
      issues.push({
        type: "worthless",
        subtype: "复制粘贴残留",
        severity: "medium",
        line: 1,
        description: `代码与另一文件相似度 ${(similarity * 100).toFixed(1)}%，疑似复制粘贴`,
        suggestion: "提取公共模块或核实是否需要差异化实现",
      });
      break; // 仅报一次
    }
  }

  return issues;
}

/**
 * 4. 未使用依赖检测
 */
export function detect_unused_imports(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // 匹配 import { X, Y } 或 import X from
    const import_match = line.match(/^import\s+(?:\{([^}]*)\}|(\w+))\s+from\s+['"]([^'"]+)['"];?/);
    if (import_match) {
      const named_group = import_match[1]; // 花括号内的内容 (如 "useState, useEffect")
      const single_import = import_match[2]; // 单个默认导入

      let ids: string[] = [];
      if (named_group) {
        ids = named_group.split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      } else if (single_import) {
        ids = [single_import];
      }

      const rest_code = lines.slice(i + 1).join("\n");
      for (const id of ids) {
        if (!rest_code.includes(id)) {
          issues.push({
            type: "worthless",
            subtype: "未使用依赖",
            severity: "low",
            line: i + 1,
            description: `import 的 ${id} 在后续代码中未使用`,
            suggestion: `移除未使用的导入: ${id}`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * 过度包装: 函数体仅调用另一个同签名函数，无任何转换
 */
export function detect_over_wrapping(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const funcs = extract_functions_with_params(code);

  for (const func of funcs) {
    if (!func.body || func.params.length === 0) continue;

    const body_lines = func.body.trim().split("\n").filter((l) => l.trim().length > 0);
    if (body_lines.length !== 1) continue;

    const single_line = body_lines[0].trim();
    const call_match = single_line.match(/^return\s+(\w+)\(([^)]*)\);?$/);
    if (call_match) {
      const called_params = call_match[2].split(",").map((p) => p.trim()).filter(Boolean);
      const same_params = func.params.length === called_params.length &&
        func.params.every((p, i) => called_params[i] === p);
      if (same_params && call_match[1] !== func.name) {
        issues.push({
          type: "worthless",
          subtype: "过度包装",
          severity: "low",
          line: func.start_line,
          description: `函数 ${func.name} 仅透传调用 ${call_match[1]}，无任何转换`,
          suggestion: `直接使用 ${call_match[1]} 而非多一层包装`,
        });
      }
    }
  }

  return issues;
}

/**
 * 综合无价值代码检测 (涵盖6个子类)
 */
export function detect_worthless_code(
  code: string,
  sibling_codes?: string[]
): CodeIssue[] {
  return [
    ...detect_dead_code(code),
    ...detect_no_side_effect_writes(code),
    ...detect_over_wrapping(code),
    ...detect_copy_paste_residue(code, sibling_codes),
    ...detect_unused_imports(code),
  ];
}

// ============ T-0036: 糊弄代码检测器 ============

/**
 * 1. 硬编码返回: 函数忽略入参，始终返回常量
 */
export function detect_hardcoded_return(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const funcs = extract_functions_with_params(code);

  for (const func of funcs) {
    if (func.params.length > 0 && func.body) {
      const params_used = func.params.some((p) => func.body?.includes(p) ?? false);
      const has_return = func.body.includes("return");

      if (has_return && !params_used) {
        // 检查返回是否为硬编码值
        const return_match = func.body.match(/return\s+(['"\d].*|true|false|null|undefined|nil);?/);
        if (return_match) {
          issues.push({
            type: "cheating",
            subtype: "硬编码返回",
            severity: "high",
            line: func.start_line,
            description: `函数 ${func.name} 接收参数但未使用，始终返回硬编码值: ${return_match[1]}`,
            suggestion: "使用入参进行计算，实现真实的业务逻辑",
          });
        }
      }
    }
  }

  return issues;
}

/**
 * 2. 空 catch 块检测
 */
export function detect_empty_catch(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];

  // catch {} 或 catch (e) {} (仅空格)
  const catch_regex = /catch\s*(\([^)]*\))?\s*\{\s*\}/g;
  let match;
  while ((match = catch_regex.exec(code)) !== null) {
    issues.push({
      type: "cheating",
      subtype: "空catch块",
      severity: "high",
      line: get_line_number(code, match.index),
      description: "catch 块完全为空，错误被静默吞噬",
      suggestion: "至少记录错误日志，并实现必要的恢复或上报逻辑",
    });
  }

  // catch { /* 只有注释 */ }
  const catch_with_comment_regex = /catch\s*(\([^)]*\))?\s*\{\s*\/\/[^}]*\}/g;
  while ((match = catch_with_comment_regex.exec(code)) !== null) {
    issues.push({
      type: "cheating",
      subtype: "空catch块(仅注释)",
      severity: "high",
      line: get_line_number(code, match.index),
      description: "catch 块仅有注释，无实际错误处理",
      suggestion: "实现错误处理逻辑",
    });
  }

  return issues;
}

/**
 * 3. 注释替代实现: "应该做X" + 下一行跳过
 */
export function detect_comment_replacing_implementation(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 检测"应该做X" 模式的注释
    const intent_patterns = [
      /\/\/\s*(应该|需要|TODO|FIXME|待).*(实现|处理|检查|验证|调用|查询|写入|发送)/,
      /\/\/\s*(should|need|TODO|FIXME).*(implement|handle|check|validate|call|query|write|send)/i,
    ];

    const is_intent_comment = intent_patterns.some((p) => p.test(line));

    if (is_intent_comment) {
      // 检查接下来的几行是否有实际实现
      const next_lines = lines.slice(i + 1, Math.min(i + 4, lines.length));
      const has_implementation = next_lines.some((l) => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith("//") && !t.startsWith("return") && t !== "{" && t !== "}";
      });

      if (!has_implementation) {
        issues.push({
          type: "cheating",
          subtype: "注释替代实现",
          severity: "high",
          line: i + 1,
          description: `注释声明了意图但后续无实现: "${line.trim()}"`,
          suggestion: "移除占位注释并编写实际实现代码",
        });
      }
    }
  }

  return issues;
}

/**
 * 4. 需求规则链 vs 代码执行路径对比
 */
export function detect_requirement_code_mismatch(
  code: string,
  expected_rules: string[]
): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const code_lower = code.toLowerCase();

  for (const rule of expected_rules) {
    const keywords = rule.toLowerCase().split(/\s+/).filter((k) => k.length > 2);

    // 如果规则的关键词在代码中全部缺失
    const all_missing = keywords.every((kw) => !code_lower.includes(kw));
    if (all_missing && keywords.length > 0) {
      issues.push({
        type: "cheating",
        subtype: "需求代码不匹配",
        severity: "high",
        line: 1,
        description: `需求规则在代码中无对应实现: "${rule}"`,
        suggestion: `添加代码逻辑来实现该需求规则: ${rule}`,
      });
    }
  }

  return issues;
}

/**
 * 5. 仅返回入参 (透传无处理)
 */
export function detect_pass_through(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const funcs = extract_functions_with_params(code);

  for (const func of funcs) {
    if (func.params.length > 0 && func.body) {
      const body_trimmed = func.body.trim();
      const body_lines = body_trimmed.split("\n").filter((l) => l.trim().length > 0);

      // 单行: return param;
      if (body_lines.length <= 2) {
        for (const param of func.params) {
          if (body_trimmed.includes(`return ${param}`) || body_trimmed.includes(`return${param}`)) {
            issues.push({
              type: "cheating",
              subtype: "透传无处理",
              severity: "high",
              line: func.start_line,
              description: `函数 ${func.name} 仅透传入参 ${param} 而无任何处理`,
              suggestion: "添加业务逻辑处理，而非简单透传",
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * 6. 假参数校验: 仅抛异常但不处理
 */
export function detect_fake_validation(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];

  // 检测: if (!x) throw Error(...) 但后续无恢复/兜底逻辑
  const validation_block = /if\s*\(!\s*\w+\s*\)\s*\{\s*(throw\s+|return\s+)/g;
  if (validation_block.test(code)) {
    // 检查是否有 else 或 try-catch 包裹
    const has_fallback = /\belse\b/.test(code) || /\btry\s*\{/.test(code);
    if (!has_fallback && code.split("\n").filter((l) => l.trim().length > 0).length <= 5) {
      issues.push({
        type: "cheating",
        subtype: "假参数校验",
        severity: "medium",
        line: 1,
        description: "仅有参数校验和异常抛出，无正常业务路径",
        suggestion: "补充正常业务处理逻辑，而非仅校验参数后抛出异常",
      });
    }
  }

  return issues;
}

/**
 * 假随机/假计算: 声称复杂计算但内部是 random() 或简单估算
 */
export function detect_fake_computation(code: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/return\s+.*(?:Math\.random|random\(\)|rand\(\)|rand\.)/.test(line)) {
      issues.push({
        type: "cheating",
        subtype: "假随机/假计算",
        severity: "high",
        line: i + 1,
        description: "函数返回值基于随机数，而非真实计算",
        suggestion: "实现真实的业务计算逻辑，而非用随机数伪装",
      });
    }
    if (/(?:result|output|value|score|total|amount)\s*=\s*.*(?:Math\.random|random\(\)|rand\()/.test(line)) {
      issues.push({
        type: "cheating",
        subtype: "假随机/假计算",
        severity: "high",
        line: i + 1,
        description: "计算结果基于随机数生成，而非真实业务逻辑",
        suggestion: "使用正确的业务规则计算结果值",
      });
    }
  }

  return issues;
}

/**
 * 综合糊弄代码检测 (涵盖6个子类)
 */
export function detect_cheating_code(
  code: string,
  expected_rules?: string[]
): CodeIssue[] {
  return [
    ...detect_hardcoded_return(code),
    ...detect_empty_catch(code),
    ...detect_comment_replacing_implementation(code),
    ...detect_requirement_code_mismatch(code, expected_rules || []),
    ...detect_pass_through(code),
    ...detect_fake_validation(code),
    ...detect_fake_computation(code),
  ];
}

// ============ T-0037: 审查结论定级 ============

/**
 * 根据检测到的问题定级
 *
 * 无异常 → pass
 * 仅无价值 <10% → mild
 * 有假实现或空实现 → moderate → 打回
 * 有糊弄或假实现 >30% → severe → 打回+扣分
 */
export function grade_review(issues: CodeIssue[], total_code_lines: number): ReviewGrade {
  if (issues.length === 0) return "pass";

  const fake_count = issues.filter((i) => i.type === "fake").length;
  const empty_count = issues.filter((i) => i.type === "empty").length;
  const cheating_count = issues.filter((i) => i.type === "cheating").length;
  const worthless_count = issues.filter((i) => i.type === "worthless").length;

  const has_fake = fake_count > 0;
  const has_empty = empty_count > 0;
  const has_cheating = cheating_count > 0;

  const fake_density = total_code_lines > 0 ? fake_count / total_code_lines : 0;
  const worthless_density = total_code_lines > 0 ? worthless_count / total_code_lines : 0;

  // 有糊弄或假实现 >30% → severe
  if (has_cheating || fake_density > 0.3) {
    return "severe";
  }

  // 有假实现或空实现 → moderate
  if (has_fake || has_empty) {
    return "moderate";
  }

  // 仅无价值 <10% → mild
  if (worthless_count > 0 && worthless_density < 0.1 && !has_fake && !has_empty && !has_cheating) {
    return "mild";
  }

  // 仅无价值但 ≥10% → 仍为 mild
  if (worthless_count > 0 && !has_fake && !has_empty && !has_cheating) {
    return "mild";
  }

  return "pass";
}

/**
 * 评级描述
 */
export function grade_description(grade: ReviewGrade): string {
  switch (grade) {
    case "pass": return "通过 — 未检测到问题";
    case "mild": return "轻度 — 存在少量无价值代码，可接受";
    case "moderate": return "中度 — 存在假实现或空实现，打回修改";
    case "severe": return "严重 — 存在糊弄代码或大量假实现，打回并扣满意度分";
  }
}

/**
 * 是否应该打回
 */
export function should_reject(grade: ReviewGrade): boolean {
  return grade === "moderate" || grade === "severe";
}

// ============ T-0038: 审查报告生成 ============

/**
 * 生成完整审查报告
 */
export function generate_review_report(
  member_name: string,
  task_id: string,
  code: string,
  requirements: RequirementRule,
  sibling_codes?: string[],
  expected_rules?: string[]
): ReviewResult {
  const issues: CodeIssue[] = [
    ...detect_fake_implementation(code, requirements),
    ...detect_empty_implementation(code),
    ...detect_unfilled_constants(code),
    ...detect_worthless_code(code, sibling_codes),
    ...detect_cheating_code(code, expected_rules),
  ];

  // 去重(同类型+同行号)
  const seen = new Set<string>();
  const deduped = issues.filter((i) => {
    const key = `${i.type}-${i.subtype}-${i.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const total_code_lines = count_effective_statements(code);
  const grade = grade_review(deduped, total_code_lines);

  const summary = build_summary(member_name, task_id, deduped, grade);

  return {
    member_name,
    task_id,
    issues: deduped,
    grade,
    summary,
    reviewed_at: new Date().toISOString(),
  };
}

function build_summary(
  member_name: string,
  task_id: string,
  issues: CodeIssue[],
  grade: ReviewGrade
): string {
  const lines: string[] = [];
  lines.push(`# 代码审查报告`);
  lines.push(`- 成员: ${member_name}`);
  lines.push(`- 任务: ${task_id}`);
  lines.push(`- 审查时间: ${new Date().toISOString()}`);
  lines.push(`- 结论: ${grade_description(grade)}`);
  lines.push("");

  if (issues.length === 0) {
    lines.push("未检测到问题，代码质量良好。");
    return lines.join("\n");
  }

  lines.push(`## 检测到 ${issues.length} 个问题`);
  lines.push("");

  const by_type: Record<string, CodeIssue[]> = {};
  for (const issue of issues) {
    if (!by_type[issue.type]) by_type[issue.type] = [];
    by_type[issue.type].push(issue);
  }

  const type_labels: Record<string, string> = {
    fake: "假实现",
    empty: "空实现",
    worthless: "无价值代码",
    cheating: "糊弄代码",
  };

  for (const [type, type_issues] of Object.entries(by_type)) {
    lines.push(`### ${type_labels[type] || type} (${type_issues.length}处)`);
    for (const issue of type_issues) {
      lines.push(`- [${issue.severity.toUpperCase()}] L${issue.line}: ${issue.description}`);
      lines.push(`  建议: ${issue.suggestion}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============ 辅助函数 ============

interface FuncInfo {
  name: string;
  params: string[];
  body?: string;
  start_line: number;
}

function extract_functions_with_params(code: string): FuncInfo[] {
  const funcs: FuncInfo[] = [];

  // JS/TS: function name(params) { body }
  const js_regex = /(?:function\s+(\w+)\s*|(\w+)\s*=\s*(?:async\s+)?(?:function\s*|\(([^)]*)\)\s*=>))\s*\(([^)]*)\)\s*(?::\s*\w+(?:\[\])?\s*)?\{/g;
  // Go: func Name(params) returnType {
  const go_regex = /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(([^)]*)\)\s*(?:\([^)]*\)|[\w.]+)?\s*\{/g;

  let match;
  while ((match = js_regex.exec(code)) !== null) {
    const name = match[1] || match[2] || "anonymous";
    const params_str = match[4] || match[3] || "";
    const params = params_str ? params_str.split(",").map(strip_type_annotation).filter(Boolean) : [];
    const start_line = get_line_number(code, match.index);
    const body = extract_body(code, match.index + match[0].length);
    funcs.push({ name, params, body, start_line });
  }

  while ((match = go_regex.exec(code)) !== null) {
    const name = match[1];
    const params_str = match[2] || "";
    const params = params_str ? params_str.split(",").map(strip_type_annotation).filter(Boolean) : [];
    const start_line = get_line_number(code, match.index);
    const body = extract_body(code, match.index + match[0].length);
    funcs.push({ name, params, body, start_line });
  }

  return funcs;
}

function strip_type_annotation(param: string): string {
  // "price: number" → "price", "data: any" → "data"
  return param.trim().split(/[:\s]/)[0] || param.trim();
}

function extract_function_params(code: string): FuncInfo[] {
  // 简化版本，用于检测参数空值检查
  const funcs: FuncInfo[] = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 匹配 function name(params) 或 Go func name(params)
    const js_match = line.match(/function\s+(\w+)\s*\(([^)]*)\)/);
    const go_match = line.match(/func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(([^)]*)\)/);
    const arrow_match = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/);

    const m = js_match || go_match || arrow_match;
    if (m) {
      const name = (m[1] || "anonymous").trim();
      const params_str = (m[2] || "").trim();
      const params = params_str ? params_str.split(",").map(strip_type_annotation).filter(Boolean) : [];
      // 提取函数体
      const body_lines: string[] = [];
      let j = i + 1;
      let depth = 0;
      let in_body = false;
      // 当前行可能已有 {
      if (lines[i].includes("{")) {
        in_body = true;
        depth += (lines[i].match(/\{/g) || []).length;
        depth -= (lines[i].match(/\}/g) || []).length;
      }
      while (j < lines.length && j < i + 50) {
        const l = lines[j];
        if (l.includes("{")) { in_body = true; depth += (l.match(/\{/g) || []).length; }
        if (l.includes("}")) depth -= (l.match(/\}/g) || []).length;
        if (in_body) body_lines.push(l);
        if (in_body && depth <= 0) break;
        j++;
      }
      funcs.push({ name, params, body: body_lines.join("\n"), start_line: i + 1 });
    }
  }

  return funcs;
}

function extract_exported_functions(code: string): FuncInfo[] {
  // 提取 export function/const 的函数
  const funcs: FuncInfo[] = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/export\s+(?:async\s+)?function\s+(\w+)/);
    const const_match = line.match(/export\s+const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/);

    const name = match?.[1] || const_match?.[1];
    if (name) {
      funcs.push({ name, params: [], start_line: i + 1 });
    }
  }

  return funcs;
}

function get_line_number(code: string, index: number): number {
  const before = code.substring(0, index);
  return before.split("\n").length;
}

function find_line_containing(code: string, search: string): number {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(search)) return i + 1;
  }
  return 1;
}

function extract_body(code: string, start_index: number): string {
  // start_index points right after the opening { which is consumed by the function regex
  const remaining = code.substring(start_index);
  let depth = 1; // 已经进入 {，从深度1开始
  let end_index = 0;

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i] === "{") depth++;
    else if (remaining[i] === "}") {
      depth--;
      if (depth <= 0) {
        end_index = i;
        break;
      }
    }
  }

  return remaining.substring(0, end_index);
}

export function normalize_code(code: string): string {
  return code
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/['"`]/g, "'")
    .replace(/\b[a-zA-Z_]\w*\b/g, "_ID_")
    .replace(/\b\d+\b/g, "_NUM_")
    .trim();
}

function calculate_similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;

  let matches = 0;
  // 滑动窗口比较大段匹配
  const window_size = Math.min(20, shorter.length);
  for (let i = 0; i <= shorter.length - window_size; i++) {
    const segment = shorter.substring(i, i + window_size);
    if (longer.includes(segment)) {
      matches++;
    }
  }

  const max_possible = shorter.length - window_size + 1;
  return max_possible > 0 ? matches / max_possible : 0;
}
