import path from 'node:path';
import { ensureDir, writeJson } from './fs.mjs';

export async function ensureIssueDir(issuesRoot, issueId) {
	const issueDir = path.join(issuesRoot, issueId);
	await ensureDir(issueDir);
	return issueDir;
}

export async function archiveIssueInput(issueDir, pool) {
	return writeJson(path.join(issueDir, 'input-pool.json'), pool);
}

export async function archiveIssueDigest(issueDir, digest) {
	return writeJson(path.join(issueDir, 'digest.json'), digest);
}

export async function archivePublishResult(issueDir, publishResult) {
	return writeJson(path.join(issueDir, 'publish-result.json'), publishResult);
}
