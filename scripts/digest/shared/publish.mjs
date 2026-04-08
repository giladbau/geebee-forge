import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { writeJson } from './fs.mjs';

const execFileAsync = promisify(execFile);

export async function publishDigestToRepo({ repoPath, publishPath, issueId, digest }) {
	const relativeFile = path.join(publishPath, `${issueId}.json`);
	const absoluteFile = path.join(repoPath, relativeFile);
	await writeJson(absoluteFile, digest);

	await execFileAsync('git', ['add', relativeFile], { cwd: repoPath });
	await execFileAsync('git', ['commit', '-m', `digest: publish ${issueId}`], { cwd: repoPath });
	const pushResult = await execFileAsync('git', ['push', 'origin', 'main'], { cwd: repoPath });

	return {
		ok: true,
		issue_id: issueId,
		file: relativeFile,
		push_stdout: pushResult.stdout.trim(),
		push_stderr: pushResult.stderr.trim()
	};
}
