import { CloudLibraryError } from "@flashcards/sync/cloud-library";
import type {
  CloudRecordStore,
  CloudVersionedRecord,
} from "@flashcards/sync/cloud-library";

export const cloudLibraryRecordType = "FlashNFlipLibraryV1";
const maximumPayloadBytes = 200 * 1024;
const scriptURL = "https://cdn.apple-cloudkit.com/ck/2/cloudkit.js";

type CKError = { serverErrorCode?: string; recordName?: string };
type CKRecord = CKError & {
  recordName?: string;
  recordType?: string;
  recordChangeTag?: string;
  fields?: Record<string, { value: unknown }>;
};
type CKResponse = {
  hasErrors?: boolean;
  errors?: CKError[];
  records?: CKRecord[];
};

export interface CloudLibraryWebDatabase {
  fetchRecords(recordName: string): Promise<CKResponse>;
  saveRecords(record: CKRecord): Promise<CKResponse>;
}

const validName = (name: string): void => {
  if (!/^[a-zA-Z0-9.-]{1,255}$/.test(name))
    throw new Error("Invalid CloudKit record name");
};

const errorFor = (code: string | undefined): Error => {
  if (code === "SERVER_RECORD_CHANGED" || code === "RECORD_ALREADY_EXISTS") {
    return new CloudLibraryError("WRITE_CONFLICT", "CloudKit record changed");
  }
  if (code === "AUTHENTICATION_REQUIRED") {
    return new CloudLibraryError(
      "ACCOUNT_CHANGED",
      "iCloud sign-in is required",
    );
  }
  return new Error(`CloudKit request failed (${code ?? "UNKNOWN_ERROR"})`);
};

const responseErrors = (response: CKResponse): CKError[] => [
  ...(response.errors ?? []),
  ...(response.records ?? []).filter((record) => record.serverErrorCode),
];

const decode = (record: CKRecord, name: string): CloudVersionedRecord => {
  const payload = record.fields?.payload?.value;
  if (
    record.recordName !== name ||
    record.recordType !== cloudLibraryRecordType ||
    !record.recordChangeTag ||
    record.fields?.schemaVersion?.value !== 1 ||
    typeof payload !== "string" ||
    new TextEncoder().encode(payload).byteLength > maximumPayloadBytes
  ) {
    throw new CloudLibraryError(
      "INVALID_REMOTE_RECORD",
      "CloudKit returned an invalid library record",
    );
  }
  return {
    value: JSON.parse(payload) as unknown,
    changeTag: record.recordChangeTag,
  };
};

// No implicit global account binding or localStorage data lives in this adapter.
// The caller supplies a guard pinned to its durable local account binding.
export function createCloudLibraryWebStore(
  database: CloudLibraryWebDatabase,
  assertAccount: () => Promise<void>,
): CloudRecordStore {
  const request = async (
    operation: () => Promise<CKResponse>,
  ): Promise<CKResponse> => {
    await assertAccount();
    let response: CKResponse;
    try {
      response = await operation();
    } catch (error) {
      if (typeof error === "object" && error && "serverErrorCode" in error) {
        throw errorFor(String(error.serverErrorCode));
      }
      throw error;
    }
    await assertAccount();
    return response;
  };
  return {
    async read(name) {
      validName(name);
      const response = await request(() => database.fetchRecords(name));
      const errors = responseErrors(response);
      const successes = (response.records ?? []).filter(
        (record) => !record.serverErrorCode,
      );
      if (
        errors.length &&
        !successes.length &&
        errors.every(
          (error) =>
            (!error.recordName || error.recordName === name) &&
            (error.serverErrorCode === "UNKNOWN_ITEM" ||
              error.serverErrorCode === "NOT_FOUND"),
        )
      )
        return null;
      if (errors.length || response.hasErrors)
        throw errorFor(errors[0]?.serverErrorCode);
      if (successes.length !== 1) {
        throw new CloudLibraryError(
          "INVALID_REMOTE_RECORD",
          "CloudKit response is incomplete",
        );
      }
      return decode(successes[0]!, name);
    },
    async compareAndSwap(name, expectedTag, value) {
      validName(name);
      if (expectedTag !== null && !expectedTag)
        throw new Error("Empty CloudKit change tag");
      const payload = JSON.stringify(value);
      if (
        payload === undefined ||
        new TextEncoder().encode(payload).byteLength > maximumPayloadBytes
      ) {
        throw new Error(
          "CloudKit metadata exceeds the record limit; use chunked content transfer",
        );
      }
      const response = await request(() =>
        database.saveRecords({
          recordName: name,
          recordType: cloudLibraryRecordType,
          ...(expectedTag !== null ? { recordChangeTag: expectedTag } : {}),
          fields: { schemaVersion: { value: 1 }, payload: { value: payload } },
        }),
      );
      const errors = responseErrors(response);
      if (errors.length || response.hasErrors)
        throw errorFor(errors[0]?.serverErrorCode);
      const records = response.records ?? [];
      if (records.length !== 1)
        throw new CloudLibraryError(
          "INVALID_REMOTE_RECORD",
          "CloudKit did not confirm the write",
        );
      decode(records[0]!, name);
    },
  };
}

type Identity = { userRecordName: string };
type Container = {
  privateCloudDatabase: CloudLibraryWebDatabase;
  setUpAuth(): Promise<Identity | null>;
  fetchCurrentUserIdentity(): Promise<Identity | null>;
  whenUserSignsIn(): Promise<Identity>;
  whenUserSignsOut(): Promise<void>;
};

