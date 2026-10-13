import React, { useState } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  Trash2,
  Edit2,
  FilePlus,
  MoreVertical,
} from "lucide-react";
import { FileNode } from "../types";

interface FileTreeProps {
  nodes: FileNode[];
  activePath: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile: (parentDir?: string) => void;
  onCreateFolder: (parentDir?: string) => void;
  onRename: (path: string, currentName: string, isDir: boolean) => void;
  onDelete: (path: string, name: string, isDir: boolean) => void;
  searchQuery: string;
}

export const FileTree: React.FC<FileTreeProps> = ({
  nodes,
  activePath,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  searchQuery,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    name: string;
    isDir: boolean;
  } | null>(null);

  const toggleFolder = (path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    path: string,
    name: string,
    isDir: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      path,
      name,
      isDir,
    });
  };

  const closeMenu = () => setContextMenu(null);

  React.useEffect(() => {
    const handleClickOutside = () => closeMenu();
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const matchesSearch = (node: FileNode, query: string): boolean => {
    if (!query) return true;
    const q = query.toLowerCase();
    if (node.name.toLowerCase().includes(q)) return true;
    if (node.children) {
      return node.children.some((child) => matchesSearch(child, query));
    }
    return false;
  };

  const renderNode = (node: FileNode, level: number = 0) => {
    if (searchQuery && !matchesSearch(node, searchQuery)) {
      return null;
    }

    const isExpanded = expandedFolders[node.path] ?? (searchQuery ? true : false);
    const isActive = activePath === node.path;
    const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
      node.extension || ""
    );

    return (
      <div key={node.path} className="select-none text-xs">
        <div
          onClick={(e) => {
            if (node.is_dir) {
              toggleFolder(node.path, e);
            } else {
              onSelectFile(node.path);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node.path, node.name, node.is_dir)}
          style={{ paddingLeft: `${level * 14 + 10}px` }}
          className={`group flex items-center justify-between py-1 px-2 rounded cursor-pointer transition-colors ${
            isActive
              ? "bg-[#181818] text-white font-medium border-l-2 border-[#8b5cf6]"
              : "text-[#b0b0b0] hover:bg-[#101010] hover:text-[#e0e0e0]"
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {node.is_dir ? (
              <span
                onClick={(e) => toggleFolder(node.path, e)}
                className="text-[#666666] hover:text-white p-0.5"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
            ) : (
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                {isImage ? (
                  <ImageIcon className="w-3.5 h-3.5 text-[#3b82f6]" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-[#9ca3af]" />
                )}
              </span>
            )}

            {node.is_dir && (
              <span className="text-[#a78bfa]">
                {isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5" />
                ) : (
                  <Folder className="w-3.5 h-3.5" />
                )}
              </span>
            )}

            <span className="truncate text-[13px] tracking-tight">{node.name}</span>
          </div>

          {/* Action icons on hover */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[#777777]">
            {node.is_dir && (
              <>
                <button
                  title="New note in folder"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFile(node.path);
                  }}
                  className="hover:text-white p-0.5 rounded hover:bg-[#222]"
                >
                  <FilePlus className="w-3 h-3" />
                </button>
                <button
                  title="New subfolder"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFolder(node.path);
                  }}
                  className="hover:text-white p-0.5 rounded hover:bg-[#222]"
                >
                  <FolderPlus className="w-3 h-3" />
                </button>
              </>
            )}
            <button
              title="More options"
              onClick={(e) => handleContextMenu(e, node.path, node.name, node.is_dir)}
              className="hover:text-white p-0.5 rounded hover:bg-[#222]"
            >
              <MoreVertical className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Children if directory and expanded */}
        {node.is_dir && isExpanded && node.children && (
          <div>
            {node.children.length === 0 ? (
              <div
                style={{ paddingLeft: `${(level + 1) * 14 + 18}px` }}
                className="py-1 text-[#444444] text-[11px] italic"
              >
                empty folder
              </div>
            ) : (
              node.children.map((child) => renderNode(child, level + 1))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full select-none overflow-y-auto py-2">
      {nodes.length === 0 ? (
        <div className="px-4 py-8 text-center text-[#555555] text-xs">
          No notes yet in vault.
          <br />
          Click <span className="text-[#8b5cf6] font-medium">+</span> above to create your first note!
        </div>
      ) : (
        nodes.map((node) => renderNode(node, 0))
      )}

      {/* Context Menu Modal / Popup */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 bg-[#121212] border border-[#262626] rounded-md shadow-2xl py-1 text-xs text-[#d0d0d0] w-40"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isDir && (
            <>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#202020] hover:text-white text-left"
                onClick={() => {
                  onCreateFile(contextMenu.path);
                  closeMenu();
                }}
              >
                <Plus className="w-3.5 h-3.5 text-[#8b5cf6]" />
                New Note
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#202020] hover:text-white text-left"
                onClick={() => {
                  onCreateFolder(contextMenu.path);
                  closeMenu();
                }}
              >
                <FolderPlus className="w-3.5 h-3.5 text-[#8b5cf6]" />
                New Folder
              </button>
              <div className="my-1 border-t border-[#222222]" />
            </>
          )}

          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#202020] hover:text-white text-left"
            onClick={() => {
              onRename(contextMenu.path, contextMenu.name, contextMenu.isDir);
              closeMenu();
            }}
          >
            <Edit2 className="w-3.5 h-3.5 text-[#9ca3af]" />
            Rename
          </button>

          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#ef4444]/20 hover:text-[#ef4444] text-[#f87171] text-left"
            onClick={() => {
              onDelete(contextMenu.path, contextMenu.name, contextMenu.isDir);
              closeMenu();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};
