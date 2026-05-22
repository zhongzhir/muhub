#!/usr/bin/env bash
# 在 ECS 上于仓库根目录执行：bash scripts/apply-training-nginx.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="/etc/nginx/conf.d/training.conf"

echo "==> 安装 ${TARGET}"
sudo cp "${ROOT}/deploy/nginx/training.conf" "${TARGET}"

echo "==> 检查 nginx 配置"
sudo nginx -t

echo "==> 重载 nginx"
sudo systemctl reload nginx

echo "==> 重启 Next.js (pm2)"
pm2 restart muhub --update-env

echo "==> 验证响应头"
curl -sI https://training.muhub.cn/ | sed -n '1,15p'
echo "---"
curl -sI https://training.muhub.cn/training | sed -n '1,15p'

echo "==> 完成"
