import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, Folder, GitBranch, Keyboard, X, Check, AlertCircle } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultPath: string;
  onVaultPathChange: (newPath: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  vaultPath,
  onVaultPathChange,
}) => {
  const [newVaultPath, setNewVaultPath] = useState(vaultPath);
  const [remoteUrl, setRemoteUrl] = useState("git@github-personal:sirohikartik/notes-vault.git");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  if (!isOpen) return null;

  const handleSaveVault = async () => {
    try {
      await invoke("set_vault_path", { newPath: newVaultPath });
      onVaultPathChange(newVaultPath);
      setFeedback({ type: "success", msg: "Vault location updated successfully!" });
    } catch (e: any) {
      setFeedback({ type: "error", msg: String(e) });
    }
  };

  const handleInitGit = async () => {
    try {
      const res = await invoke<string>("git_init_and_setup", {
        repoUrl: remoteUrl,
        vaultPath: newVaultPath,
      });
      setFeedback({ type: "success", msg: res });
    } catch (e: any) {
      setFeedback({ type: "error", msg: String(e) });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0a0a0a] border border-[#222222] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c1c] bg-[#0d0d0d]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-[#8b5cf6]/10 text-[#a78bfa]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Onyx Vault Settings</h2>
              <p className="text-[11px] text-[#777]">Preferences & GitHub configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#777] hover:text-white rounded-md hover:bg-[#1a1a1a]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                feedback.type === "success"
                  ? "bg-[#10b981]/10 text-[#34d399] border border-[#10b981]/30"
                  : "bg-[#ef4444]/10 text-[#f87171] border border-[#ef4444]/30"
              }`}
            >
              {feedback.type === "success" ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.msg}</span>
            </div>
          )}

          {/* Vault Directory */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Folder className="w-4 h-4 text-[#8b5cf6]" />
              <span>Vault Directory</span>
            </div>
            <p className="text-[11px] text-[#777]">
              All your markdown notes and pasted images are stored here locally.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newVaultPath}
                onChange={(e) => setNewVaultPath(e.target.value)}
                className="flex-1 bg-[#121212] border border-[#222] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#8b5cf6]"
              />
              <button
                onClick={handleSaveVault}
                className="px-3 py-2 bg-[#1c1c1c] hover:bg-[#282828] text-white text-xs font-medium rounded-lg transition"
              >
                Save
              </button>
            </div>
          </div>

          {/* Git Remote Configuration */}
          <div className="space-y-2 pt-3 border-t border-[#1a1a1a]">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <GitBranch className="w-4 h-4 text-[#8b5cf6]" />
              <span>GitHub SSH Remote</span>
            </div>
            <p className="text-[11px] text-[#777]">
              Uses your personal SSH key configured in <code className="text-[#a78bfa]">~/.ssh/config</code>.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                className="flex-1 bg-[#121212] border border-[#222] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#8b5cf6]"
              />
              <button
                onClick={handleInitGit}
                className="px-3 py-2 bg-[#8b5cf6]/20 hover:bg-[#8b5cf6]/30 text-[#a78bfa] text-xs font-medium rounded-lg transition"
              >
                Link / Re-init
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="space-y-2 pt-3 border-t border-[#1a1a1a]">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Keyboard className="w-4 h-4 text-[#8b5cf6]" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex justify-between p-2 bg-[#111] rounded border border-[#1c1c1c]">
                <span className="text-[#888]">New Note</span>
                <kbd className="font-mono text-[#a78bfa]">Cmd + N</kbd>
              </div>
              <div className="flex justify-between p-2 bg-[#111] rounded border border-[#1c1c1c]">
                <span className="text-[#888]">Save Note</span>
                <kbd className="font-mono text-[#a78bfa]">Cmd + S</kbd>
              </div>
              <div className="flex justify-between p-2 bg-[#111] rounded border border-[#1c1c1c]">
                <span className="text-[#888]">Paste Image</span>
                <kbd className="font-mono text-[#a78bfa]">Cmd + V</kbd>
              </div>
              <div className="flex justify-between p-2 bg-[#111] rounded border border-[#1c1c1c]">
                <span className="text-[#888]">Git Sync</span>
                <kbd className="font-mono text-[#a78bfa]">Cmd + Shift + S</kbd>
              </div>
              <div className="flex justify-between p-2 bg-[#111] rounded border border-[#1c1c1c]">
                <span className="text-[#888]">Bold Text</span>
                <kbd className="font-mono text-[#a78bfa]">Cmd + B</kbd>
              </div>
              <div className="flex justify-between p-2 bg-[#111] rounded border border-[#1c1c1c]">
                <span className="text-[#888]">Italic Text</span>
                <kbd className="font-mono text-[#a78bfa]">Cmd + I</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-[#1c1c1c] bg-[#0c0c0c]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-white text-xs font-medium rounded-lg transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
