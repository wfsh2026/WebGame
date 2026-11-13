export const survivalMilestones = [30, 60, 120, 180];

export function survivalScore(seconds: number): number {
  const capped = Math.min(180, seconds);
  const bounded = Math.max(0, capped);
  const early = Math.min(60, bounded);
  const cappedMiddle = Math.min(60, bounded - 60);
  const middle = Math.max(0, cappedMiddle);
  const late = Math.max(0, bounded - 120);
  const score = early + middle * 2 + late * 3;
  const stableScore = score + 0.000001;
  return Math.floor(stableScore);
}

export function survivalGrade(seconds: number): string {
  if (seconds >= 180) return '生还';
  if (seconds >= 120) return '不屈';
  if (seconds >= 60) return '坚守';
  if (seconds >= 30) return '初探';
  return '起步';
}
