/**
 * Types matching the backend API contract (backend/app/models/*).
 */

export interface FileNode {
  name: string;
  path: string;
  type: "file";
  extension: string;
  language: string;
  size_bytes: number;
}

export interface DirectoryNode {
  name: string;
  path: string;
  type: "directory";
  children: TreeNode[];
}

export type TreeNode = FileNode | DirectoryNode;

export interface RepositoryResponse {
  repo_id: string;
  repo_name: string;
  repo_url: string;
  default_branch: string | null;
  total_files: number;
  detected_languages: Record<string, number>;
  file_tree: TreeNode[];
  warnings: string[];
}

export interface FileContentResponse {
  repo_id: string;
  path: string;
  language: string;
  content: string;
  line_count: number;
  size_bytes: number;
}

export interface Citation {
  path: string;
  line_start: number;
  line_end: number;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  model: string;
}

export interface ApiError {
  detail:
    | {
        code: string;
        message: string;
      }
    | string;
}

export const isDir = (node: TreeNode): node is DirectoryNode => node.type === "directory";
export const isFile = (node: TreeNode): node is FileNode => node.type === "file";
