#!/bin/bash
# ===== TipAI Autonomous Skill Pipeline Runner =====
# 由 cron 每 30 分钟调用一次
#
# 用法: bash autonomous/runner.sh
# 日志: autonomous/logs/YYYY-MM-DD_HH-MM-SS.log

REPO_DIR="/home/ubuntu/tipai-agent-team-skill"
WORKSPACE_DIR="/home/ubuntu/autonomous-workspace"
LOCK_FILE="$REPO_DIR/autonomous/.runner.lock"
LOG_DIR="$REPO_DIR/autonomous/logs"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOG_FILE="$LOG_DIR/$TIMESTAMP.log"

mkdir -p "$LOG_DIR" "$WORKSPACE_DIR"

# 防止并发重叠执行
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "[skip] Previous cycle still running — $TIMESTAMP" | tee -a "$LOG_DIR/skip.log"
  exit 0
fi

exec > >(tee -a "$LOG_FILE") 2>&1

echo "========================================="
echo "TipAI Autonomous Cycle — $TIMESTAMP"
echo "========================================="

cd "$REPO_DIR"

# 拉取最新 (用户可能更新了 RESEARCH.md)
git pull origin main --rebase 2>&1 || echo "[warn] git pull failed, continuing..."

# 执行自主开发周期
echo "[cycle] Starting..."

timeout 600 claude -p "$(cat autonomous/cycle-prompt.md)" \
  --add-dir "$WORKSPACE_DIR" \
  --permission-mode bypassPermissions \
  --allowedTools "Bash(git *), Bash(gh *), Bash(npm *), Bash(npx *), Bash(ls *), Bash(cd *), Bash(mkdir *), Bash(find *), Bash(cat *), Bash(wc *), Bash(head *), Bash(tail *), Bash(echo *), Bash(pwd), Bash(rm *), Bash(cp *), Bash(mv *), Read, Write, Edit, Glob, Grep" \
  --bare \
  --max-budget-usd 3 \
  --output-format text \
  2>&1 || echo "[cycle] Cycle completed (exit=$?)"

# 推送本地产出
git push origin main 2>&1 || echo "[warn] push failed"

echo "[cycle] Done — $TIMESTAMP"
echo ""
