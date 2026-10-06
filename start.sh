#!/usr/bin/env bash
# 一条命令启动：安装依赖（首次）→ 初始化 SQLite → 同时启动 API 与前端
set -euo pipefail
cd "$(dirname "$0")"

[ -d node_modules ]        || npm install
[ -d server/node_modules ] || npm --prefix server install
[ -d client/node_modules ] || npm --prefix client install

npm run dev
