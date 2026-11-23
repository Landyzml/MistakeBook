import type { SyncState } from "./fileSync";
import { syncQueue, fileWindow } from "./fileSync";
import { FolderOpen, Download, ShieldCheck } from "lucide-react";
export const syncLabels: Record<SyncState["status"], string> = {
  unset: "尚未设置电脑保存位置",
  pending: "已保存到本地数据库 · 等待同步到电脑",
  saving: "正在保存到电脑…",
  saved: "已自动保存到电脑",
  permission: "需要重新授权",
  error: "自动保存失败",
};
export function ComputerStorage({
  state,
  onSelect,
  onDownload,
  busy,
}: {
  state: SyncState;
  onSelect: () => void;
  onDownload: () => void;
  busy: boolean;
}) {
  const supported = typeof fileWindow.showSaveFilePicker === "function";
  return (
    <section>
      <div>
        <h2>电脑文件自动保存</h2>
        <p>选定一个 ZIP 文件后，每次保存会自动同步题目、答案与原始图片。</p>
      </div>
      <div className="settings-panel">
        <div className={`sync-status sync-${state.status}`} role="status">
          <ShieldCheck size={19} />
          <strong>{syncLabels[state.status]}</strong>
        </div>
        {state.name && (
          <p>
            当前文件：{state.name}
            <br />
            {state.lastSaved
              ? `最近成功同步：${new Date(state.lastSaved).toLocaleString("zh-CN")}`
              : "尚未成功写入"}
          </p>
        )}
        {state.message && (
          <p className="sync-error">
            {state.message} 已存入浏览器的记录仍然保留。
          </p>
        )}
        {supported ? (
          <>
            <div className="settings-buttons">
              <button
                className="primary"
                disabled={busy || state.status === "saving"}
                onClick={onSelect}
              >
                <FolderOpen size={16} />
                {state.name ? "重新选择保存位置" : "设置电脑保存位置"}
              </button>
              <button
                disabled={busy || !state.name || state.status === "saving"}
                onClick={() => void syncQueue.flush()}
              >
                立即保存到电脑
              </button>
              {state.status === "permission" && (
                <button onClick={() => void syncQueue.authorize()}>
                  重新授权
                </button>
              )}
              <button
                disabled={state.status === "saving"}
                onClick={() => void syncQueue.check()}
              >
                检查同步状态
              </button>
            </div>
            <p>
              自动保存默认开启，修改后约 1.5
              秒同步。关闭页面前请等待同步完成；意外关闭后，下次打开会继续同步。
            </p>
          </>
        ) : (
          <>
            <p>
              此浏览器不支持直接写入电脑文件。记录仍会自动保存到
              IndexedDB，请使用完整 ZIP 下载备份。可在支持此功能的 Chrome 或
              Edge 中设置保存位置。
            </p>
            <button onClick={onDownload} disabled={busy}>
              <Download size={16} />
              下载完整备份
            </button>
          </>
        )}
      </div>
    </section>
  );
}
