import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkVersions } from "../../../scripts/version.mjs";
import { initialAppleBuildNumber } from "../../../scripts/version-manifests.mjs";
import {
  appStoreVersion,
  formatAppVersion,
} from "../../../packages/domain/src/app-version.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const team = "W3MZ3XV975";
const bundleID = "com.flash-n-flip";
const container = "iCloud.com.flash-n-flip";
const channel = "testflight-internal";

export function assertUnusedInitialBuild(state) {
  assert.ok(
    state.appleBuildNumber > initialAppleBuildNumber,
    `Apple build ${initialAppleBuildNumber} has already been distributed; commit the prepared changes before a new upload`,
  );
}
const template = path.join(
  root,
  "apps/apple/distribution/ExportOptions-TestFlight.plist",
);
const exec = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
const plistBytes = (bytes) =>
  JSON.parse(
    exec(
      "python3",
      [
        "-c",
        [
          "import sys,plistlib,json,datetime",
          "def convert(value):",
          " if isinstance(value,datetime.datetime): return value.replace(tzinfo=datetime.timezone.utc).isoformat()",
          " if isinstance(value,bytes): return None",
          " raise TypeError(type(value).__name__)",
          "print(json.dumps(plistlib.loads(sys.stdin.buffer.read()),default=convert))",
        ].join("\n"),
      ],
      { input: bytes },
    ).toString(),
  );
const plist = (file) => plistBytes(fs.readFileSync(file));
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const save = (file, value) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const sha = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

