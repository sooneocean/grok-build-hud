import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Porcelain summary: modified / added / deleted / untracked counts. */
export interface GitFileStats {
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
}

export interface GitInfo {
  branch?: string;
  dirty: boolean;
  ahead?: number;
  behind?: number;
  fileStats?: GitFileStats;
}

/** Parse `git status --porcelain` into file-change counts (Claude-HUD style). */
export function parsePorcelainFileStats(porcelain: string): GitFileStats {
  const stats: GitFileStats = {
    modified: 0,
    added: 0,
    deleted: 0,
    untracked: 0,
  };
  for (const line of porcelain.split(/\r?\n/)) {
    if (!line || line.length < 2) continue;
    const x = line[0]!;
    const y = line[1]!;
    if (x === "?" && y === "?") {
      stats.untracked += 1;
      continue;
    }
    if (x === "A" || y === "A") {
      stats.added += 1;
      continue;
    }
    if (x === "D" || y === "D") {
      stats.deleted += 1;
      continue;
    }
    // Modified / renamed / copied / typechange / unmerged
    if (
      x === "M" ||
      y === "M" ||
      x === "R" ||
      y === "R" ||
      x === "C" ||
      y === "C" ||
      x === "T" ||
      y === "T" ||
      x === "U" ||
      y === "U"
    ) {
      stats.modified += 1;
    }
  }
  return stats;
}

/** Compact chip: `!2 +1 ✘1 ?3` (omit zero buckets). */
export function formatGitFileStats(stats: GitFileStats): string {
  const bits: string[] = [];
  if (stats.modified > 0) bits.push(`!${stats.modified}`);
  if (stats.added > 0) bits.push(`+${stats.added}`);
  if (stats.deleted > 0) bits.push(`✘${stats.deleted}`);
  if (stats.untracked > 0) bits.push(`?${stats.untracked}`);
  return bits.join(" ");
}

/** Cache git probes — dashboard ticks ~500ms; git porcelain is the heavy cost. */
const GIT_CACHE_TTL_MS = 2_500;
const gitCache = new Map<
  string,
  { at: number; stamp: string; info: GitInfo }
>();

export function clearGitInfoCache(): void {
  gitCache.clear();
}

/**
 * Cheap invalidation key for git metadata (1.7: also `.git` dir mtime).
 * Unstaged worktree edits may not move HEAD/index — dashboard pre-skip
 * rebinds git via readGitInfo on every tick without needing a full reload.
 */
export function gitStamp(cwd: string): string {
  const bits: string[] = [];
  for (const rel of [".git/HEAD", ".git/index", ".git/FETCH_HEAD", ".git"]) {
    try {
      const p = path.join(cwd, rel);
      if (!fs.existsSync(p)) {
        bits.push(`${rel}:0`);
        continue;
      }
      const st = fs.statSync(p);
      bits.push(`${rel}:${st.mtimeMs}`);
    } catch {
      bits.push(`${rel}:?`);
    }
  }
  return bits.join("|");
}

export function readGitInfo(
  cwd: string,
  options: { now?: number; bypassCache?: boolean } = {},
): GitInfo {
  if (!cwd || !fs.existsSync(cwd)) {
    return { dirty: false };
  }
  const now = options.now ?? Date.now();
  const stamp = gitStamp(cwd);
  if (!options.bypassCache) {
    const hit = gitCache.get(cwd);
    if (hit && hit.stamp === stamp && now - hit.at < GIT_CACHE_TTL_MS) {
      return hit.info;
    }
  }

  const info = readGitInfoUncached(cwd);
  gitCache.set(cwd, { at: now, stamp, info });
  return info;
}

function readGitInfoUncached(cwd: string): GitInfo {
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    }).trim();
    const status = execFileSync(
      "git",
      ["-c", "core.quotePath=false", "--no-optional-locks", "status", "--porcelain"],
      {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 1500,
      },
    );
    const trimmed = status.trim();
    const dirty = trimmed.length > 0;
    const fileStats = dirty ? parsePorcelainFileStats(trimmed) : undefined;
    let ahead: number | undefined;
    let behind: number | undefined;
    try {
      const ab = execFileSync(
        "git",
        ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
        {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 1500,
        },
      ).trim();
      // behind ahead  (left=upstream, right=HEAD)
      const m = ab.match(/^(\d+)\s+(\d+)$/);
      if (m) {
        behind = Number(m[1]);
        ahead = Number(m[2]);
      }
    } catch {
      /* no upstream */
    }
    return {
      branch: branch || undefined,
      dirty,
      ahead,
      behind,
      fileStats,
    };
  } catch {
    try {
      const headPath = path.join(cwd, ".git", "HEAD");
      if (fs.existsSync(headPath)) {
        const head = fs.readFileSync(headPath, "utf8").trim();
        const m = head.match(/ref: refs\/heads\/(.+)/);
        return { branch: m?.[1], dirty: false };
      }
    } catch {
      /* ignore */
    }
    return { dirty: false };
  }
}
