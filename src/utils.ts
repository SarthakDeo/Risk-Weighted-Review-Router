export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalize(value: number, max: number): number {
  if (max <= 0) return 0;
  return clamp(value / max, 0, 1);
}

export function toFilePatternMatch(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function isGitLikePath(filePath: string): boolean {
  return filePath.includes('/') || filePath.includes('\\') || filePath.includes('.');
}
