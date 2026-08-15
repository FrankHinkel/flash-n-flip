export type SerialInstallQueue = {
  enqueue<T>(operation: () => Promise<T>): Promise<T>;
};

export const createSerialInstallQueue = (): SerialInstallQueue => {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue<T>(operation: () => Promise<T>): Promise<T> {
      const pending = tail.then(operation, operation);
      tail = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    },
  };
};