// Apple supplies one-shot authentication promises. Re-arm only the opposite
// transition, without a polling timer. Disposing never signs out or deletes data.
export function observeCloudLibraryAccount(
  container: Pick<Container, "setUpAuth" | "whenUserSignsIn" | "whenUserSignsOut">,
  onChange: (account: string | null) => void,
  onError: (error: unknown) => void,
  initialIdentity: () => Promise<Identity | null> = () => container.setUpAuth(),
): () => void {
  let disposed = false;
  const observe = async (): Promise<void> => {
    try {
      let identity = await initialIdentity();
      while (!disposed) {
        // Subscribe before notifying the UI, so an immediate user action is
        // not lost between rendering the new state and arming the next event.
        const next = identity
          ? container.whenUserSignsOut().then(() => null)
          : container.whenUserSignsIn();
        onChange(identity?.userRecordName ?? null);
        identity = await next;
      }
    } catch (error) {
      if (!disposed) onError(error);
    }
  };
  void observe();
  return () => { disposed = true; };
}
type SDK = {
  DEVELOPMENT_ENVIRONMENT: string;
  PRODUCTION_ENVIRONMENT: string;
  configure(configuration: {
    containers: Array<{
      containerIdentifier: string;
      environment: string;
      apiTokenAuth: {
        apiToken: string;
        persist: boolean;
        signInButton: { id: string };
        signOutButton: { id: string };
      };
    }>;
  }): void;
  getDefaultContainer(): Container;
};

export type CloudLibraryWebConfiguration = {
  containerIdentifier: "iCloud.com.flash-n-flip";
  apiToken: string;
  environment: "development" | "production";
  signInButtonId: string;
  signOutButtonId: string;
};

let sdkPromise: Promise<SDK> | null = null;
let activeConfiguration: string | null = null;

const loadSDK = (): Promise<SDK> => {
  if (typeof window === "undefined")
    return Promise.reject(new Error("CloudKit JS requires a browser"));
  const browser = window as typeof window & { CloudKit?: SDK };
  if (browser.CloudKit) return Promise.resolve(browser.CloudKit);
  sdkPromise ??= new Promise<SDK>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptURL;
    script.async = true;
    let finished = false;
    const timeout = window.setTimeout(
      () => finish(new Error("CloudKit JS loading timed out")),
      20_000,
    );
    const finish = (error?: Error): void => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      if (error || !browser.CloudKit) {
        script.remove();
        reject(error ?? new Error("CloudKit JS did not initialize"));
      } else resolve(browser.CloudKit);
    };
    script.onload = () => finish();
    script.onerror = () => finish(new Error("CloudKit JS could not be loaded"));
    document.head.append(script);
  }).catch((error: unknown) => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
};

// Explicit preparation only. Importing this module never contacts Apple.
// The settings/runtime integration must persist and approve account binding
// before asking this session for a store. Apple UI is rendered into the two IDs.
export async function prepareCloudLibraryWeb(
  configuration: CloudLibraryWebConfiguration,
): Promise<{
  account(): Promise<string | null>;
  observeAccount(
    onChange: (account: string | null) => void,
    onError: (error: unknown) => void,
  ): () => void;
  storeForAccount(expectedAccount: string): CloudRecordStore;
}> {
  if (
    configuration.containerIdentifier !== "iCloud.com.flash-n-flip" ||
    !configuration.apiToken.trim() ||
    !["development", "production"].includes(configuration.environment)
  ) {
    throw new Error(
      "Flash-n-Flip CloudKit configuration is missing or invalid",
    );
  }
  if (
    typeof document === "undefined" ||
    !document.getElementById(configuration.signInButtonId) ||
    !document.getElementById(configuration.signOutButtonId)
  ) {
    throw new Error(
      "Apple sign-in and sign-out controls must be mounted first",
    );
  }
  const sdk = await loadSDK();
  const configurationKey = JSON.stringify(configuration);
  if (
    activeConfiguration !== null &&
    activeConfiguration !== configurationKey
  ) {
    throw new Error(
      "Reload before changing the CloudKit environment or container configuration",
    );
  }
  if (activeConfiguration === null) {
    sdk.configure({
      containers: [
        {
          containerIdentifier: configuration.containerIdentifier,
          environment:
            configuration.environment === "development"
              ? sdk.DEVELOPMENT_ENVIRONMENT
              : sdk.PRODUCTION_ENVIRONMENT,
          apiTokenAuth: {
            apiToken: configuration.apiToken,
            persist: true,
            signInButton: { id: configuration.signInButtonId },
            signOutButton: { id: configuration.signOutButtonId },
          },
        },
      ],
    });
    activeConfiguration = configurationKey;
  }
  const container = sdk.getDefaultContainer();
  const identity = async (): Promise<Identity | null> => {
    try {
      return await container.fetchCurrentUserIdentity();
    } catch (error) {
      if (typeof error === "object" && error && "serverErrorCode" in error &&
          error.serverErrorCode === "AUTHENTICATION_REQUIRED") return null;
      throw error;
    }
  };
  const account = async (): Promise<string | null> =>
    (await identity())?.userRecordName ?? null;
  // This is the only UI-building call. Account guards must never rebuild the
  // Apple controls while a connection or a transfer is in progress.
  await container.setUpAuth();
  return {
    account,
    observeAccount: (onChange, onError) =>
      observeCloudLibraryAccount(container, onChange, onError, identity),
    storeForAccount(expectedAccount) {
      if (!expectedAccount)
        throw new Error("A durable account binding is required");
      let invalidated = false;
      return createCloudLibraryWebStore(
        container.privateCloudDatabase,
        async () => {
          if (invalidated || (await account()) !== expectedAccount) {
            invalidated = true;
            throw new CloudLibraryError(
              "ACCOUNT_CHANGED",
              "The iCloud account changed; local data must stay bound to its original account",
            );
          }
        },
      );
    },
  };
}
