import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  appStoreVersion,
  formatAppVersion,
  isAppStoreRelease,
  parseAppVersion,
} from "../packages/domain/src/app-version.js";
import {
  appleProjectPath,
  appleValues,
  readVersionMetadata,
  versionPaths,
  writeWorkingVersion,
} from "./version-manifests.mjs";
import {
  assertStoreRelease,
  checkVersions,
  checkXcodeBuild,
  setVersionLine,
} from "./version.mjs";

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (root, args, input) =>
  execFileSync("git", args, {
    cwd: root,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    },
  });
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (root, file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};
const state = (root) => readVersionMetadata(read(root, "package.json"));
const commit = (root, message = "change", ...options) =>
  run(root, ["commit", "-m", message, ...options]);
function fixture(t, { unborn = false, failInitialCommit = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fnf-version-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const support = [
    "scripts/version.mjs",
    "scripts/version-manifests.mjs",
    "scripts/check-push-version.mjs",
    "packages/domain/src/app-version.js",
    ".githooks/pre-commit",
    ".githooks/pre-merge-commit",
  ];
  for (const file of [...versionPaths, ...support])
    write(root, file, read(source, file));
  fs.chmodSync(path.join(root, ".githooks/pre-commit"), 0o755);
  fs.chmodSync(path.join(root, ".githooks/pre-merge-commit"), 0o755);
  run(root, ["init", "-q"]);
  run(root, ["config", "user.name", "Version Test"]);
  run(root, ["config", "user.email", "test@example.invalid"]);
  run(root, ["config", "commit.gpgsign", "false"]);
  if (!unborn) {
    writeWorkingVersion("0.5.179", 1, root);
    const old = JSON.parse(read(root, "package.json"));
    delete old.fnfVersionPolicy;
    delete old.appleBuildNumber;
    write(root, "package.json", JSON.stringify(old, null, 2) + "\n");
    run(root, ["add", "."]);
    commit(root, "legacy baseline");
  }
  writeWorkingVersion("0.5.0", 2, root);
  run(root, ["config", "core.hooksPath", ".githooks"]);
  run(root, ["add", "."]);
  if (failInitialCommit) {
    write(root, ".githooks/commit-msg", "#!/bin/sh\nexit 1\n");
    fs.chmodSync(path.join(root, ".githooks/commit-msg"), 0o755);
    assert.throws(() => commit(root, "failed initialization"));
    assert.equal(state(root).appleBuildNumber, 3);
    fs.unlinkSync(path.join(root, ".githooks/commit-msg"));
  }
  commit(root, "initialize version policy");
  return root;
}
function change(root) {
  write(root, "content.txt", String(Date.now()) + Math.random());
  run(root, ["add", "content.txt"]);
}

test("display hides exactly the zero build and preserves numeric components", () => {
  assert.equal(formatAppVersion("0.5.0"), "0.5");
  assert.equal(formatAppVersion("0.9.23"), "0.9.23");
  assert.equal(formatAppVersion("1.0.0"), "1.0");
  assert.equal(formatAppVersion("1.0.1"), "1.0.1");
  assert.equal(appStoreVersion("1.2.23"), "1.2");
  for (const invalid of [
    "1.0",
    "01.0.0",
    "1.0.-1",
    "1.0.2x",
    "1.0.9007199254740992",
  ])
    assert.throws(() => parseAppVersion(invalid));
});
test("real commits initialize at 0.5.0 then increment once", (t) => {
  const root = fixture(t);
  assert.deepEqual(state(root), { version: "0.5.0", appleBuildNumber: 3 });
  for (const build of [1, 2]) {
    change(root);
    commit(root, "ordinary commit");
    assert.deepEqual(checkVersions(root, "HEAD"), {
      version: `0.5.${build}`,
      appleBuildNumber: 3 + build,
    });
  }
  const before = run(root, ["status", "--porcelain"]);
  const revision = run(root, ["rev-parse", "HEAD"]).trim();
  execFileSync(process.execPath, ["scripts/check-push-version.mjs"], {
    cwd: root,
    input: `refs/heads/main ${revision} refs/heads/main ${"0".repeat(40)}\n`,
    stdio: ["pipe", "pipe", "pipe"],
  });
  assert.equal(run(root, ["status", "--porcelain"]), before);
});
test("initial commit also supports an unborn Git repository", (t) => {
  const root = fixture(t, { unborn: true });
  assert.equal(checkVersions(root, "HEAD").version, "0.5.0");
  change(root);
  commit(root);
  assert.equal(state(root).version, "0.5.1");
});
test("initial-policy retries do not reuse TestFlight build 2 or skip another upload ID", (t) => {
  const root = fixture(t, { failInitialCommit: true });
  assert.deepEqual(state(root), { version: "0.5.0", appleBuildNumber: 3 });
});
test("partial staging preserves unrelated staged and unstaged fields", (t) => {
  const root = fixture(t);
  const staged = JSON.parse(read(root, "package.json"));
  staged.stagedOnly = "included";
  write(root, "package.json", JSON.stringify(staged, null, 2) + "\n");
  run(root, ["add", "package.json"]);
  staged.unstagedOnly = "private working change";
  write(root, "package.json", JSON.stringify(staged, null, 2) + "\n");
  fs.appendFileSync(
    path.join(root, appleProjectPath),
    "\n// unstaged signing adjustment\n",
  );
  change(root);
  commit(root);
  const committed = JSON.parse(run(root, ["show", "HEAD:package.json"]));
  assert.equal(committed.stagedOnly, "included");
  assert.equal(committed.unstagedOnly, undefined);
  assert.equal(
    JSON.parse(read(root, "package.json")).unstagedOnly,
    "private working change",
  );
  assert.doesNotMatch(
    run(root, ["show", `HEAD:${appleProjectPath}`]),
    /unstaged signing adjustment/,
  );
  assert.match(read(root, appleProjectPath), /unstaged signing adjustment/);
  assert.equal(checkVersions(root, "HEAD").version, "0.5.1");
});
test("a failed commit can be retried without consuming another version", (t) => {
  const root = fixture(t);
  change(root);
  write(root, ".githooks/commit-msg", "#!/bin/sh\nexit 1\n");
  fs.chmodSync(path.join(root, ".githooks/commit-msg"), 0o755);
  assert.throws(() => commit(root));
  assert.equal(state(root).version, "0.5.1");
  assert.equal(checkVersions(root, "HEAD").version, "0.5.0");
  fs.unlinkSync(path.join(root, ".githooks/commit-msg"));
  commit(root);
  assert.deepEqual(state(root), { version: "0.5.1", appleBuildNumber: 4 });
});
test("an explicit minor/major change resets the displayed build, retaining Apple's counter", (t) => {
  const root = fixture(t);
  change(root);
  commit(root);
  setVersionLine(root, "0.6");
  run(root, ["add", ...versionPaths]);
  commit(root, "explicit minor version");
  assert.deepEqual(state(root), { version: "0.6.0", appleBuildNumber: 5 });
  change(root);
  commit(root);
  assert.equal(state(root).version, "0.6.1");
  setVersionLine(root, "1.0");
  run(root, ["add", ...versionPaths]);
  commit(root, "explicit first release");
  assert.deepEqual(state(root), { version: "1.0.0", appleBuildNumber: 7 });
  assert.equal(assertStoreRelease(checkVersions(root, "HEAD")), "1.0");
  assert.throws(() => setVersionLine(root, "0.9"));
});
test("archives reject nonzero product builds and Xcode metadata overrides", (t) => {
  const root = fixture(t);
  assert.equal(
    checkXcodeBuild(root, { ACTION: "install", ...appleValues(state(root)) })
      .version,
    "0.5.0",
  );
  change(root);
  commit(root);
  assert.doesNotThrow(() => checkXcodeBuild(root, { ACTION: "build" }));
  assert.throws(() => checkXcodeBuild(root, { ACTION: "install" }), /build 0/);
  assert.doesNotThrow(() =>
    checkXcodeBuild(root, {
      ACTION: "install",
      FNF_DISTRIBUTION_CHANNEL: "testflight-internal",
    }),
  );
  assert.throws(
    () =>
      checkXcodeBuild(root, {
        ACTION: "install",
        FNF_DISTRIBUTION_CHANNEL: "typo",
      }),
    /Unknown Apple distribution channel/,
  );
  assert.throws(
    () => checkXcodeBuild(root, { MARKETING_VERSION: "9.9" }),
    /override/,
  );
  assert.equal(isAppStoreRelease("0.5.1"), false);
});
test("invalid manual version jumps fail before changing the index", (t) => {
  const root = fixture(t);
  const metadata = JSON.parse(read(root, "package.json"));
  metadata.version = "0.5.3";
  write(root, "package.json", JSON.stringify(metadata, null, 2) + "\n");
  run(root, ["add", "package.json"]);
  const tree = run(root, ["write-tree"]);
  assert.throws(() => commit(root));
  assert.equal(run(root, ["write-tree"]), tree);
});
test("file-only commits retain other staged changes outside the commit", (t) => {
  const root = fixture(t);
  write(root, "other.txt", "staged for later");
  run(root, ["add", "other.txt"]);
  write(root, "content.txt", "selected file");
  run(root, ["add", "content.txt"]);
  run(root, ["commit", "-m", "file-only commit", "--only", "content.txt"]);
  assert.equal(checkVersions(root, "HEAD").version, "0.5.1");
  assert.throws(() => run(root, ["show", "HEAD:other.txt"]));
  assert.match(run(root, ["status", "--porcelain"]), /A  other.txt/);
});
test("a non-fast-forward merge commit increments once", (t) => {
  const root = fixture(t);
  const branch = run(root, ["branch", "--show-current"]).trim();
  run(root, ["checkout", "-b", "feature"]);
  write(root, "feature.txt", "feature");
  run(root, ["add", "feature.txt"]);
  commit(root);
  run(root, ["checkout", branch]);
  write(root, "main.txt", "main");
  run(root, ["add", "main.txt"]);
  commit(root);
  assert.throws(() =>
    run(root, ["merge", "--no-ff", "feature", "-m", "merge"]),
  );
  commit(root, "complete prepared merge");
  assert.deepEqual(checkVersions(root, "HEAD"), {
    version: "0.5.2",
    appleBuildNumber: 5,
  });
});
