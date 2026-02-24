import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const changelogPath = resolve(repoRoot, 'data', 'changelog.json');

const run = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const safeRun = (cmd) => {
  try {
    return run(cmd);
  } catch {
    return '';
  }
};

const loadChangelog = () => {
  if (!existsSync(changelogPath)) {
    return { last_commit: null, entries: [] };
  }
  try {
    const raw = readFileSync(changelogPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      last_commit: parsed.last_commit || null,
      entries: Array.isArray(parsed.entries) ? parsed.entries : []
    };
  } catch {
    return { last_commit: null, entries: [] };
  }
};

const saveChangelog = (data) => {
  writeFileSync(changelogPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
};

const toInt = (value) => {
  const parsed = parseInt(String(value || '').replace(/\D/g, ''), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getHead = () => run('git rev-parse HEAD');
const getShort = (hash) => hash.slice(0, 7);

const parseShortstat = (input) => {
  const files = toInt((input.match(/(\d+) files? changed/) || [])[1]);
  const insertions = toInt((input.match(/(\d+) insertions?\(\+\)/) || [])[1]);
  const deletions = toInt((input.match(/(\d+) deletions?\(-\)/) || [])[1]);
  return { files, insertions, deletions };
};

const buildEntry = ({ range, head, commits, filesChanged, stats }) => {
  return {
    id: `${new Date().toISOString()}-${getShort(head)}`,
    date: new Date().toISOString(),
    range,
    head,
    commit_count: commits.length,
    commits,
    files_changed: filesChanged,
    stats
  };
};

const changelog = loadChangelog();
const head = getHead();

if (!changelog.last_commit) {
  const entry = buildEntry({
    range: null,
    head,
    commits: [
      {
        hash: getShort(head),
        subject: 'Changelog initialized'
      }
    ],
    filesChanged: [],
    stats: { files: 0, insertions: 0, deletions: 0 }
  });
  changelog.entries.unshift(entry);
  changelog.last_commit = head;
  saveChangelog(changelog);
  process.stdout.write('Changelog initialized.\n');
  process.exit(0);
}

if (changelog.last_commit === head) {
  process.stdout.write('No new commits since last changelog entry.\n');
  process.exit(0);
}

const range = `${changelog.last_commit}..${head}`;
const logRaw = safeRun(`git log --pretty=format:%H%x1f%s ${range}`);
const commits = logRaw
  ? logRaw.split('\n').map((line) => {
      const [hash, subject] = line.split('\x1f');
      return { hash: getShort(hash), subject };
    })
  : [];

if (commits.length === 0) {
  process.stdout.write('No commits found for range.\n');
  process.exit(0);
}

const filesChangedRaw = safeRun(`git diff --name-only ${range}`);
const filesChanged = filesChangedRaw ? filesChangedRaw.split('\n').filter(Boolean) : [];
const statsRaw = safeRun(`git diff --shortstat ${range}`);
const stats = parseShortstat(statsRaw || '');

const entry = buildEntry({
  range,
  head,
  commits,
  filesChanged,
  stats
});

changelog.entries.unshift(entry);
changelog.last_commit = head;
saveChangelog(changelog);
process.stdout.write('Changelog updated.\n');
