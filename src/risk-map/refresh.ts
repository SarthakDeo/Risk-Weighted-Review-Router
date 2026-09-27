import { analyzeGitHistory } from '../ingestion/git/git-history.js';
import { loadIncidentsFromDirectory } from '../ingestion/incidents/incident-parser.js';
import { getSensitivityTags } from '../ingestion/sensitivity/tagger.js';
import { logger } from '../logger.js';
import { saveFileRiskRecords, upsertIncidentRelationships } from './repository.js';
import { FileRiskRecord } from '../types.js';

export async function refreshRiskMap() {
  logger.info('risk-map refresh started');
  const gitData = analyzeGitHistory();
  const incidents = loadIncidentsFromDirectory('fixtures/incidents');

  const byFile = new Map<string, FileRiskRecord>();
  for (const record of gitData) {
    const tags = getSensitivityTags(record.file_path);
    byFile.set(record.file_path, { ...record, sensitivity_tags: tags, incident_count: 0, recent_incident_count: 0, blast_radius: Math.max(record.commit_count, 1) });
  }

  for (const incident of incidents) {
    for (const filePath of incident.files) {
      const existing = byFile.get(filePath) ?? {
        file_path: filePath,
        commit_count: 0,
        lines_added: 0,
        lines_deleted: 0,
        churn: 0,
        revert_count: 0,
        hotfix_count: 0,
        bug_fix_count: 0,
        bug_fix_ratio: 0,
        last_modified_at: null,
        incident_count: 0,
        recent_incident_count: 0,
        sensitivity_tags: getSensitivityTags(filePath),
        blast_radius: 1,
        updated_at: new Date().toISOString(),
      };
      existing.incident_count += 1;
      existing.recent_incident_count += 1;
      existing.sensitivity_tags = Array.from(new Set([...existing.sensitivity_tags, ...getSensitivityTags(filePath)]));
      byFile.set(filePath, existing);
      await upsertIncidentRelationships(incident.incident_id, [filePath]);
    }
  }

  const records = [...byFile.values()];
  await saveFileRiskRecords(records);
  logger.info('risk-map refresh completed');
  return records;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  refreshRiskMap().catch((error) => {
    logger.error('risk-map refresh failed', { error: String(error) });
    process.exit(1);
  });
}
