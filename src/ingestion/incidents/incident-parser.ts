import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../logger.js';
import { IncidentRecord } from '../../types.js';

function ensureArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function parseIncidentFile(filePath: string): IncidentRecord[] {
  const absolute = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolute)) return [];

  const content = fs.readFileSync(absolute, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const incidents: IncidentRecord[] = [];
  let current: Partial<IncidentRecord> | null = null;

  for (const line of lines) {
    if (line.startsWith('incident_id:')) {
      if (current && current.incident_id) incidents.push(current as IncidentRecord);
      current = { incident_id: line.replace('incident_id:', '').trim(), files: [], services: [], severity: 'medium', title: '' };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('date:')) current.date = line.replace('date:', '').trim();
    else if (line.startsWith('title:')) current.title = line.replace('title:', '').trim();
    else if (line.startsWith('files:')) current.files = ensureArray([]);
    else if (line.startsWith('  - ')) {
      current.files = [...(current.files ?? []), line.replace('- ', '').trim()];
    } else if (line.startsWith('services:')) current.services = ensureArray([]);
    else if (line.startsWith('  - ') && current.services !== undefined && current.services.length === 0 && !current.files?.length) {
      current.services = [...(current.services ?? []), line.replace('- ', '').trim()];
    } else if (line.startsWith('severity:')) current.severity = line.replace('severity:', '').trim();
  }

  if (current && current.incident_id) incidents.push(current as IncidentRecord);
  logger.info(`Parsed ${incidents.length} incidents from ${filePath}`);
  return incidents;
}

export function loadIncidentsFromDirectory(dirPath: string): IncidentRecord[] {
  const absolute = path.resolve(process.cwd(), dirPath);
  if (!fs.existsSync(absolute)) return [];

  const entries = fs.readdirSync(absolute, { withFileTypes: true });
  const results: IncidentRecord[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(dirPath, entry.name);
    results.push(...parseIncidentFile(filePath));
  }
  return results;
}
