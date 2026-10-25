import Foundation
import CloudKit

@main
struct NativeSyncCancellationChecks {
    static func main() {
        let expected: [Error] = [
            CancellationError(),
            CKError(.operationCancelled),
            NSError(domain:NSURLErrorDomain, code:NSURLErrorCancelled)
        ]
        for error in expected {
            precondition(FlashNFlipSyncEngine.isExpectedCancellation(error))
        }
        let genuine: [Error] = [
            CKError(.networkUnavailable), CKError(.quotaExceeded),
            NSError(domain:"FNFSQLite",code:1),
            NSError(domain:NSURLErrorDomain,code:NSURLErrorTimedOut)
        ]
        for error in genuine {
            precondition(!FlashNFlipSyncEngine.isExpectedCancellation(error))
        }
        print("Native cancellation checks passed (3 expected cancellations, 4 genuine errors).")
    }
}
