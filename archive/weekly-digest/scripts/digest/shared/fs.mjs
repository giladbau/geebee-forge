import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dirPath) {
	await mkdir(dirPath, { recursive: true });
	return dirPath;
}

export async function readJson(filePath, fallback) {
	try {
		const raw = await readFile(filePath, 'utf8');
		return JSON.parse(raw);
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return fallback;
		}
		throw error;
	}
}

export async function writeJson(filePath, value) {
	await ensureDir(path.dirname(filePath));
	await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
	return filePath;
}
