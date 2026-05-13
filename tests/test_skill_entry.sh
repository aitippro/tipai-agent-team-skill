#!/bin/bash
# QA Test: T-0001 Skill 入口声明
set -e
PASS=0
FAIL=0

echo "=== T-0001 QA 测试 ==="
echo ""

# Test 1: plugin.json exists
echo -n "[1] .claude-plugin/plugin.json 存在: "
if [ -f ".claude-plugin/plugin.json" ]; then
    echo "PASS"
    PASS=$((PASS+1))
else
    echo "FAIL"
    FAIL=$((FAIL+1))
fi

# Test 2: plugin.json valid JSON
echo -n "[2] plugin.json 为有效 JSON: "
if python3 -c "import json; json.load(open('.claude-plugin/plugin.json'))" 2>/dev/null; then
    echo "PASS"
    PASS=$((PASS+1))
else
    echo "FAIL"
    FAIL=$((FAIL+1))
fi

# Test 3: plugin.json has required fields
echo -n "[3] plugin.json 含 name 字段: "
if python3 -c "import json; d=json.load(open('.claude-plugin/plugin.json')); assert 'name' in d" 2>/dev/null; then
    echo "PASS"
    PASS=$((PASS+1))
else
    echo "FAIL"
    FAIL=$((FAIL+1))
fi

# Test 4: commands/agent-team.md exists
echo -n "[4] commands/agent-team.md 存在: "
if [ -f "commands/agent-team.md" ]; then
    echo "PASS"
    PASS=$((PASS+1))
else
    echo "FAIL"
    FAIL=$((FAIL+1))
fi

# Test 5: command has frontmatter
echo -n "[5] agent-team.md 含 frontmatter: "
if head -1 commands/agent-team.md | grep -q "^---$"; then
    echo "PASS"
    PASS=$((PASS+1))
else
    echo "FAIL"
    FAIL=$((FAIL+1))
fi

# Test 6: 8 constitution articles present
echo -n "[6] 宪章第〇条存在: "
grep -q "第〇条" commands/agent-team.md && echo "PASS" && PASS=$((PASS+1)) || { echo "FAIL"; FAIL=$((FAIL+1)); }
echo -n "[7] 宪章第一条存在: "
grep -q "第一条" commands/agent-team.md && echo "PASS" && PASS=$((PASS+1)) || { echo "FAIL"; FAIL=$((FAIL+1)); }
echo -n "[8] 宪章第二条存在: "
grep -q "第二条" commands/agent-team.md && echo "PASS" && PASS=$((PASS+1)) || { echo "FAIL"; FAIL=$((FAIL+1)); }
echo -n "[9] 宪章第三条存在: "
grep -q "第三条" commands/agent-team.md && echo "PASS" && PASS=$((PASS+1)) || { echo "FAIL"; FAIL=$((FAIL+1)); }
echo -n "[10] 宪章第四条存在: "
grep -q "第四条" commands/agent-team.md && echo "PASS" && PASS=$((PASS+1)) || { echo "FAIL"; FAIL=$((FAIL+1)); }
echo -n "[11] 宪章第五条存在: "
grep -q "第五条" commands/agent-team.md && echo "PASS" && PASS=$((PASS+1)) || { echo "FAIL"; FAIL=$((FAIL+1)); }
echo -n "[12] 宪章第六条存在: "
grep -q "第六条" commands/agent-team.md && echo "PASS" && PASS=$((PASS+1)) || { echo "FAIL"; FAIL=$((FAIL+1)); }
echo -n "[13] 宪章第七条存在: "
grep -q "第七条" commands/agent-team.md && echo "PASS" && PASS=$((PASS+1)) || { echo "FAIL"; FAIL=$((FAIL+1)); }

# Test 7: Activation phrase present
echo -n "[14] 激活确认语存在: "
grep -q "已进入 Agent Team 模式，宪章已加载" commands/agent-team.md && echo "PASS" && PASS=$((PASS+1)) || { echo "FAIL"; FAIL=$((FAIL+1)); }

# Test 8: description frontmatter present
echo -n "[15] frontmatter 含 description: "
grep -q "description:" commands/agent-team.md && echo "PASS" && PASS=$((PASS+1)) || { echo "FAIL"; FAIL=$((FAIL+1)); }

echo ""
echo "=== 结果: $PASS 通过, $FAIL 失败 ==="
[ "$FAIL" -eq 0 ] && echo "QA: PASS" || echo "QA: FAIL"
exit $FAIL
