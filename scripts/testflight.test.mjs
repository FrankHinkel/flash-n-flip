import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAppIdentity,
  assertUnusedInitialBuild,
  assertDistributionEntitlements,
  assertExportOptions,
} from "../apps/apple/scripts/testflight.mjs";

const options = () => ({
  method: "app-store-connect",
  destination: "export",
  teamID: "W3MZ3XV975",
  signingStyle: "automatic",
  iCloudContainerEnvironment: "Production",
  manageAppVersionAndBuildNumber: false,
  testFlightInternalTestingOnly: true,
  uploadSymbols: true,
});
const state = { version: "0.5.23", appleBuildNumber: 25 };

test("a new upload cannot reuse the already distributed baseline build", () => {
  assert.throws(
    () => assertUnusedInitialBuild({ appleBuildNumber: 2 }),
    /already been distributed/,
  );
  assert.doesNotThrow(() => assertUnusedInitialBuild({ appleBuildNumber: 3 }));
});
const info = () => ({
  CFBundleIdentifier: "com.flash-n-flip",
  CFBundleShortVersionString: "0.5",
  CFBundleVersion: "25",
  FNFProductVersion: "0.5.23",
  FNFDisplayVersion: "0.5.23",
  FNFDistributionChannel: "testflight-internal",
  ITSAppUsesNonExemptEncryption: false,
});
const entitlements = () => ({
  "get-task-allow": false,
  "application-identifier": "W3MZ3XV975.com.flash-n-flip",
  "com.apple.developer.team-identifier": "W3MZ3XV975",
  "com.apple.developer.icloud-container-environment": "Production",
  "com.apple.developer.icloud-container-identifiers": [
    "iCloud.com.flash-n-flip",
  ],
  "aps-environment": "production",
});
const profile = () => ({
  Entitlements: {
    "beta-reports-active": true,
    "application-identifier": "W3MZ3XV975.com.flash-n-flip",
  },
  ExpirationDate: "2099-01-01T00:00:00Z",
});

test("internal exports cannot silently become publicly distributable or renumbered", () => {
  assert.doesNotThrow(() => assertExportOptions(options()));
  for (const changed of [
    { testFlightInternalTestingOnly: false },
    { manageAppVersionAndBuildNumber: true },
    { iCloudContainerEnvironment: "Development" },
    { destination: "upload" },
    { teamID: "OTHERTEAM" },
  ])
    assert.throws(() => assertExportOptions({ ...options(), ...changed }));
  assert.doesNotThrow(() =>
    assertExportOptions({ ...options(), destination: "upload" }, "upload"),
  );
});
test("development commit builds retain their display identity and Apple upload ID", () => {
  assert.doesNotThrow(() => assertAppIdentity(info(), state));
  for (const changed of [
    { CFBundleIdentifier: "com.pianoforte.practice" },
    { CFBundleVersion: "26" },
    { FNFProductVersion: "0.5.24" },
    { FNFDisplayVersion: "0.5" },
    { FNFDistributionChannel: "app-store" },
  ])
    assert.throws(() => assertAppIdentity({ ...info(), ...changed }, state));
});
test("the distribution audit rejects debug entitlements and the development cloud", () => {
  assert.doesNotThrow(() =>
    assertDistributionEntitlements(entitlements(), profile()),
  );
  for (const changed of [
    { "get-task-allow": true },
    { "com.apple.developer.icloud-container-environment": "Development" },
    {
      "com.apple.developer.icloud-container-identifiers": [
        "iCloud.com.pianoforte.practice",
      ],
    },
    { "aps-environment": "development" },
  ])
    assert.throws(() =>
      assertDistributionEntitlements(
        { ...entitlements(), ...changed },
        profile(),
      ),
    );
});
test("ad-hoc, enterprise, non-beta and expired profiles cannot pass as TestFlight", () => {
  for (const changed of [
    { ProvisionedDevices: ["device"] },
    { ProvisionsAllDevices: true },
    { ExpirationDate: "2000-01-01T00:00:00Z" },
    {
      Entitlements: { "application-identifier": "W3MZ3XV975.com.flash-n-flip" },
    },
  ])
    assert.throws(() =>
      assertDistributionEntitlements(entitlements(), {
        ...profile(),
        ...changed,
      }),
    );
});
