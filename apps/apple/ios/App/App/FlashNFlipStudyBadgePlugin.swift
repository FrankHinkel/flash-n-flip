import Capacitor
import Foundation
import UIKit
import UserNotifications

@objc(FlashNFlipStudyBadgePlugin)
public final class FlashNFlipStudyBadgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FlashNFlipStudyBadgePlugin"
    public let jsName = "FlashNFlipStudyBadge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPermissionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "replacePlan", returnType: CAPPluginReturnPromise)
    ]

    private let center = UNUserNotificationCenter.current()
    private let identifierPrefix = "flash-n-flip.study-badge."
    private let maximumTransitions = 60

    @objc public func getPermissionStatus(_ call: CAPPluginCall) {
        center.getNotificationSettings { settings in
            call.resolve(["status": self.permissionStatus(settings)])
        }
    }

    @objc public func requestPermission(_ call: CAPPluginCall) {
        center.requestAuthorization(options: [.badge]) { _, error in
            if let error {
                call.reject("Badge permission could not be requested", nil, error)
                return
            }
            self.center.getNotificationSettings { settings in
                call.resolve(["status": self.permissionStatus(settings)])
            }
        }
    }

    @objc public func replacePlan(_ call: CAPPluginCall) {
        guard let dueNow = call.getInt("dueNow"), dueNow >= 0,
              let rawTransitions = call.getArray("transitions", JSObject.self),
              rawTransitions.count <= maximumTransitions
        else {
            call.reject("Invalid study badge plan")
            return
        }

        do {
            let transitions = try parseTransitions(rawTransitions)
            guard transitions.allSatisfy({ $0.dueCount >= dueNow }) else {
                call.reject("Invalid study badge transition")
                return
            }
            let effectiveDueNow = transitions
                .last(where: { $0.at <= Date() })?
                .dueCount ?? dueNow
            setBadgeCount(effectiveDueNow) { badgeError in
                if let badgeError {
                    call.reject("Study badge could not be updated", nil, badgeError)
                    return
                }
                self.replacePendingRequests(with: transitions) { error in
                    if let error {
                        call.reject("Study badge notifications could not be scheduled", nil, error)
                        return
                    }
                    call.resolve()
                }
            }
        } catch {
            call.reject("Invalid study badge transition", nil, error)
        }
    }

    private struct Transition {
        let at: Date
        let dueCount: Int
    }

    private func parseTransitions(_ values: [JSObject]) throws -> [Transition] {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var previousDate = Date.distantPast
        var previousCount = -1
        return try values.map { value in
            guard let at = value["at"] as? String,
                  let date = formatter.date(from: at),
                  let number = value["dueCount"] as? NSNumber
            else {
                throw BadgePlanError.invalidTransition
            }
            let dueCount = number.intValue
            guard date > previousDate, dueCount >= 0, dueCount >= previousCount else {
                throw BadgePlanError.invalidTransition
            }
            previousDate = date
            previousCount = dueCount
            return Transition(at: date, dueCount: dueCount)
        }
    }

    private func replacePendingRequests(
        with transitions: [Transition],
        completion: @escaping (Error?) -> Void
    ) {
        center.getPendingNotificationRequests { requests in
            let previousIdentifiers = requests
                .map(\.identifier)
                .filter { $0.hasPrefix(self.identifierPrefix) }
            self.center.removePendingNotificationRequests(withIdentifiers: previousIdentifiers)

            let future = transitions.filter { $0.at.timeIntervalSinceNow > 0 }
            guard !future.isEmpty else {
                completion(nil)
                return
            }
            let group = DispatchGroup()
            let lock = NSLock()
            var firstError: Error?
            var addedIdentifiers: [String] = []
            for (index, transition) in future.enumerated() {
                let identifier = self.identifierPrefix + String(index) + "." + String(Int(transition.at.timeIntervalSince1970))
                let content = UNMutableNotificationContent()
                content.badge = NSNumber(value: transition.dueCount)
                content.userInfo = ["kind": "study-badge"]

                var calendar = Calendar(identifier: .gregorian)
                calendar.timeZone = TimeZone(secondsFromGMT: 0)!
                var components = calendar.dateComponents(
                    [.year, .month, .day, .hour, .minute, .second],
                    from: transition.at
                )
                components.calendar = calendar
                components.timeZone = calendar.timeZone
                let trigger = UNCalendarNotificationTrigger(
                    dateMatching: components,
                    repeats: false
                )
                let request = UNNotificationRequest(
                    identifier: identifier,
                    content: content,
                    trigger: trigger
                )
                group.enter()
                self.center.add(request) { error in
                    lock.lock()
                    if let error, firstError == nil { firstError = error }
                    if error == nil { addedIdentifiers.append(identifier) }
                    lock.unlock()
                    group.leave()
                }
            }
            group.notify(queue: .main) {
                if firstError != nil {
                    self.center.removePendingNotificationRequests(
                        withIdentifiers: addedIdentifiers
                    )
                }
                completion(firstError)
            }
        }
    }

    private func setBadgeCount(
        _ count: Int,
        completion: @escaping (Error?) -> Void
    ) {
        if #available(iOS 16.0, *) {
            center.setBadgeCount(count, withCompletionHandler: completion)
        } else {
            DispatchQueue.main.async {
                UIApplication.shared.applicationIconBadgeNumber = count
                completion(nil)
            }
        }
    }

    private func permissionStatus(_ settings: UNNotificationSettings) -> String {
        if settings.authorizationStatus != .notDetermined,
           settings.badgeSetting == .disabled {
            return "denied"
        }
        switch settings.authorizationStatus {
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "denied"
        }
    }

    private enum BadgePlanError: Error {
        case invalidTransition
    }
}
