import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  appStoreVersion,
  formatAppVersion,
  isAppStoreRelease,
  parseAppVersion,
} from "../packages/domain/src/app-version.js";
import {
  appleProjectPath,
  appleValues,
  assertAppleVersions,
  assertSynchronized,
  initialAppleBuildNumber,
  readVersionMetadata,
  replaceAppleVersions,
  replaceManifest,
  versionManifests,
  versionPaths,
  writeWorkingVersion,
} from "./version-manifests.mjs";
import { fileURLToPath } from "node:url";

const git = (root, args, input) =>
  execFileSync("git", args, {
    cwd: root,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");
const show = (root, ref, file) =>
  git(root, ["show", `${ref === ":" ? "" : ref}:${file}`]);
function headMetadata(root) {
  const head = spawnSync("git", ["rev-parse", "--verify", "--quiet", "HEAD"], {
    cwd: root,
  });
  if (head.status === 1) return null;
  if (head.status !== 0) throw new Error("Unable to read Git HEAD");
  return JSON.parse(show(root, "HEAD", "package.json"));
}
function baseAppleBuild(root, head) {
  if (Number.isSafeInteger(head?.appleBuildNumber))
    return head.appleBuildNumber;
  let text = "";
  try {
    text = show(root, "HEAD", appleProjectPath);
  } catch {
    text = read(root, appleProjectPath);
  }
  const values = [...text.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map(
    (match) => Number(match[1]),
  );
  return Math.max(initialAppleBuildNumber, ...values);
}
export function nextCommitState(staged, head, appleBase) {
  const current = readVersionMetadata(JSON.stringify(staged));
  const value = parseAppVersion(current.version);
  if (!head || head.fnfVersionPolicy !== 1) {
    if (current.version !== "0.5.0")
      throw new Error("Initialize the version policy at 0.5.0");
    return { version: "0.5.0", appleBuildNumber: appleBase + 1 };
  }
  const previous = readVersionMetadata(JSON.stringify(head));
  const old = parseAppVersion(previous.version);
  const lineChanged = value.major !== old.major || value.minor !== old.minor;
  let version;
  if (lineChanged) {
    if (
      value.major < old.major ||
      (value.major === old.major && value.minor < old.minor) ||
      value.build !== 0
    )
      throw new Error(
        "An explicitly changed major/minor line must increase and start at build 0",
      );
    version = current.version;
  } else {
    const expected = old.build + 1;
    if (
      !Number.isSafeInteger(expected) ||
      ![old.build, expected].includes(value.build)
    )
      throw new Error(
        "Each commit must increase the build exactly once; major/minor changes require version:set",
      );
    version = `${old.major}.${old.minor}.${expected}`;
  }
  return { version, appleBuildNumber: previous.appleBuildNumber + 1 };
}
export function checkVersions(root = process.cwd(), ref) {
  const get = (file) => (ref ? show(root, ref, file) : read(root, file));
  const state = readVersionMetadata(get("package.json"));
  assertSynchronized(
    versionManifests.map((manifest) => ({
      ...manifest,
      version: JSON.parse(get(manifest.path)).version,
    })),
  );
  assertAppleVersions(get(appleProjectPath), state);
  return state;
}
export function assertStoreRelease(state) {
  if (!isAppStoreRelease(state.version))
    throw new Error(
      `App Store publication requires a two-part release at build 0; found ${state.version}`,
    );
  return appStoreVersion(state.version);
}
export function checkXcodeBuild(root = process.cwd(), env = process.env) {
  const state = checkVersions(root);
  const channel = env.FNF_DISTRIBUTION_CHANNEL ?? "app-store";
  if (!["app-store", "testflight-internal"].includes(channel))
    throw new Error(`Unknown Apple distribution channel: ${channel}`);
  for (const [key, expected] of Object.entries(appleValues(state))) {
    if (env[key] !== undefined && env[key] !== expected)
      throw new Error(
        `Xcode override ${key}=${env[key]} differs from the central value ${expected}`,
      );
  }
  if (env.ACTION === "install" && channel === "app-store")
    assertStoreRelease(state);
  return state;
}
export function prepareCommit(root = process.cwd()) {
  const staged = JSON.parse(
    show(root, ":", "package.json").replace(/^\uFEFF/, ""),
  );
  const head = headMetadata(root);
  const next = nextCommitState(staged, head, baseAppleBuild(root, head));
  const expectedApple =
    head?.fnfVersionPolicy === 1
      ? head.appleBuildNumber
      : baseAppleBuild(root, head);
  if (![expectedApple, next.appleBuildNumber].includes(staged.appleBuildNumber))
    throw new Error(
      "Apple upload build must advance exactly once with the commit",
    );
  const updated = [];
  for (const file of versionPaths) {
    const index = show(root, ":", file);
    const working = read(root, file);
    const transform = (text) =>
      file === appleProjectPath
        ? replaceAppleVersions(text, next)
        : replaceManifest(text, next, file === "package.json");
    // Changes to unrelated fields stay in their original index/working copy.
    // An unstaged change to a version field needs the user's staging decision.
    if (file !== appleProjectPath) {
      const w = JSON.parse(working).version;
      const i = JSON.parse(index).version;
      if (w !== i && w !== next.version)
        throw new Error(
          `Stage the pending version edit in ${file} before committing`,
        );
      if (file === "package.json") {
        const wMetadata = JSON.parse(working);
        const iMetadata = JSON.parse(index);
        for (const [key, value] of Object.entries({
          appleBuildNumber: next.appleBuildNumber,
          fnfVersionPolicy: 1,
        })) {
          if (wMetadata[key] !== iMetadata[key] && wMetadata[key] !== value)
            throw new Error(`Stage the pending ${key} edit before committing`);
        }
      }
    } else {
      for (const key of Object.keys(appleValues(next))) {
        const extract = (text) =>
          [...text.matchAll(new RegExp(`\\b${key} = ([^;]+);`, "g"))]
            .map((match) => match[1])
            .join(",");
        if (
          extract(working) !== extract(index) &&
          extract(working) !== extract(replaceAppleVersions(working, next))
        )
          throw new Error(
            `Stage the pending Xcode ${key} edit before committing`,
          );
      }
    }
    const mode = git(root, ["ls-files", "--stage", "--", file]).split(" ")[0];
    if (!/^100(?:644|755)$/.test(mode))
      throw new Error(`Version source is not a regular tracked file: ${file}`);
    updated.push({
      file,
      mode,
      index: transform(index),
      working: transform(working),
    });
  }
  for (const entry of updated)
    fs.writeFileSync(path.join(root, entry.file), entry.working);
  const records = updated
    .map(
      (entry) =>
        `${entry.mode} ${git(root, ["hash-object", "-w", "--stdin"], entry.index).trim()}\t${entry.file}\0`,
    )
    .join("");
  git(root, ["update-index", "-z", "--index-info"], records);
  console.log(
    `FNF ${formatAppVersion(next.version)} (Apple build ${next.appleBuildNumber})`,
  );
  return next;
}
export function setVersionLine(root, target) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.0)?$/.exec(target ?? "");
  if (!match)
    throw new Error(
      "Use version:set <major.minor>; the commit build starts at 0",
    );
  const current = readVersionMetadata(read(root, "package.json"));
  const from = parseAppVersion(current.version);
  const to = parseAppVersion(`${match[1]}.${match[2]}.0`);
  if (
    to.major < from.major ||
    (to.major === from.major && to.minor <= from.minor)
  )
    throw new Error(
      "Change major/minor only to an explicitly requested higher line",
    );
  const head = headMetadata(root);
  const next = nextCommitState(
    { ...current, fnfVersionPolicy: 1, version: `${to.major}.${to.minor}.0` },
    head,
    baseAppleBuild(root, head),
  );
  writeWorkingVersion(next.version, next.appleBuildNumber, root);
  return next;
}
function main(command, arg, root = process.cwd()) {
  if (command === "check") {
    const state = checkVersions(root);
    console.log(
      `FNF ${formatAppVersion(state.version)} (${state.version}), Apple build ${state.appleBuildNumber}: synchronized`,
    );
  } else if (command === "prepare-commit") prepareCommit(root);
  else if (command === "next") {
    const working = readVersionMetadata(read(root, "package.json"));
    const head = headMetadata(root);
    const next = nextCommitState(
      { ...working, fnfVersionPolicy: 1 },
      head,
      baseAppleBuild(root, head),
    );
    writeWorkingVersion(next.version, next.appleBuildNumber, root);
  } else if (command === "set") setVersionLine(root, arg);
  else if (command === "check-app-store")
    console.log(`App Store version ${assertStoreRelease(checkVersions(root))}`);
  else if (command === "check-xcode") checkXcodeBuild(root);
  else
    throw new Error(
      "Usage: version.mjs <check|next|prepare-commit|set <major.minor>|check-app-store|check-xcode>",
    );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv[2], process.argv[3]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
