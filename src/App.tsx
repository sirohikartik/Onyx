import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Columns2,
  Edit3,
  Eye,
  FilePlus,
  FolderPlus,
  RefreshCw,
  Search,
  Settings,
  Sidebar as SidebarIcon,
  UploadCloud,
  CheckCircle2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { FileNode, GitStatusInfo, ViewMode } from "./types";
import { FileTree } from "./components/FileTree";
import { Editor } from "./components/Editor";
import { Preview } from "./components/Preview";
import { GitModal } from "./components/GitModal";
import { SettingsModal } from "./components/SettingsModal";
import "./App.css";

export function App() {
  const [vaultPath, setVaultPath] = useState<string>("");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<string>("");
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  // Status & Git
  const [gitStatus, setGitStatus] = useState<GitStatusInfo | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [gitModalOpen, setGitModalOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  // Dialogs
  const [promptDialog, setPromptDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    defaultValue: string;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    defaultValue: "",
    onConfirm: () => {},
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [toast, setToast] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Load vault path on startup
  useEffect(() => {
    const initVault = async () => {
      try {
        const vp = await invoke<string>("get_vault_path");
        setVaultPath(vp);
        refreshTree(vp);
        refreshGit(vp);
      } catch (e) {
        console.error("Init vault error:", e);
      }
    };
    initVault();
  }, []);

  const refreshTree = async (customVault?: string) => {
    const v = customVault || vaultPath;
    if (!v) return;
    try {
      const tree = await invoke<FileNode[]>("get_file_tree", { vaultPath: v });
      setFileTree(tree);

      // If no file active, select Welcome.md or first markdown file
      if (!activeFilePath && tree.length > 0) {
        const findFirstMd = (nodes: FileNode[]): string | null => {
          for (const node of nodes) {
            if (!node.is_dir && node.path.endsWith(".md")) {
              if (node.path === "Welcome.md") return node.path;
              return node.path;
            }
            if (node.is_dir && node.children) {
              const res = findFirstMd(node.children);
              if (res) return res;
            }
          }
          return null;
        };
        const first = findFirstMd(tree);
        if (first) {
          loadFile(first, v);
        }
      }
    } catch (e) {
      console.error("Failed to load file tree:", e);
    }
  };

  const refreshGit = async (customVault?: string) => {
    const v = customVault || vaultPath;
    if (!v) return;
    try {
      const gs = await invoke<GitStatusInfo>("git_status", { vaultPath: v });
      setGitStatus(gs);
    } catch (e) {
      console.error("Failed to check git status:", e);
    }
  };

  const loadFile = async (relPath: string, customVault?: string) => {
    const v = customVault || vaultPath;
    if (!v) return;
    try {
      const content = await invoke<string>("read_file", {
        relativePath: relPath,
        vaultPath: v,
      });
      setActiveFilePath(relPath);
      setNoteContent(content);
      setIsDirty(false);
    } catch (e) {
      console.error("Failed to read file:", e);
    }
  };

  const saveFile = useCallback(async () => {
    if (!activeFilePath || !vaultPath) return;
    setIsSaving(true);
    try {
      await invoke("write_file", {
        relativePath: activeFilePath,
        content: noteContent,
        vaultPath,
      });
      setIsDirty(false);
      refreshGit();
    } catch (e) {
      console.error("Failed to save file:", e);
      showToast("Error saving note!");
    } finally {
      setIsSaving(false);
    }
  }, [activeFilePath, vaultPath, noteContent]);

  // Debounced auto-save
  const handleContentChange = (newText: string) => {
    setNoteContent(newText);
    setIsDirty(true);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveFile();
    }, 1200);
  };

  // Quick sync to GitHub
  const handleQuickSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await invoke<string>("git_sync", {
        message: null,
        vaultPath,
      });
      showToast(res);
      await refreshGit();
    } catch (e: any) {
      showToast(`Sync failed: ${String(e)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Create new note
  const promptCreateFile = (parentDir?: string) => {
    setPromptDialog({
      isOpen: true,
      title: "New Markdown Note",
      description: parentDir
        ? `Create note inside '${parentDir}'`
        : "Enter note name (e.g. My Thoughts.md)",
      defaultValue: "Untitled Note.md",
      onConfirm: async (fileName) => {
        let name = fileName.trim();
        if (!name) return;
        if (!name.endsWith(".md") && !name.includes(".")) {
          name = `${name}.md`;
        }
        const relPath = parentDir ? `${parentDir}/${name}` : name;
        try {
          const created = await invoke<string>("create_file", {
            relativePath: relPath,
            vaultPath,
          });
          await refreshTree();
          await loadFile(created);
          showToast(`Created note: ${name}`);
        } catch (e: any) {
          showToast(`Error: ${String(e)}`);
        }
      },
    });
  };

  // Create new folder
  const promptCreateFolder = (parentDir?: string) => {
    setPromptDialog({
      isOpen: true,
      title: "New Folder",
      description: parentDir
        ? `Create subfolder inside '${parentDir}'`
        : "Enter folder name",
      defaultValue: "New Folder",
      onConfirm: async (folderName) => {
        const name = folderName.trim();
        if (!name) return;
        const relPath = parentDir ? `${parentDir}/${name}` : name;
        try {
          await invoke("create_folder", {
            relativePath: relPath,
            vaultPath,
          });
          await refreshTree();
          showToast(`Created folder: ${name}`);
        } catch (e: any) {
          showToast(`Error: ${String(e)}`);
        }
      },
    });
  };

  // Rename
  const promptRename = (path: string, currentName: string, isDir: boolean) => {
    setPromptDialog({
      isOpen: true,
      title: `Rename ${isDir ? "Folder" : "Note"}`,
      description: `Enter new name for '${currentName}'`,
      defaultValue: currentName,
      onConfirm: async (newName) => {
        const clean = newName.trim();
        if (!clean || clean === currentName) return;

        const parts = path.split("/");
        parts[parts.length - 1] = clean;
        const newPath = parts.join("/");

        try {
          await invoke("rename_entry", {
            oldPath: path,
            newPath,
            vaultPath,
          });
          await refreshTree();
          if (activeFilePath === path) {
            setActiveFilePath(newPath);
          }
          showToast(`Renamed to '${clean}'`);
        } catch (e: any) {
          showToast(`Error: ${String(e)}`);
        }
      },
    });
  };

  // Delete
  const promptDelete = (path: string, name: string, isDir: boolean) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${isDir ? "Folder" : "Note"}`,
      message: `Are you sure you want to delete '${name}'? ${
        isDir ? "All files inside this folder will be deleted." : ""
      }`,
      onConfirm: async () => {
        try {
          await invoke("delete_entry", {
            relativePath: path,
            vaultPath,
          });
          if (activeFilePath === path) {
            setActiveFilePath(null);
            setNoteContent("");
          }
          await refreshTree();
          await refreshGit();
          showToast(`Deleted '${name}'`);
        } catch (e: any) {
          showToast(`Error: ${String(e)}`);
        }
      },
    });
  };

  // Interactive task list checkbox toggle
  const handleToggleTask = (taskIndex: number) => {
    const lines = noteContent.split("\n");
    let currentTaskCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(\s*[-*+]\s+\[)([\sXx])(\]\s+.*)$/);
      if (match) {
        if (currentTaskCount === taskIndex) {
          const isChecked = match[2].toLowerCase() === "x";
          const newStatus = isChecked ? " " : "x";
          lines[i] = `${match[1]}${newStatus}${match[3]}`;
          const newContent = lines.join("\n");
          setNoteContent(newContent);
          setIsDirty(true);
          // Save directly
          invoke("write_file", {
            relativePath: activeFilePath,
            content: newContent,
            vaultPath,
          }).then(() => {
            setIsDirty(false);
            refreshGit();
          });
          return;
        }
        currentTaskCount++;
      }
    }
  };

  // Word & Char Count
  const words = noteContent.trim() ? noteContent.trim().split(/\s+/).length : 0;
  const chars = noteContent.length;

  // Total pending git changes
  const pendingChanges =
    (gitStatus?.modified_count || 0) + (gitStatus?.untracked_count || 0);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#000000] text-[#e0e0e0] overflow-hidden select-none">
      {/* ─── Top Header Bar ────────────────────────────────────────────── */}
      <header
        data-tauri-drag-region
        className="h-11 bg-[#050505] border-b border-[#181818] flex items-center justify-between px-3 shrink-0 select-none"
      >
        {/* Left Section: macOS traffic lights spacing & Vault Name */}
        <div className="flex items-center gap-3">
          {/* Spacing for macOS overlay traffic lights */}
          <div className="w-16 h-4" />

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle Sidebar"
            className="p-1.5 text-[#888] hover:text-white rounded hover:bg-[#161616] transition"
          >
            <SidebarIcon className="w-4 h-4" />
          </button>

          <span className="text-xs font-semibold text-white tracking-wide uppercase font-mono text-[#a78bfa]">
            ONYX
          </span>

          <span className="text-[#333] text-xs">/</span>

          <span className="text-xs text-[#888] font-mono truncate max-w-xs">
            {activeFilePath || "No note selected"}
          </span>

          {isDirty && (
            <span
              title="Unsaved changes"
              className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse"
            />
          )}

          {isSaving && (
            <span className="text-[10px] text-[#777] italic">saving...</span>
          )}
        </div>

        {/* Right Section: View Mode Toggles & Git Sync */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle Buttons */}
          <div className="flex items-center bg-[#111111] p-0.5 rounded-lg border border-[#1f1f1f]">
            <button
              onClick={() => setViewMode("edit")}
              title="Edit Mode"
              className={`p-1.5 rounded transition ${
                viewMode === "edit"
                  ? "bg-[#222222] text-white"
                  : "text-[#777] hover:text-white"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("split")}
              title="Split View"
              className={`p-1.5 rounded transition ${
                viewMode === "split"
                  ? "bg-[#222222] text-white"
                  : "text-[#777] hover:text-white"
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("preview")}
              title="Preview Mode"
              className={`p-1.5 rounded transition ${
                viewMode === "preview"
                  ? "bg-[#222222] text-white"
                  : "text-[#777] hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-[#222222] mx-1" />

          {/* Git Sync Quick Button */}
          <button
            onClick={handleQuickSync}
            disabled={isSyncing}
            title={
              pendingChanges > 0
                ? `${pendingChanges} uncommitted changes. Click to sync with GitHub.`
                : "Synced with GitHub"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition ${
              pendingChanges > 0
                ? "bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/20"
                : "bg-[#111111] border-[#222222] text-[#34d399] hover:bg-[#181818]"
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : pendingChanges > 0 ? (
              <UploadCloud className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
            )}
            <span className="text-[11px] font-medium">
              {isSyncing
                ? "Syncing..."
                : pendingChanges > 0
                ? `${pendingChanges} changes`
                : "Synced"}
            </span>
          </button>

          {/* Git Modal Full Button */}
          <button
            onClick={() => setGitModalOpen(true)}
            title="GitHub Sync & History"
            className="p-1.5 text-[#888] hover:text-white rounded hover:bg-[#161616] transition"
          >
            <UploadCloud className="w-4 h-4" />
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setSettingsOpen(true)}
            title="Vault Settings"
            className="p-1.5 text-[#888] hover:text-white rounded hover:bg-[#161616] transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ─── Main Content Workspace ────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-64 bg-[#050505] border-r border-[#181818] flex flex-col shrink-0 select-none">
            {/* Sidebar Action Bar */}
            <div className="p-2 border-b border-[#141414] flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#777] uppercase tracking-wider pl-1">
                Vault Files
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => promptCreateFile()}
                  title="New Note (Cmd+N)"
                  className="p-1 text-[#888] hover:text-white rounded hover:bg-[#1a1a1a]"
                >
                  <FilePlus className="w-3.5 h-3.5 text-[#a78bfa]" />
                </button>
                <button
                  onClick={() => promptCreateFolder()}
                  title="New Folder"
                  className="p-1 text-[#888] hover:text-white rounded hover:bg-[#1a1a1a]"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-[#a78bfa]" />
                </button>
                <button
                  onClick={() => refreshTree()}
                  title="Refresh File Tree"
                  className="p-1 text-[#888] hover:text-white rounded hover:bg-[#1a1a1a]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="p-2 border-b border-[#141414]">
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-[#555] absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter notes..."
                  className="w-full bg-[#0d0d0d] border border-[#1c1c1c] rounded py-1 pl-7 pr-2 text-xs text-[#d0d0d0] placeholder-[#555] focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>
            </div>

            {/* Tree View */}
            <div className="flex-1 overflow-y-auto">
              <FileTree
                nodes={fileTree}
                activePath={activeFilePath}
                onSelectFile={(path) => loadFile(path)}
                onCreateFile={(parent) => promptCreateFile(parent)}
                onCreateFolder={(parent) => promptCreateFolder(parent)}
                onRename={promptRename}
                onDelete={promptDelete}
                searchQuery={searchQuery}
              />
            </div>

            {/* Sidebar Bottom Git Status Pill */}
            <div
              onClick={() => setGitModalOpen(true)}
              className="p-2.5 border-t border-[#141414] bg-[#030303] flex items-center justify-between cursor-pointer hover:bg-[#0c0c0c] transition"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    pendingChanges > 0 ? "bg-[#f59e0b]" : "bg-[#10b981]"
                  }`}
                />
                <span className="text-[11px] text-[#888] font-mono">
                  {gitStatus?.branch || "main"}
                </span>
              </div>
              <span className="text-[10px] text-[#555] font-mono">
                {pendingChanges > 0 ? `${pendingChanges} pending` : "clean"}
              </span>
            </div>
          </aside>
        )}

        {/* Editor & Preview Pane */}
        <main className="flex-1 flex overflow-hidden bg-[#000000]">
          {activeFilePath ? (
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Editor */}
              {(viewMode === "split" || viewMode === "edit") && (
                <div
                  className={`h-full ${
                    viewMode === "split" ? "w-1/2 border-r border-[#141414]" : "w-full"
                  }`}
                >
                  <Editor
                    content={noteContent}
                    onChange={handleContentChange}
                    onSave={saveFile}
                    onImageInserted={() => {
                      refreshTree();
                      refreshGit();
                    }}
                    vaultPath={vaultPath}
                    onCursorChange={(line, col) => setCursorPos({ line, col })}
                  />
                </div>
              )}

              {/* Right: Rendered Markdown Preview */}
              {(viewMode === "split" || viewMode === "preview") && (
                <div
                  className={`h-full ${
                    viewMode === "split" ? "w-1/2" : "w-full"
                  }`}
                >
                  <Preview
                    content={noteContent}
                    vaultPath={vaultPath}
                    onToggleTask={handleToggleTask}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#555]">
              <div className="w-12 h-12 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center text-[#8b5cf6] mb-4">
                <FilePlus className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#888] mb-1">No Note Selected</h3>
              <p className="text-xs text-[#555] max-w-sm mb-4">
                Select a note from the sidebar, or create a new one to start writing.
              </p>
              <button
                onClick={() => promptCreateFile()}
                className="px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-medium rounded-lg shadow-lg shadow-[#8b5cf6]/20 transition"
              >
                Create New Note
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ─── Bottom Status Bar ────────────────────────────────────────── */}
      <footer className="h-6 bg-[#040404] border-t border-[#141414] px-4 flex items-center justify-between text-[11px] text-[#666] shrink-0 font-mono select-none">
        <div className="flex items-center gap-4">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>{words} words</span>
          <span>{chars} characters</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#888]">Markdown UTF-8</span>
          <span className="text-[#a78bfa]">
            {vaultPath.split("/").pop() || "vault"}
          </span>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-9 right-6 z-50 bg-[#141414] text-white border border-[#2a2a2a] px-4 py-2 rounded-lg shadow-2xl text-xs flex items-center gap-2 animate-fade-in font-sans">
          <CheckCircle2 className="w-4 h-4 text-[#8b5cf6]" />
          <span>{toast}</span>
        </div>
      )}

      {/* Git Modal */}
      <GitModal
        isOpen={gitModalOpen}
        onClose={() => setGitModalOpen(false)}
        vaultPath={vaultPath}
        onSynced={() => {
          refreshGit();
          refreshTree();
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        vaultPath={vaultPath}
        onVaultPathChange={(newPath) => {
          setVaultPath(newPath);
          refreshTree(newPath);
          refreshGit(newPath);
        }}
      />

      {/* Text Prompt Dialog */}
      {promptDialog.isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPromptDialog((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            className="w-full max-w-sm bg-[#0c0c0c] border border-[#242424] rounded-xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-sm font-semibold text-white">{promptDialog.title}</h3>
              <p className="text-xs text-[#777] mt-1">{promptDialog.description}</p>
            </div>
            <input
              type="text"
              autoFocus
              defaultValue={promptDialog.defaultValue}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  promptDialog.onConfirm((e.target as HTMLInputElement).value);
                  setPromptDialog((prev) => ({ ...prev, isOpen: false }));
                } else if (e.key === "Escape") {
                  setPromptDialog((prev) => ({ ...prev, isOpen: false }));
                }
              }}
              id="prompt-input"
              className="w-full bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8b5cf6]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPromptDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 text-xs text-[#888] hover:text-white rounded hover:bg-[#1a1a1a]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById("prompt-input") as HTMLInputElement;
                  promptDialog.onConfirm(input?.value || "");
                  setPromptDialog((prev) => ({ ...prev, isOpen: false }));
                }}
                className="px-3.5 py-1.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-medium rounded-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDialog.isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            className="w-full max-w-sm bg-[#0c0c0c] border border-[#242424] rounded-xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#ef4444]/10 text-[#f87171] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{confirmDialog.title}</h3>
                <p className="text-xs text-[#888] mt-1 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 text-xs text-[#888] hover:text-white rounded hover:bg-[#1a1a1a]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                }}
                className="px-3.5 py-1.5 bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
