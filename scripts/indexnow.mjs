import { readFile } from 'node:fs/promises';
const args = process.argv.slice(2);
if (
  args.length > 1 ||
  args.some((a) => !['--status', '--after-deploy', '--diagnose', '--diagnostic-status'].includes(a))
) {
  console.error(
    'IndexNow: unsupported arguments. Use --status, --diagnose, --diagnostic-status, --after-deploy, or no argument for a guarded notification.',
  );
  process.exit(1);
}
const config = JSON.parse(await readFile(new URL('../src/data/indexnow.json', import.meta.url), 'utf8'));
const diagnostic = args.includes('--diagnose') || args.includes('--diagnostic-status');
const diagnosticRead = args.includes('--diagnostic-status');
const afterDeploy = process.argv.includes('--after-deploy');
// Compatibility for older release scripts: deployment must never add an extra scan.
const statusOnly = process.argv.includes('--status') || afterDeploy;
if (afterDeploy)
  console.error(
    'IndexNow: deployment hook is read-only; the daily 22:30 Asia/Shanghai job handles notifications.',
  );
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
  if (!statusOnly && !diagnostic) {
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
  const response = await fetch(
    config.origin + '/api/admin/indexnow' + (diagnostic ? '/diagnostics' : statusOnly ? '' : '/run'),
    {
      method: statusOnly || diagnosticRead ? 'GET' : 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${token}`, Origin: config.origin },
    },
  );
  if (!response.ok) throw new Error(`Admin endpoint returned HTTP ${response.status}.`);
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!statusOnly && !diagnostic && ['retrying', 'disabled', 'lease_lost'].includes(result.status))
    throw new Error('Submission was not received; inspect the status and retry schedule.');
} catch (error) {
  console.error('IndexNow: ' + error.message);
  if (afterDeploy)
    console.error(
      'Deployment is complete. The Cloudflare cron checks live assets daily at 22:30 Asia/Shanghai.',
    );
  else process.exitCode = 1;
}
