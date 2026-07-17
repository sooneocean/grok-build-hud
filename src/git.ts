import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface GitInfo {
  branch?: string;
  dirty: boolean;
  ahead?: number;
  behind?: number;
}

export function readGitInfo(cwd: string): GitInfo {
  if (!cwd || !fs.existsSync(cwd)) {
    return { dirty: false };
  }
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    }).trim();
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    });
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
      dirty: status.trim().length > 0,
      ahead,
      behind,
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
