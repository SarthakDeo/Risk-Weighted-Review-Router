import { sensitivityConfig } from '../../config.js';
import { toFilePatternMatch } from '../../utils.js';

export function getSensitivityTags(filePath: string): string[] {
  const normalized = toFilePatternMatch(filePath);
  const matches: string[] = [];

  for (const [category, definition] of Object.entries(sensitivityConfig.categories)) {
    for (const pattern of definition.patterns) {
      const normalizedPattern = pattern.replace(/\\/g, '/');
      if (normalizedPattern.includes('**')) {
        const base = normalizedPattern.replace(/\*\*\//g, '').replace(/\*\*$/g, '');
        if (base && normalized.includes(base)) {
          matches.push(category);
          break;
        }
      }
      if (normalizedPattern.includes('*')) {
        const glob = normalizedPattern.replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        const regex = new RegExp(`^${glob}$`);
        if (regex.test(normalized)) {
          matches.push(category);
          break;
        }
      }
      if (normalizedPattern === normalized || normalized.startsWith(normalizedPattern.replace('/**', ''))) {
        matches.push(category);
        break;
      }
    }
  }

  return [...new Set(matches)];
}
