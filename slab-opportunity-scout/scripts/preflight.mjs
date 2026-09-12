import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { webcmdVersion, doctor } from '../src/webcmd.mjs';

const exec = promisify(execFile);
const min = [20, 6, 0];
const got = process.versions.node.split('.').map(Number);
const nodeOk = got[0] > min[0] || (got[0] === min[0] && (got[1] > min[1] || (got[1] === min[1] && got[2] >= min[2])));

console.log(`Node: v${process.versions.node} ${nodeOk ? '✓' : '✗ (need 20.6+)'} `);
if (!nodeOk) process.exitCode = 1;

try {
  console.log(`Webcmd: ${await webcmdVersion()} ✓`);
} catch {
  console.log('Webcmd: ✗ not found');
  console.log('Install: npm install -g @agentrhq/webcmd');
  process.exitCode = 1;
  process.exit();
}

try {
  const output = await doctor();
  console.log('\nwebcmd doctor:\n' + output);
  console.log('\nPreflight complete. If doctor is green, run: npm start');
} catch (err) {
  console.log('\nwebcmd doctor failed. Fix the issue it reports before the live demo.');
  console.log(err.details?.stderr || err.message);
  process.exitCode = 1;
}
