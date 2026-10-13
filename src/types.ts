export interface FileNode {
  name: string;
  path: string; // relative to vault
  is_dir: boolean;
  children?: FileNode[];
  extension?: string;
  size: number;
  modified: number;
}

export interface GitStatusInfo {
  is_repo: boolean;
  branch: string;
  remote: string;
  modified_count: number;
  untracked_count: number;
  staged_count: number;
  ahead_count: number;
  behind_count: number;
  last_commit_message: string;
  last_commit_time: string;
  details: string[];
}

export interface GitCommitItem {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export type ViewMode = "split" | "edit" | "preview";
