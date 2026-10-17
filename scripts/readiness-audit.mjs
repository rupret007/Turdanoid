// Run against two local static servers; reports contain the complete Lighthouse evidence.
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const reportDir = resolve(process.argv[2] || 'conductor/readiness');
await mkdir(reportDir, { recursive: true });
const results = [];

async function audit(phase, page, run, categories) {
  const output = resolve(reportDir, `${phase}-${page}-${run}.json`);
  const port = phase === 'before' ? 8765 : 8766;
  const args = [
    '--yes', 'lighthouse@13.5.0', `http://127.0.0.1:${port}/${page}`,
    `--only-categories=${categories}`, '--chrome-flags=--headless',
    '--output=json', `--output-path=${output}`, '--quiet'
  ];
  await new Promise((done, reject) => {
    const child = spawn('npx', args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? done() : reject(new Error(`Lighthouse exited ${code}: ${page}`)));
  });
  const report = JSON.parse(await readFile(output, 'utf8'));
  if (report.runtimeError) throw new Error(report.runtimeError.message);
  const result = {
    phase, page, run, lighthouse: report.lighthouseVersion,
    browser: report.environment.hostUserAgent,
    performance: report.categories.performance ? report.categories.performance.score * 100 : null,
    accessibility: report.categories.accessibility.score * 100,
    tbt: report.audits['total-blocking-time']?.numericValue ?? null,
    fcp: report.audits['first-contentful-paint']?.numericValue ?? null,
    lcp: report.audits['largest-contentful-paint']?.numericValue ?? null
  };
  results.push(result);
  console.log(JSON.stringify(result));
  await writeFile(resolve(reportDir, 'summary.json'), JSON.stringify(results, null, 2));
}

for (const phase of ['before', 'after']) {
  for (let run = 1; run <= 3; run++) {
    await audit(phase, 'TurdAnoid.html', run, 'performance,accessibility');
  }
}
for (const page of ['turdtris.html', 'turdjack.html', 'turdrummy.html', 'turdspades.html', 'crapeights.html', 'neon-arkanoid.html']) {
  await audit('after', page, 1, 'accessibility');
}

const table = [
  '| Phase | Page | Run | Performance | Accessibility | TBT (ms) | FCP (ms) | LCP (ms) |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...results.map(r => `| ${r.phase} | ${r.page} | ${r.run} | ${r.performance ?? '—'} | ${r.accessibility} | ${r.tbt === null ? '—' : Math.round(r.tbt)} | ${r.fcp === null ? '—' : Math.round(r.fcp)} | ${r.lcp === null ? '—' : Math.round(r.lcp)} |`)
].join('\n') + '\n';
await writeFile(resolve(reportDir, 'summary.md'), table);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, table);
const failures = results.filter(r => r.phase === 'after' && (
  r.accessibility < 95 || (r.page === 'TurdAnoid.html' &&
    (r.performance === null || r.performance < 85 || r.tbt === null || r.tbt >= 600))
));
if (failures.length) {
  console.error('Readiness budgets failed:', JSON.stringify(failures));
  process.exitCode = 1;
}
