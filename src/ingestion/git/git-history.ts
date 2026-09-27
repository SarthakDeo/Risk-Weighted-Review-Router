import { execSync } from 'node:child_process';
import path from 'node:path';
import { logger } from '../../logger.js';
import { FileRiskRecord } from '../../types.js';

const DEFAULT_REPO_PATH = process.env.REPO_PATH ?? path.resolve(process.cwd(), '.');

function runGit(args: string[]): string {
  return execSync(`git -C ${JSON.stringify(DEFAULT_REPO_PATH)} ${args.join(' ')}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

export function getTrackedFiles(): string[] {
  try {
    const output = runGit(['ls-files']);
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    logger.warn('No git repository found; using empty file set for offline mode.');
    return [];
  }
}

export function analyzeGitHistory(): FileRiskRecord[] {
  const files = getTrackedFiles();
  if (files.length === 0) return [];

  const results: FileRiskRecord[] = [];
  for (const filePath of files) {
    try {
      const log = runGit(['log', '--format=%H%x1f%s%x1f%ad%x1f%an', '--date=iso-strict', '--', filePath]);
      const commits = log
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => line.split('\x1f'));

      let linesAdded = 0;
      let linesDeleted = 0;
      let commitCount = 0;
      let revertCount = 0;
      let hotfixCount = 0;
      let bugFixCount = 0;
      let lastModifiedAt: string | null = null;

      for (const parts of commits) {
        if (parts.length < 3) continue;
        commitCount += 1;
        const summary = parts[1]?.toLowerCase() ?? '';
        if (summary.includes('revert')) revertCount += 1;
        if (/(hotfix|patch|urgent|production fix|prod fix|critical fix)/i.test(summary)) hotfixCount += 1;
        if (/(bug|bugfix|fix|fixed|defect|issue|repair)/i.test(summary)) bugFixCount += 1;

        const stats = runGit(['show', '--numstat', '--format=', '--', filePath]);
        const statLines = stats.split(/\r?\n/).filter(Boolean);
        for (const statLine of statLines) {
          const m = statLine.match(/^([0-9]+)\s+([0-9]+)\s+/);
          if (!m) continue;
          const added = Number(m[1]);
          const deleted = Number(m[2]);
          linesAdded += !Number.isNaN(added) ? added : 0;
          linesDeleted += !Number.isNaN(deleted) ? deleted : 0;
        }

        if (!lastModifiedAt) lastModifiedAt = parts[2] ?? null;
      }

      const totalChanges = linesAdded + linesDeleted;
      const bugFixRatio = commitCount > 0 ? bugFixCount / commitCount : 0;

      results.push({
        file_path: filePath,
        commit_count: commitCount,
        lines_added: linesAdded,
        lines_deleted: linesDeleted,
        churn: totalChanges,
        revert_count: revertCount,
        hotfix_count: hotfixCount,
        bug_fix_count: bugFixCount,
        bug_fix_ratio: bugFixRatio,
        last_modified_at: lastModifiedAt,
        incident_count: 0,
        recent_incident_count: 0,
        sensitivity_tags: [],
        blast_radius: 0,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      logger.warn(`Unable to mine git history for ${filePath}`);
    }
  }

  return results;
}