export function assertExportOptions(options, destination = "export") {
  assert.equal(
    options.method,
    "app-store-connect",
    "TestFlight requires App Store Connect signing",
  );
  assert.equal(options.destination, destination);
  assert.equal(options.teamID, team);
  assert.equal(options.signingStyle, "automatic");
  assert.equal(options.iCloudContainerEnvironment, "Production");
  assert.equal(
    options.manageAppVersionAndBuildNumber,
    false,
    "Xcode must preserve the central build number",
  );
  assert.equal(
    options.testFlightInternalTestingOnly,
    true,
    "Development builds must remain internal-only",
  );
  assert.equal(options.uploadSymbols, true);
}
export function assertAppIdentity(info, state) {
  assert.equal(info.CFBundleIdentifier, bundleID);
  assert.equal(info.CFBundleShortVersionString, appStoreVersion(state.version));
  assert.equal(info.CFBundleVersion, String(state.appleBuildNumber));
  assert.equal(info.FNFProductVersion, state.version);
  assert.equal(info.FNFDisplayVersion, formatAppVersion(state.version));
  assert.equal(info.FNFDistributionChannel, channel);
  assert.equal(info.ITSAppUsesNonExemptEncryption, false);
}
export function assertAppIcons(info, assets, files) {
  assert.ok(files.includes("Assets.car"), "Missing compiled app icon catalog");
  for (const key of ["CFBundleIcons", "CFBundleIcons~ipad"]) {
    const primary = info[key]?.CFBundlePrimaryIcon;
    assert.equal(
      primary?.CFBundleIconName,
      "AppIcon",
      `Missing ${key} AppIcon binding`,
    );
    assert.ok(primary.CFBundleIconFiles?.length, `Missing ${key} icon files`);
    for (const name of primary.CFBundleIconFiles) {
      assert.ok(/^AppIcon[\w.-]*$/.test(name));
      assert.ok(
        files.some(
          (file) => file === `${name}.png` || file.startsWith(`${name}@`),
        ),
        `Missing compiled icon ${name}`,
      );
    }
  }
  assert.ok(
    assets.some(
      (asset) =>
        asset.AssetType === "Icon Image" &&
        asset.Name === "AppIcon" &&
        asset.Idiom === "marketing" &&
        asset.PixelWidth === 1024 &&
        asset.PixelHeight === 1024 &&
        asset.Opaque === true,
    ),
    "Missing opaque 1024x1024 App Store marketing icon",
  );
}
export function assertDistributionEntitlements(entitlements, profile) {
  assert.notEqual(
    entitlements["get-task-allow"],
    true,
    "An exported beta must not permit debugging",
  );
  assert.equal(entitlements["application-identifier"], `${team}.${bundleID}`);
  assert.equal(entitlements["com.apple.developer.team-identifier"], team);
  assert.equal(
    entitlements["com.apple.developer.icloud-container-environment"],
    "Production",
  );
  assert.deepEqual(
    entitlements["com.apple.developer.icloud-container-identifiers"],
    [container],
  );
  assert.equal(entitlements["aps-environment"], "production");
  assert.equal(
    profile.Entitlements["beta-reports-active"],
    true,
    "The profile must permit TestFlight",
  );
  assert.equal(
    profile.Entitlements["application-identifier"],
    `${team}.${bundleID}`,
  );
  assert.equal(
    profile.ProvisionedDevices,
    undefined,
    "A device development/ad-hoc profile is not a TestFlight profile",
  );
  assert.notEqual(profile.ProvisionsAllDevices, true);
  assert.ok(
    new Date(profile.ExpirationDate).getTime() > Date.now(),
    "Provisioning profile expired",
  );
}
function appAt(directory) {
  const apps = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".app"));
  assert.equal(apps.length, 1, "Expected exactly one app bundle");
  return path.join(directory, apps[0]);
}
function auditApp(app, state, distribution = false) {
  const info = plist(path.join(app, "Info.plist"));
  assertAppIdentity(info, state);
  assertAppIcons(
    info,
    JSON.parse(
      exec("/usr/bin/assetutil", [
        "--info",
        path.join(app, "Assets.car"),
      ]).toString(),
    ),
    fs.readdirSync(app),
  );
  exec("codesign", ["--verify", "--deep", "--strict", app]);
  const config = json(path.join(app, "capacitor.config.json"));
  assert.equal(
    config.server,
    undefined,
    "TestFlight must contain the offline local bundle, not a development server",
  );
  for (const file of [
    "public/index.html",
    "public/app.js",
    "PrivacyInfo.xcprivacy",
  ])
    assert.ok(fs.statSync(path.join(app, file)).size > 0, `Missing ${file}`);
  if (distribution) {
    const entitlements = plistBytes(
      exec("codesign", ["-d", "--entitlements", ":-", app]),
    );
    const profile = plistBytes(
      exec("security", [
        "cms",
        "-D",
        "-i",
        path.join(app, "embedded.mobileprovision"),
      ]),
    );
    assertDistributionEntitlements(entitlements, profile);
  }
}
function artifactPaths(directory) {
  return {
    archive: path.join(directory, "Flash-n-Flip.xcarchive"),
    exported: path.join(directory, "export"),
    manifest: path.join(directory, "manifest.json"),
  };
}
function auditExport(directory, state) {
  const paths = artifactPaths(directory);
  const names = fs
    .readdirSync(paths.exported)
    .filter((name) => name.endsWith(".ipa"));
  assert.equal(names.length, 1, "Expected one exported IPA");
  const ipa = path.join(paths.exported, names[0]);
  assertExportOptions(plist(path.join(paths.exported, "ExportOptions.plist")));
  const unpacked = fs.mkdtempSync(path.join(os.tmpdir(), "fnf-ipa-audit-"));
  try {
    exec("unzip", ["-q", ipa, "-d", unpacked]);
    auditApp(appAt(path.join(unpacked, "Payload")), state, true);
  } finally {
    fs.rmSync(unpacked, { recursive: true, force: true });
  }
  return { ipa, sha256: sha(ipa) };
}
function runXcode(args, log) {
  const fd = fs.openSync(log, "w");
  console.log(`Xcode log: ${log}`);
  try {
    exec("xcodebuild", args, { stdio: ["ignore", fd, fd] });
  } catch {
    throw new Error(
      `Xcode failed; inspect ${log}. No automatic upload retry was attempted.`,
    );
  } finally {
    fs.closeSync(fd);
  }
}
export function main(command, directory) {
  const state = checkVersions(root);
  if (command === "upload") assertUnusedInitialBuild(state);
  directory = path.resolve(
    directory ??
      path.join(
        os.tmpdir(),
        `FNF-${state.version}-${state.appleBuildNumber}-testflight`,
      ),
  );
  assert.ok(
    !directory.startsWith(root + path.sep),
    "Keep signed archives, profiles and logs outside the repository",
  );
  const paths = artifactPaths(directory);
  assertExportOptions(plist(template));
  if (command === "archive") {
    assert.ok(
      !process.env.CAPACITOR_SERVER_URL,
      "Remove CAPACITOR_SERVER_URL for TestFlight",
    );
    assert.ok(
      !fs.existsSync(paths.archive),
      "Archive already exists; export it or choose a new artifact directory",
    );
    fs.mkdirSync(directory, { recursive: true });
    runXcode(
      [
        "-project",
        "apps/apple/ios/App/App.xcodeproj",
        "-scheme",
        "TestFlight",
        "-configuration",
        "TestFlight",
        "-destination",
        "generic/platform=iOS",
        "-derivedDataPath",
        path.join(directory, "DerivedData"),
        "-archivePath",
        paths.archive,
        "-allowProvisioningUpdates",
        `FNF_DISTRIBUTION_CHANNEL=${channel}`,
        "archive",
      ],
      path.join(directory, "archive.log"),
    );
    auditApp(appAt(path.join(paths.archive, "Products/Applications")), state);
    save(paths.manifest, {
      ...state,
      channel,
      bundleID,
      team,
      archive: paths.archive,
      createdAt: new Date().toISOString(),
      gitHead: exec("git", ["rev-parse", "HEAD"]).toString().trim(),
      uncommitted: exec("git", ["status", "--porcelain"]).length > 0,
    });
  } else if (["export", "audit", "upload"].includes(command)) {
    const manifest = json(paths.manifest);
    assert.equal(
      manifest.version,
      state.version,
      "The archive belongs to another product version",
    );
    assert.equal(
      manifest.appleBuildNumber,
      state.appleBuildNumber,
      "The archive belongs to another upload build",
    );
    assert.equal(manifest.channel, channel);
    auditApp(appAt(path.join(paths.archive, "Products/Applications")), state);
    if (command === "export") {
      runXcode(
        [
          "-exportArchive",
          "-archivePath",
          paths.archive,
          "-exportOptionsPlist",
          template,
          "-exportPath",
          paths.exported,
          "-allowProvisioningUpdates",
        ],
        path.join(directory, "export.log"),
      );
      save(paths.manifest, {
        ...manifest,
        export: auditExport(directory, state),
      });
    } else {
      const exported = auditExport(directory, state);
      if (command === "audit" && manifest.export === undefined) {
        // The GUI may use cloud signing when the CLI cannot see the account.
        // Adopt its export only after the same full IPA and option audit.
        save(paths.manifest, {
          ...manifest,
          export: exported,
          exportSource: "xcode-organizer",
        });
      } else {
        assert.equal(
          exported.sha256,
          manifest.export?.sha256,
          "The IPA changed after verification",
        );
      }
      if (command === "upload") {
        assert.equal(
          manifest.uploadRequestedAt,
          undefined,
          "Upload already requested; inspect App Store Connect before retrying",
        );
        const options = { ...plist(template), destination: "upload" };
        assertExportOptions(options, "upload");
        const uploadOptions = path.join(directory, "UploadOptions.plist");
        save(uploadOptions, options);
        exec("plutil", ["-convert", "xml1", uploadOptions]);
        save(paths.manifest, {
          ...manifest,
          uploadRequestedAt: new Date().toISOString(),
        });
        runXcode(
          [
            "-exportArchive",
            "-archivePath",
            paths.archive,
            "-exportOptionsPlist",
            uploadOptions,
            "-exportPath",
            path.join(directory, "upload"),
            "-allowProvisioningUpdates",
          ],
          path.join(directory, "upload.log"),
        );
        save(paths.manifest, {
          ...json(paths.manifest),
          uploadSucceededAt: new Date().toISOString(),
        });
      }
    }
  } else
    throw new Error(
      "Usage: testflight.mjs <archive|export|audit|upload> [artifact-directory]",
    );
  console.log(
    `FNF ${formatAppVersion(state.version)} (${state.appleBuildNumber}), internal TestFlight ${command}: ${directory}`,
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
