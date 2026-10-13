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
  Sparkles,
  Globe,
  Plus,
  X,
  FileText,
} from "lucide-react";
import { FileNode, GitStatusInfo, TabItem } from "./types";
import { FileTree } from "./components/FileTree";
import { Editor } from "./components/Editor";
import { Preview } from "./components/Preview";
import { WebTab } from "./components/WebTab";
import { AiSidebar } from "./components/AiSidebar";
import { ResizeHandle } from "./components/ResizeHandle";
import { GitModal } from "./components/GitModal";
import { SettingsModal } from "./components/SettingsModal";
import "./App.css";

export function App() {
  const [vaultPath, setVaultPath] = useState<string>("");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Tabs State
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: "tab-welcome",
      type: "note",
      title: "Welcome.md",
      path: "Welcome.md",
      content: "",
      viewMode: "split",
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-welcome");

  // Sidebars Sizing & Toggle
  const [leftSidebarOpen, setLeftSidebarOpen] = useState<boolean>(true);
  const [leftWidth, setLeftWidth] = useState<number>(260);
  const [aiSidebarOpen, setAiSidebarOpen] = useState<boolean>(false);
  const [rightWidth, setRightWidth] = useState<number>(360);

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

  // Active Tab Derived
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

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

      // If active tab is note and has path, load its content
      if (activeTab?.type === "note" && activeTab.path) {
        loadFileIntoTab(activeTab.id, activeTab.path, v);
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

  const loadFileIntoTab = async (tabId: string, relPath: string, customVault?: string) => {
    const v = customVault || vaultPath;
    if (!v) return;
    try {
      const content = await invoke<string>("read_file", {
        relativePath: relPath,
        vaultPath: v,
      });
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                path: relPath,
                title: relPath.split("/").pop() || relPath,
                content,
                isDirty: false,
              }
            : t
        )
      );
    } catch (e) {
      console.error("Failed to read file:", e);
    }
  };

  // Open note file (switches to existing tab or opens new)
  const openFile = (relPath: string) => {
    const existing = tabs.find((t) => t.type === "note" && t.path === relPath);
    if (existing) {
      setActiveTabId(existing.id);
    } else {
      const newId = `tab-${Date.now()}`;
      const newTab: TabItem = {
        id: newId,
        type: "note",
        title: relPath.split("/").pop() || relPath,
        path: relPath,
        content: "",
        viewMode: "split",
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newId);
      loadFileIntoTab(newId, relPath);
    }
  };

  // Open new Web Tab
  const openWebTab = (initialUrl: string = "https://google.com") => {
    const newId = `tab-web-${Date.now()}`;
    const newTab: TabItem = {
      id: newId,
      type: "web",
      title: "Web Browser",
      url: initialUrl,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Close Tab
  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (tabs.length <= 1) {
      // Don't close last tab, reset it to empty note
      setTabs([
        {
          id: `tab-${Date.now()}`,
          type: "note",
          title: "Untitled.md",
          path: "Untitled.md",
          content: "# Untitled\n\n",
          viewMode: "split",
        },
      ]);
      return;
    }

    const index = tabs.findIndex((t) => t.id === tabId);
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);

    if (activeTabId === tabId) {
      const nextActive = nextTabs[Math.max(0, index - 1)];
      setActiveTabId(nextActive.id);
    }
  };

  // Save current note
  const saveFile = useCallback(async () => {
    if (!activeTab || activeTab.type !== "note" || !activeTab.path || !vaultPath) return;
    try {
      await invoke("write_file", {
        relativePath: activeTab.path,
        content: activeTab.content || "",
        vaultPath,
      });
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false } : t))
      );
      refreshGit();
    } catch (e) {
      console.error("Failed to save file:", e);
      showToast("Error saving note!");
    }
  }, [activeTab, vaultPath]);

  // Debounced note content change
  const handleContentChange = (newText: string) => {
    if (!activeTab || activeTab.type !== "note") return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, content: newText, isDirty: true } : t
      )
    );

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
          openFile(created);
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
          setTabs((prev) =>
            prev.map((t) =>
              t.path === path ? { ...t, path: newPath, title: clean } : t
            )
          );
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
          // Close tab if open
          setTabs((prev) => prev.filter((t) => t.path !== path));
          await refreshTree();
          await refreshGit();
          showToast(`Deleted '${name}'`);
        } catch (e: any) {
          showToast(`Error: ${String(e)}`);
        }
      },
    });
  };

  // Interactive task list toggle
  const handleToggleTask = (taskIndex: number) => {
    if (!activeTab || activeTab.type !== "note" || !activeTab.content) return;
    const lines = activeTab.content.split("\n");
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
          handleContentChange(newContent);
          return;
        }
        currentTaskCount++;
      }
    }
  };

  // Insert AI generated text into active note
  const handleInsertIntoNote = (textToInsert: string) => {
    if (!activeTab || activeTab.type !== "note") {
      showToast("Open a note tab to insert AI text");
      return;
    }
    const current = activeTab.content || "";
    handleContentChange(current + textToInsert);
    showToast("Inserted AI response into note!");
  };

  // Keyboard Shortcuts (Cmd+W, Cmd+T, Cmd+S)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        closeTab(activeTabId);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        openWebTab();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activeTabId, tabs]);

  const words =
    activeTab?.type === "note" && activeTab.content?.trim()
      ? activeTab.content.trim().split(/\s+/).length
      : 0;
  const chars = activeTab?.type === "note" ? activeTab.content?.length || 0 : 0;
  const pendingChanges =
    (gitStatus?.modified_count || 0) + (gitStatus?.untracked_count || 0);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#000000] text-[#e0e0e0] overflow-hidden select-none">
      {/* ─── Top Header Bar ────────────────────────────────────────────── */}
      <header
        data-tauri-drag-region
        className="h-11 bg-[#050505] border-b border-[#181818] flex items-center justify-between px-3 shrink-0 select-none"
      >
        <div className="flex items-center gap-3">
          {/* Spacing for macOS traffic lights */}
          <div className="w-16 h-4" />

          <button
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            title="Toggle File Explorer"
            className="p-1.5 text-[#888] hover:text-white rounded hover:bg-[#161616] transition"
          >
            <SidebarIcon className="w-4 h-4" />
          </button>

          <span className="text-xs font-semibold text-white tracking-wide uppercase font-mono text-[#a78bfa]">
            ONYX
          </span>

          <span className="text-[#333] text-xs">/</span>

          <span className="text-xs text-[#888] font-mono truncate max-w-xs">
            {activeTab?.title || "No Tab"}
          </span>

          {activeTab?.isDirty && (
            <span
              title="Unsaved changes"
              className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Note View Mode Toggles (only visible when active tab is a note) */}
          {activeTab?.type === "note" && (
            <div className="flex items-center bg-[#111111] p-0.5 rounded-lg border border-[#1f1f1f]">
              <button
                onClick={() =>
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === activeTab.id ? { ...t, viewMode: "edit" } : t
                    )
                  )
                }
                title="Edit Mode"
                className={`p-1.5 rounded transition ${
                  (activeTab.viewMode || "split") === "edit"
                    ? "bg-[#222222] text-white"
                    : "text-[#777] hover:text-white"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() =>
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === activeTab.id ? { ...t, viewMode: "split" } : t
                    )
                  )
                }
                title="Split View"
                className={`p-1.5 rounded transition ${
                  (activeTab.viewMode || "split") === "split"
                    ? "bg-[#222222] text-white"
                    : "text-[#777] hover:text-white"
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() =>
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === activeTab.id ? { ...t, viewMode: "preview" } : t
                    )
                  )
                }
                title="Preview Mode"
                className={`p-1.5 rounded transition ${
                  (activeTab.viewMode || "split") === "preview"
                    ? "bg-[#222222] text-white"
                    : "text-[#777] hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="h-4 w-[1px] bg-[#222222] mx-1" />

          {/* Quick Git Sync Button */}
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

          {/* Full Git Modal */}
          <button
            onClick={() => setGitModalOpen(true)}
            title="GitHub Sync & History"
            className="p-1.5 text-[#888] hover:text-white rounded hover:bg-[#161616] transition"
          >
            <UploadCloud className="w-4 h-4" />
          </button>

          {/* AI Assistant Toggle Button */}
          <button
            onClick={() => setAiSidebarOpen(!aiSidebarOpen)}
            title="Toggle Gemma 4 AI Assistant"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition ${
              aiSidebarOpen
                ? "bg-[#8b5cf6]/20 border-[#8b5cf6] text-[#a78bfa]"
                : "bg-[#111111] border-[#222222] text-[#888] hover:text-white hover:bg-[#161616]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium font-mono">Gemma AI</span>
          </button>

          {/* Settings */}
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
        {/* Left Sidebar: File Tree */}
        {leftSidebarOpen && (
          <aside
            style={{ width: `${leftWidth}px` }}
            className="bg-[#050505] border-r border-[#181818] flex flex-col shrink-0 select-none overflow-hidden"
          >
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
                activePath={activeTab?.type === "note" ? activeTab.path || null : null}
                onSelectFile={(path) => openFile(path)}
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

        {/* Resizer Handle for Left Sidebar */}
        {leftSidebarOpen && (
          <ResizeHandle
            direction="left"
            initialWidth={leftWidth}
            minWidth={180}
            maxWidth={500}
            onResize={(w) => setLeftWidth(w)}
          />
        )}

        {/* Center Workspace (Tabs + Main Editor / Web Tab) */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#000000]">
          {/* ─── Tabs Bar ────────────────────────────────────────────── */}
          <div className="h-9 bg-[#070707] border-b border-[#181818] flex items-center justify-between px-2 gap-1 overflow-x-auto select-none shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto flex-1 h-full py-1">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`group h-7 px-3 rounded flex items-center gap-2 cursor-pointer text-xs transition border ${
                      isActive
                        ? "bg-[#141414] text-white border-[#242424] font-medium border-b-2 border-b-[#8b5cf6]"
                        : "bg-[#090909] text-[#777] border-[#161616] hover:bg-[#101010] hover:text-[#ccc]"
                    }`}
                  >
                    {tab.type === "note" ? (
                      <FileText className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                    )}

                    <span className="truncate max-w-[140px] text-[12px]">
                      {tab.title}
                    </span>

                    {tab.isDirty && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0" />
                    )}

                    <button
                      onClick={(e) => closeTab(tab.id, e)}
                      title="Close Tab (Cmd+W)"
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#252525] hover:text-white transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add Tab Quick Action */}
            <div className="flex items-center gap-1 shrink-0 pl-1">
              <button
                onClick={() => promptCreateFile()}
                title="New Note Tab"
                className="p-1 text-[#777] hover:text-white rounded hover:bg-[#161616] transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => openWebTab()}
                title="New Web Browser Tab (Cmd+T)"
                className="p-1 text-[#777] hover:text-[#38bdf8] rounded hover:bg-[#161616] transition"
              >
                <Globe className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ─── Tab Content Workspace ───────────────────────────────── */}
          <div className="flex-1 flex overflow-hidden">
            {activeTab?.type === "web" ? (
              <WebTab
                url={activeTab.url || "https://google.com"}
                onUrlChange={(newUrl) =>
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === activeTab.id ? { ...t, url: newUrl } : t
                    )
                  )
                }
                onTitleChange={(newTitle) =>
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === activeTab.id ? { ...t, title: newTitle } : t
                    )
                  )
                }
              />
            ) : activeTab?.path ? (
              <div className="flex-1 flex overflow-hidden">
                {/* Left: Editor */}
                {((activeTab.viewMode || "split") === "split" ||
                  (activeTab.viewMode || "split") === "edit") && (
                  <div
                    className={`h-full ${
                      (activeTab.viewMode || "split") === "split"
                        ? "w-1/2 border-r border-[#141414]"
                        : "w-full"
                    }`}
                  >
                    <Editor
                      content={activeTab.content || ""}
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
                {((activeTab.viewMode || "split") === "split" ||
                  (activeTab.viewMode || "split") === "preview") && (
                  <div
                    className={`h-full ${
                      (activeTab.viewMode || "split") === "split"
                        ? "w-1/2"
                        : "w-full"
                    }`}
                  >
                    <Preview
                      content={activeTab.content || ""}
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
                  Select a note from the sidebar or open a web browser tab.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => promptCreateFile()}
                    className="px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-medium rounded-lg shadow-lg shadow-[#8b5cf6]/20 transition"
                  >
                    Create Note
                  </button>
                  <button
                    onClick={() => openWebTab()}
                    className="px-4 py-2 bg-[#161616] hover:bg-[#222222] text-[#e0e0e0] text-xs font-medium rounded-lg border border-[#262626] transition flex items-center gap-1.5"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Open Web Tab
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Resizer Handle for Right AI Sidebar */}
        {aiSidebarOpen && (
          <ResizeHandle
            direction="right"
            initialWidth={rightWidth}
            minWidth={280}
            maxWidth={650}
            onResize={(w) => setRightWidth(w)}
          />
        )}

        {/* Right Sidebar: Ollama Gemma 4 AI Assistant */}
        {aiSidebarOpen && (
          <div style={{ width: `${rightWidth}px` }} className="h-full shrink-0">
            <AiSidebar
              isOpen={aiSidebarOpen}
              onClose={() => setAiSidebarOpen(false)}
              activeNoteTitle={activeTab?.type === "note" ? activeTab.title : ""}
              activeNotePath={activeTab?.type === "note" ? activeTab.path || null : null}
              activeNoteContent={activeTab?.type === "note" ? activeTab.content || "" : ""}
              vaultPath={vaultPath}
              onInsertIntoNote={handleInsertIntoNote}
            />
          </div>
        )}
      </div>

      {/* ─── Bottom Status Bar ────────────────────────────────────────── */}
      <footer className="h-6 bg-[#040404] border-t border-[#141414] px-4 flex items-center justify-between text-[11px] text-[#666] shrink-0 font-mono select-none">
        <div className="flex items-center gap-4">
          {activeTab?.type === "note" ? (
            <>
              <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
              <span>{words} words</span>
              <span>{chars} characters</span>
            </>
          ) : (
            <span className="text-[#38bdf8] flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {activeTab?.url || "Web Page"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#888]">
            {activeTab?.type === "note" ? "Markdown UTF-8" : "Webview Tab"}
          </span>
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
