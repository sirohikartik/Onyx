import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  GitBranch,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  FileCode,
  GitCommit as GitCommitIcon,
} from "lucide-react";
import { GitStatusInfo, GitCommitItem } from "../types";

interface GitModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultPath: string;
  onSynced: () => void;
}

export const GitModal: React.FC<GitModalProps> = ({
  isOpen,
  onClose,
  vaultPath,
  onSynced,
}) => {
  const [status, setStatus] = useState<GitStatusInfo | null>(null);
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [commitMsg, setCommitMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"status" | "history">("status");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const loadGitInfo = async () => {
    setLoading(true);
    try {
      const s = await invoke<GitStatusInfo>("git_status", { vaultPath });
      setStatus(s);
      const c = await invoke<GitCommitItem[]>("git_log_history", {
        limit: 20,
        vaultPath,
      });
      setCommits(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGitInfo();
      setFeedback(null);
    }
  }, [isOpen, vaultPath]);

  const handleSync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await invoke<string>("git_sync", {
        message: commitMsg.trim() ? commitMsg.trim() : null,
        vaultPath,
      });
      setFeedback({ type: "success", msg: res });
      setCommitMsg("");
      await loadGitInfo();
      onSynced();
    } catch (e: any) {
      setFeedback({ type: "error", msg: String(e) });
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0a0a0a] border border-[#222222] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c1c] bg-[#0d0d0d]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-[#8b5cf6]/10 text-[#a78bfa]">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">GitHub Vault Sync</h2>
              <p className="text-[11px] text-[#777777] font-mono truncate max-w-sm">
                {status?.remote || "git@github-personal:sirohikartik/notes-vault.git"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#777777] hover:text-white rounded-md hover:bg-[#1a1a1a]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1c1c1c] px-6 bg-[#080808]">
          <button
            onClick={() => setActiveTab("status")}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition ${
              activeTab === "status"
                ? "border-[#8b5cf6] text-white"
                : "border-transparent text-[#777777] hover:text-[#cccccc]"
            }`}
          >
            Sync & Changes
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition ${
              activeTab === "history"
                ? "border-[#8b5cf6] text-white"
                : "border-transparent text-[#777777] hover:text-[#cccccc]"
            }`}
          >
            Commit History ({commits.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2.5 ${
                feedback.type === "success"
                  ? "bg-[#10b981]/10 text-[#34d399] border border-[#10b981]/30"
                  : "bg-[#ef4444]/10 text-[#f87171] border border-[#ef4444]/30"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedback.msg}</span>
            </div>
          )}

          {activeTab === "status" ? (
            <div className="space-y-4">
              {/* Status Overview Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-[#111111] rounded-lg border border-[#1f1f1f]">
                  <span className="text-[10px] text-[#777] uppercase tracking-wider font-semibold">
                    Branch
                  </span>
                  <div className="text-sm font-semibold text-white mt-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                    {status?.branch || "main"}
                  </div>
                </div>

                <div className="p-3 bg-[#111111] rounded-lg border border-[#1f1f1f]">
                  <span className="text-[10px] text-[#777] uppercase tracking-wider font-semibold">
                    Modified
                  </span>
                  <div className="text-sm font-semibold text-[#f59e0b] mt-0.5">
                    {(status?.modified_count || 0) + (status?.untracked_count || 0)} files
                  </div>
                </div>

                <div className="p-3 bg-[#111111] rounded-lg border border-[#1f1f1f]">
                  <span className="text-[10px] text-[#777] uppercase tracking-wider font-semibold">
                    Sync Status
                  </span>
                  <div className="text-sm font-semibold text-[#a78bfa] mt-0.5">
                    {status?.ahead_count || 0} ahead · {status?.behind_count || 0} behind
                  </div>
                </div>
              </div>

              {/* Commit Message Box */}
              <div>
                <label className="block text-xs text-[#999] mb-1.5 font-medium">
                  Commit Message (optional)
                </label>
                <input
                  type="text"
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                  placeholder="e.g. Update research notes and diagrams..."
                  className="w-full bg-[#121212] border border-[#222] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>

              {/* Changed files details */}
              {status?.details && status.details.length > 0 ? (
                <div>
                  <span className="text-[11px] text-[#777] font-semibold uppercase tracking-wider block mb-2">
                    Pending Changes ({status.details.length})
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1 bg-[#0d0d0d] p-2.5 rounded-lg border border-[#1a1a1a]">
                    {status.details.map((item, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] font-mono text-[#bbbbbb] flex items-center gap-2 py-0.5"
                      >
                        <FileCode className="w-3 h-3 text-[#777]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center rounded-lg bg-[#0e0e0e] border border-[#1a1a1a] text-xs text-[#777]">
                  Working tree clean. No uncommitted local changes.
                </div>
              )}
            </div>
          ) : (
            /* History Tab */
            <div className="space-y-2">
              {commits.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#666]">
                  No commit history available.
                </div>
              ) : (
                commits.map((c) => (
                  <div
                    key={c.hash}
                    className="p-3 bg-[#111111] rounded-lg border border-[#1a1a1a] flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <GitCommitIcon className="w-3.5 h-3.5 text-[#8b5cf6] shrink-0" />
                        <span className="text-xs font-medium text-white truncate">
                          {c.message}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#666] flex items-center gap-3">
                        <span>{c.author}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {c.date}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-[#888] bg-[#1a1a1a] px-2 py-0.5 rounded shrink-0">
                      {c.hash}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1c1c1c] bg-[#0c0c0c]">
          <button
            onClick={loadGitInfo}
            disabled={loading || syncing}
            className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white px-2.5 py-1.5 rounded hover:bg-[#181818]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-[#888] hover:text-white rounded hover:bg-[#181818]"
            >
              Close
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-medium rounded-lg shadow-lg shadow-[#8b5cf6]/20 transition disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Syncing with GitHub...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  Sync with GitHub
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
