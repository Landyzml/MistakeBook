# REWISE 3.0

完整中文个人错题本，React + TypeScript + Vite。无账号、无后端、无付费服务。GitHub 仅托管应用源码，个人错题、图片和文件权限全部留在自己的设备中。

## 品牌与界面

REWISE — LEARN FROM EVERY MISTAKE. 深海军蓝、薄荷绿和淡紫色构成完整深色设计系统。原创几何标志把翻开的书、字母 R 和订正对勾合为一体，完整字标也由 SVG 路径绘制，无外部商标或图片素材。

资源位于 `public/brand/`，含 logo、logo-icon、favicon、app-icon 的 SVG 与 PNG。新增全局搜索与快捷录题顶栏、紧凑题目表格、分区编辑器及统一深色弹窗。`src/brand.ts` 处理 GitHub Pages 资源基路径。

数据库仍为 `mistakebook`，数据库版本、键名和 ZIP 内部标识保持原样。仓库及站点地址保留 MistakeBook，以保证现有来源下的数据继续可用。品牌升级不会清空数据库或自动覆盖备份。

## 开始使用

进入网站 → 创建科目 → 记录错题。文字与图片至少提供一项，支持多图、知识点、标签、难度、答案及解析。复习页支持范围筛选、随机或顺序复习、上一题/下一题、答案揭晓和掌握状态。

### 自动保存到电脑文件

1. 使用支持 File System Access API 的浏览器，通过 HTTPS 或 localhost 打开应用。
2. 进入“设置与备份”→“设置电脑保存位置”。
3. 在系统文件选择窗口选择文件夹及文件名，默认 `REWISE-backup.zip`。
4. 新文件需要确认启用；已有文件会先校验，并让你选择恢复、替换或取消。不会自动覆盖。
5. 此后每次保存修改，先写入 IndexedDB，约 1.5 秒后同步完整 ZIP。界面显示“已自动保存到电脑”才表示文件写入成功。
6. 下次打开会从 IndexedDB 读取文件句柄并检查权限，需要时点击“重新授权”。也可“立即保存到电脑”“检查同步状态”或“重新选择保存位置”。

关闭页面前等待同步完成；有未同步修改时浏览器会提示。强制终止浏览器、断电或系统中断无法保证异步文件写入完成，但已成功保存的 IndexedDB 记录会在下次打开后重新同步。不要同时在多个设备上编辑同一份文件；发现外部修改会停止同步并要求重新确认。

### 导入、恢复和下载

- “下载完整备份”：导出全部科目、题目、原始图片，不受当前筛选条件影响。
- “从电脑导入错题本”或“选择备份文件”：支持 ZIP，兼容旧版 JSON。文件结构、字段、关系和 SHA-256 校验成功后显示数量预览。
- 合并：保留当前记录，为导入记录分配新 ID 并更新关系。
- 替换：输入“替换错题本”确认；替换前将当前完整数据保留在 IndexedDB 的恢复副本中，可点击“下载替换前恢复副本”导出。仅保留最近一次替换前副本。
- 使用系统打开文件选择器导入时，可勾选将选定文件设为自动同步目标，仍需浏览器授予写入权限。

### 浏览器兼容

通过运行时能力检测决定是否显示直接文件保存功能；不支持时继续自动保存 IndexedDB，提供手动 ZIP 下载和文件导入。不会在每次编辑后自动触发下载。

数据库、保存权限按浏览器与网站来源隔离。从 localhost 迁往 GitHub Pages 或换浏览器时，先下载 ZIP，再在新地址导入。浏览器句柄不能跨设备迁移，需要重新选择电脑文件。网站升级保留原 IndexedDB 数据，升级版本仅新增设置存储。

应用会调用 `navigator.storage.persisted()` 和 `persist()` 请求持久存储；未获准会在设置中说明，功能继续可用。主动清除网站数据依然会删除数据库与句柄。

## 数据格式与安全

ZIP 内包含：

- `manifest.json`：格式版本、导出日期、统计和数据摘要。
- `data.json`：全部科目、错题、答案、解析、知识点、标签、难度、状态、ID、日期及图片引用。
- `images/`：原始图片二进制文件，逐图记录大小及 SHA-256 摘要。

数据与图片 Blob 保存在 IndexedDB 的 `mistakebook` 数据库；`settings` 存储文件句柄、同步元数据和替换前恢复副本。事务和 revision 检查阻止过期标签页覆盖。文件写入使用串行队列、跨标签页 Web Locks（可用时）、外部文件变更检测与正确关闭的 writable stream。写入失败不会撤销已成功保存的数据库记录。

Git 忽略 ZIP 备份、凭据、构建文件、依赖和本机运行产物。应用没有向外部上传个人数据的接口。

## 本地开发

需要 Node.js 24 与 pnpm 11.25，或 Node.js 22+ 配合 npm：

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

当前 Mac 已安装依赖时，可双击 `启动 REWISE.command`。ZIP 源码包不包含 node_modules，首次运行需先安装依赖。

浏览器验证：`npm run test:e2e`。默认使用 macOS Chrome Dev，可设置 `PLAYWRIGHT_BASE_URL` 指定预览地址。其他平台将 Playwright 配置中的 `executablePath` 删除并安装 Chromium。

## 项目结构

- `src/model.ts`：数据模型、组合筛选、排序、迁移与合并。
- `src/storage.ts`：IndexedDB v1→v2 无损升级、事务、设置及替换恢复。
- `src/backup.ts`：旧版 JSON 与统一字段、图片校验。
- `src/zipBackup.ts`：ZIP 导入导出、图片原始字节、完整性校验。
- `src/fileSync.ts`：防抖串行同步、权限、文件句柄与冲突保护。
- `src/ComputerStorage.tsx`：电脑文件保存设置与状态。
- `src/App.tsx`、`components.tsx`、`style.css`：页面、组件及响应式布局。
- `tests/`：10 项数据测试、6 项浏览器端到端测试。
- `.github/workflows/pages.yml`：测试、生产构建、GitHub Pages 自动部署。

## 部署

仓库：https://github.com/Landyzml/MistakeBook

网站：https://landyzml.github.io/MistakeBook/

GitHub Actions 在 main 推送时自动测试、构建并部署 GitHub Pages。生产设置 `GITHUB_PAGES=true`，静态资源基路径为 `/MistakeBook/`，Hash 路由支持各页刷新。仓库公开源码不包含个人数据库和备份。

## 已验证与边界

数据测试覆盖数据库迁移、组合筛选、科目迁移、ZIP 原始图片、完整性拒绝、串行最新状态、权限续期、失败重试、外部文件保护、替换恢复。浏览器测试覆盖完整录题与复习、图片恢复、原生文件句柄在 IndexedDB 中持久化及重载、替换前副本、降级模式，以及 1440、768、390px 布局。

自动化浏览器测试用系统提供的 OPFS 原生 FileSystemFileHandle 替代文件选择窗口的返回值；没有自动操作系统原生保存对话框。系统目录选择和权限提示遵循浏览器实现，不能绕过。

每题最多 30 张图片、单图 15 MB。导入解压后总量上限 1 GB，防止异常压缩包耗尽内存。大图与大备份需要更多内存和同步时间。未实现 OCR、手写批注、公式渲染或离线 PWA。
