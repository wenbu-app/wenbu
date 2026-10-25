const relationships: Record<string, string> = {
  比肩: 'Peer',
  劫财: 'Rob Wealth',
  食神: 'Eating God',
  伤官: 'Hurting Officer',
  偏财: 'Indirect Wealth',
  正财: 'Direct Wealth',
  七杀: 'Seven Killings',
  正官: 'Direct Officer',
  偏印: 'Indirect Resource',
  正印: 'Direct Resource',
  日主: 'Day Master',
};
// Display old saved charts with current terminology without rewriting their data.
export function baziRoleEn(role: string | null | undefined, fallback?: string | null) {
  return (role && relationships[role]) || fallback || role || '—';
}
