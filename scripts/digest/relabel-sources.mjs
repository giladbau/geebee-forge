import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeSource } from './shared/render.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../../src/lib/digest-data');

async function main() {
  const entries = (await fs.readdir(dataDir))
    .filter((name) => name.endsWith('.json'))
    .sort();

  let changedFiles = 0;
  let changedSources = 0;

  for (const name of entries) {
    const filePath = path.join(dataDir, name);
    const raw = await fs.readFile(filePath, 'utf8');
    const digest = JSON.parse(raw);
    let dirty = false;

    const walk = (sources) => {
      if (!Array.isArray(sources)) return;
      for (const source of sources) {
        const before = source.title;
        const next = normalizeSource(source, source?.type ?? 'unknown');
        if (next.title && next.title !== before) {
          source.title = next.title;
          dirty = true;
          changedSources += 1;
        }
      }
    };

    for (const topic of digest.hero_topics || []) walk(topic.sources);
    for (const item of digest.notable || []) walk(item.sources);

    if (dirty) {
      await fs.writeFile(filePath, `${JSON.stringify(digest, null, 2)}\n`);
      changedFiles += 1;
    }
  }

  console.log(JSON.stringify({ changedFiles, changedSources, totalFiles: entries.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
