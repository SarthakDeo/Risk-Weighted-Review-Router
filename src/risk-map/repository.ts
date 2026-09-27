import { pool } from '../db/connection.js';
import { logger } from '../logger.js';
import { FileRiskRecord } from '../types.js';

export const inMemoryRiskMap = new Map<string, FileRiskRecord>();
export const inMemoryIncidentMap = new Map<string, string[]>();

function seedBaselineRiskData(): void {
  if (inMemoryRiskMap.size > 0) return;

  const baseline: FileRiskRecord[] = [
    {
      file_path: 'docs/README.md',
      commit_count: 2,
      lines_added: 12,
      lines_deleted: 1,
      churn: 13,
      revert_count: 0,
      hotfix_count: 0,
      bug_fix_count: 0,
      bug_fix_ratio: 0,
      last_modified_at: new Date().toISOString(),
      incident_count: 0,
      recent_incident_count: 0,
      sensitivity_tags: [],
      blast_radius: 1,
      updated_at: new Date().toISOString(),
    },
    {
      file_path: 'services/payments/charge.go',
      commit_count: 18,
      lines_added: 600,
      lines_deleted: 180,
      churn: 780,
      revert_count: 2,
      hotfix_count: 2,
      bug_fix_count: 6,
      bug_fix_ratio: 0.33,
      last_modified_at: new Date().toISOString(),
      incident_count: 3,
      recent_incident_count: 3,
      sensitivity_tags: ['payments'],
      blast_radius: 14,
      updated_at: new Date().toISOString(),
    },
    {
      file_path: 'services/payments/refund.go',
      commit_count: 9,
      lines_added: 200,
      lines_deleted: 50,
      churn: 250,
      revert_count: 1,
      hotfix_count: 1,
      bug_fix_count: 3,
      bug_fix_ratio: 0.33,
      last_modified_at: new Date().toISOString(),
      incident_count: 2,
      recent_incident_count: 2,
      sensitivity_tags: ['payments'],
      blast_radius: 11,
      updated_at: new Date().toISOString(),
    },
  ];

  for (const record of baseline) inMemoryRiskMap.set(record.file_path, record);
  inMemoryIncidentMap.set('INC-2041', ['services/payments/charge.go']);
  inMemoryIncidentMap.set('INC-1988', ['services/payments/refund.go']);
}

async function fallbackRecordsFor(files: string[]): Promise<FileRiskRecord[]> {
  seedBaselineRiskData();
  return files
    .map((filePath) => inMemoryRiskMap.get(filePath))
    .filter((record): record is FileRiskRecord => Boolean(record));
}

export async function saveFileRiskRecords(records: FileRiskRecord[]) {
  try {
    for (const record of records) {
      await pool.query(
        `
        INSERT INTO files (
          file_path, commit_count, lines_added, lines_deleted, churn, revert_count,
          hotfix_count, bug_fix_count, bug_fix_ratio, last_modified_at,
          incident_count, recent_incident_count, sensitivity_tags, blast_radius, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        ON CONFLICT (file_path) DO UPDATE SET
          commit_count = EXCLUDED.commit_count,
          lines_added = EXCLUDED.lines_added,
          lines_deleted = EXCLUDED.lines_deleted,
          churn = EXCLUDED.churn,
          revert_count = EXCLUDED.revert_count,
          hotfix_count = EXCLUDED.hotfix_count,
          bug_fix_count = EXCLUDED.bug_fix_count,
          bug_fix_ratio = EXCLUDED.bug_fix_ratio,
          last_modified_at = EXCLUDED.last_modified_at,
          incident_count = EXCLUDED.incident_count,
          recent_incident_count = EXCLUDED.recent_incident_count,
          sensitivity_tags = EXCLUDED.sensitivity_tags,
          blast_radius = EXCLUDED.blast_radius,
          updated_at = EXCLUDED.updated_at
        `,
        [
          record.file_path,
          record.commit_count,
          record.lines_added,
          record.lines_deleted,
          record.churn,
          record.revert_count,
          record.hotfix_count,
          record.bug_fix_count,
          record.bug_fix_ratio,
          record.last_modified_at,
          record.incident_count,
          record.recent_incident_count,
          record.sensitivity_tags,
          record.blast_radius,
          record.updated_at,
        ],
      );
    }
    logger.info(`Saved ${records.length} file risk records`);
    return;
  } catch (error) {
    logger.warn('Database unavailable, using in-memory risk map fallback');
    seedBaselineRiskData();
    for (const record of records) {
      inMemoryRiskMap.set(record.file_path, record);
    }
  }
}

export async function getRiskMapForFiles(files: string[]): Promise<FileRiskRecord[]> {
  if (!files.length) return [];
  try {
    const result = await pool.query<FileRiskRecord>(
      `SELECT * FROM files WHERE file_path = ANY($1)`,
      [files],
    );
    if (result.rows.length) return result.rows;
  } catch (error) {
    logger.warn('Database unavailable while loading risk map, using in-memory fallback');
  }

  return fallbackRecordsFor(files);
}

export async function upsertIncidentRelationships(incidentId: string, filePaths: string[]) {
  if (!filePaths.length) return;
  try {
    for (const filePath of filePaths) {
      await pool.query(
        `INSERT INTO incident_files (incident_id, file_path) VALUES ($1, $2)
         ON CONFLICT (incident_id, file_path) DO NOTHING`,
        [incidentId, filePath],
      );
    }
    return;
  } catch (error) {
    logger.warn('Database unavailable while recording incident relationships, using in-memory fallback');
  }

  const existing = inMemoryIncidentMap.get(incidentId) ?? [];
  for (const filePath of filePaths) {
    if (!existing.includes(filePath)) existing.push(filePath);
  }
  inMemoryIncidentMap.set(incidentId, existing);
}

export async function getRelatedIncidentsForFiles(files: string[]): Promise<string[]> {
  if (!files.length) return [];
  try {
    const result = await pool.query<{ incident_id: string }>(
      `SELECT DISTINCT incident_id FROM incident_files WHERE file_path = ANY($1) ORDER BY incident_id`,
      [files],
    );
    if (result.rows.length) return result.rows.map((row: { incident_id: string }) => row.incident_id);
  } catch (error) {
    logger.warn('Database unavailable while loading incidents, using in-memory fallback');
  }

  const related = new Set<string>();
  for (const [incidentId, affectedFiles] of inMemoryIncidentMap.entries()) {
    if (affectedFiles.some((filePath) => files.includes(filePath))) related.add(incidentId);
  }
  return [...related].sort();
}
