"use client";

import { useState } from "react";
import type { DirectoryNode, TreeNode } from "@/types/api";
import { isDir, isFile } from "@/types/api";
import { formatBytes } from "@/lib/format";

interface FileTreeProps {
  tree: TreeNode[];
  selectedPath: string | null;
  onSelectFile: (node: TreeNode) => void;
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  const dirs = nodes.filter(isDir).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const files = nodes.filter(isFile).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return [...dirs, ...files];
}

function TreeItem({
  node,
  depth,
  selectedPath,
  expanded,
  toggleDir,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  expanded: Set<string>;
  toggleDir: (path: string) => void;
  onSelectFile: (node: TreeNode) => void;
}) {
  const isDirectory = isDir(node);
  const isOpen = isDirectory && expanded.has(node.path);
  const isSelected = isFile(node) && node.path === selectedPath;

  return (
    <li role="none" className="tree-item">
      <button
        type="button"
        role="treeitem"
        aria-expanded={isDirectory ? isOpen : undefined}
        aria-selected={isSelected}
        aria-level={depth + 1}
        onClick={() => (isDirectory ? toggleDir(node.path) : onSelectFile(node))}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        className={`tree-button ${isSelected ? "is-selected" : ""}`}
      >
        <span aria-hidden="true" className="tree-caret">
          {isDirectory ? (isOpen ? "⌄" : "›") : ""}
        </span>
        <span aria-hidden="true" className="tree-glyph">
          {isDirectory ? (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round">
              <path d={isOpen ? "M1.8 4.5h4.1l1.2 1.4h7v6.6H1.8z" : "M1.8 3.2h4.1l1.2 1.5h7v7.8H1.8z"} />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="13" height="14" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round">
              <path d="M3.2 1.8h6.1l3.5 3.5v8.9H3.2z" />
              <path d="M9.2 1.9v3.7h3.5M5.2 8.3h5.6M5.2 10.6h5.6" />
            </svg>
          )}
        </span>
        <span className="tree-name">{node.name}</span>
        {!isDirectory && (
          <span className="tree-size">
            {formatBytes(node.size_bytes)}
          </span>
        )}
      </button>
      {isDirectory && isOpen && node.children.length > 0 && (
        <ul role="group">
          {sortNodes(node.children as TreeNode[]).map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expanded={expanded}
              toggleDir={toggleDir}
              onSelectFile={onSelectFile}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function FileTree({ tree, selectedPath, onSelectFile }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleDir(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  const sorted = sortNodes(tree);

  return (
    <div className="tree-scroll scroll-thin">
      <ul role="tree" aria-label="Repository files" className="file-tree">
        {sorted.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            expanded={expanded}
            toggleDir={toggleDir}
            onSelectFile={onSelectFile}
          />
        ))}
      </ul>
    </div>
  );
}

export type { DirectoryNode };
