import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "demos/parallel-decisions/run-live.sh");
const devVars = path.join(root, ".dev.vars");
const SECRET = "parallel-run-live-test-key-not-a-real-credential";

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function withFakeNpx(npxSource, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "parallel-npx-"));
  const bin = path.join(dir, "bin");
  await mkdir(bin);
  const npxPath = path.join(bin, "npx");
  await writeFile(npxPath, npxSource);
  await chmod(npxPath, 0o755);
  const before = (await exists(devVars)) ? await readFile(devVars) : null;
  try {
    await fn(bin, dir);
  } finally {
    if (before == null) await rm(devVars, { force: true });
    else await writeFile(devVars, before);
    await rm(dir, { recursive: true, force: true });
  }
}

function spawnScript(bin, detached = false) {
  return spawn("bash", [script], {
    cwd: root,
    detached,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      PARALLEL_API_KEY: SECRET,
      PORT: "8791",
    },
  });
}

function waitForClose(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

test("run-live.sh deletes the key file when the dev server exits", async () => {
  await withFakeNpx("#!/bin/sh\nexit 0\n", async (bin) => {
    const result = await waitForClose(spawnScript(bin));
    assert.equal(result.code, 0);
    assert.equal(await exists(devVars), false);
    assert.equal(`${result.stdout}${result.stderr}`.includes(SECRET), false);
  });
});

test("run-live.sh deletes the key file when interrupted", async () => {
  const source = "#!/bin/sh\ntrap 'exit 0' INT TERM\nsleep 30\n";
  await withFakeNpx(source, async (bin) => {
    const child = spawnScript(bin, true);
    const closed = waitForClose(child);
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("run-live.sh did not print its URL")), 4000);
        child.stdout.on("data", (chunk) => {
          if (String(chunk).includes("Open http://127.0.0.1:8791/demos/parallel-decisions/")) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      process.kill(-child.pid, "SIGINT");
      const result = await closed;
      assert.equal(result.code, 130);
      assert.equal(await exists(devVars), false);
      assert.equal(`${result.stdout}${result.stderr}`.includes(SECRET), false);
    } finally {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // The process group already exited.
      }
    }
  });
});
