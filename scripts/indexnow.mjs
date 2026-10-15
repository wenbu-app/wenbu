import { readFile } from 'node:fs/promises';
const config = JSON.parse(await readFile(new URL('../src/data/indexnow.json', import.meta.url), 'utf8'));
const afterDeploy = process.argv.includes('--after-deploy');
const statusOnly = process.argv.includes('--status');
try {
  const token =
    process.env.WENBU_ADMIN_TOKEN ||
    (
      await readFile(
        process.env.WENBU_ADMIN_TOKEN_FILE || new URL('../.analytics-admin-token', import.meta.url),
        'utf8',
      ).catch(() => '')
    ).trim();
  if (!token)
    throw new Error('Admin credential unavailable; set WENBU_ADMIN_TOKEN or WENBU_ADMIN_TOKEN_FILE.');
  if (!statusOnly) {
    const local = JSON.parse(
      await readFile(new URL('../dist/indexnow-manifest.json', import.meta.url), 'utf8'),
    );
    const deployed = await fetch(config.origin + config.manifestPath, {
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const deployedManifest = deployed.status === 200 ? await deployed.json() : null;
    if (
      !deployedManifest ||
      (deployedManifest.staticRevision ?? deployedManifest.revision) !== local.revision
    )
      throw new Error('The live manifest does not match this build. No manual submission was made.');
    const key = await fetch(`${config.origin}/${config.key}.txt`, {
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
    if (key.status !== 200 || (await key.text()).trim() !== config.key)
      throw new Error('The public verification file is unavailable. No manual submission was made.');
  }
  const response = await fetch(config.origin + '/api/admin/indexnow' + (statusOnly ? '' : '/run'), {
    method: statusOnly ? 'GET' : 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${token}`, Origin: config.origin },
  });
  if (!response.ok) throw new Error(`Admin endpoint returned HTTP ${response.status}.`);
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!statusOnly && ['retrying', 'disabled', 'lease_lost'].includes(result.status))
    throw new Error('Submission was not received; inspect the status and retry schedule.');
} catch (error) {
  console.error('IndexNow: ' + error.message);
  if (afterDeploy)
    console.error(
      'Deployment is complete. The Cloudflare cron will independently check the live assets every 15 minutes.',
    );
  else process.exitCode = 1;
}
