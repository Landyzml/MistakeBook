#!/bin/zsh
cd "${0:A:h}"
if command -v node >/dev/null 2>&1; then
  task_node="$(command -v node)"
elif [[ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  task_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
else
  echo '请先安装 Node.js 22 或更新版本，再按照 README 启动。'
  read -k 1
  exit 1
fi
if [[ ! -d node_modules/vite ]]; then
  echo '请先在项目目录运行 npm install。'
  read -k 1
  exit 1
fi
echo '知错正在启动，请在浏览器打开下方地址。关闭此窗口或按 Ctrl+C 停止。'
exec "$task_node" node_modules/vite/bin/vite.js --host 127.0.0.1
