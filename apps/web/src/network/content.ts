import manifest from '../../../../content/packs/forest-survival/manifest.json';
import { contentSchema, resolveContentSupports } from '@web-game-world/content-schema';

const modules = import.meta.glob('../../../../content/packs/forest-survival/{hearts,weapons,skills,supports}/*.json', { eager: true, import: 'default' });
const sources: Record<string, unknown> = {};
const prefix = '../../../../content/packs/forest-survival/';
for (const [path, source] of Object.entries(modules)) {
  const relative = path.slice(prefix.length);
  sources[relative] = source;
}
const parsed = contentSchema.parse(manifest);
const content = resolveContentSupports(parsed, sources);
export default content;
