import Capacitor
import Foundation
import WebRTC

private final class FlashNFlipPeerDelegate: NSObject, RTCPeerConnectionDelegate {
    weak var plugin: FlashNFlipAppleWebRTCPlugin?
    let connectionId: String

    init(plugin: FlashNFlipAppleWebRTCPlugin, connectionId: String) {
        self.plugin = plugin
        self.connectionId = connectionId
    }

    func peerConnection(
        _ peerConnection: RTCPeerConnection,
        didChange stateChanged: RTCSignalingState
    ) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}

    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}

    func peerConnection(
        _ peerConnection: RTCPeerConnection,
        didChange newState: RTCIceConnectionState
    ) {}

    func peerConnection(
        _ peerConnection: RTCPeerConnection,
        didChange newState: RTCIceGatheringState
    ) {
        plugin?.emitIceGatheringState(connectionId: connectionId, state: newState)
    }

    func peerConnection(
        _ peerConnection: RTCPeerConnection,
        didGenerate candidate: RTCIceCandidate
    ) {}

    func peerConnection(
        _ peerConnection: RTCPeerConnection,
        didRemove candidates: [RTCIceCandidate]
    ) {}

    func peerConnection(
        _ peerConnection: RTCPeerConnection,
        didOpen dataChannel: RTCDataChannel
    ) {
        plugin?.registerRemoteChannel(
            connectionId: connectionId,
            dataChannel: dataChannel)
    }

    func peerConnection(
        _ peerConnection: RTCPeerConnection,
        didChange newState: RTCPeerConnectionState
    ) {
        plugin?.emitPeerConnectionState(connectionId: connectionId, state: newState)
    }
}

private final class FlashNFlipDataChannelDelegate: NSObject, RTCDataChannelDelegate {
    weak var plugin: FlashNFlipAppleWebRTCPlugin?
    let connectionId: String
    let channelId: String

    init(
        plugin: FlashNFlipAppleWebRTCPlugin,
        connectionId: String,
        channelId: String
    ) {
        self.plugin = plugin
        self.connectionId = connectionId
        self.channelId = channelId
    }

    func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {
        plugin?.emitDataChannelState(
            connectionId: connectionId,
            channelId: channelId,
            state: dataChannel.readyState)
    }

    func dataChannel(
        _ dataChannel: RTCDataChannel,
        didReceiveMessageWith buffer: RTCDataBuffer
    ) {
        plugin?.emitDataMessage(
            connectionId: connectionId,
            channelId: channelId,
            data: buffer.data,
            isBinary: buffer.isBinary)
    }

    func dataChannel(
        _ dataChannel: RTCDataChannel,
        didChangeBufferedAmount amount: UInt64
    ) {
        plugin?.emitBufferedAmount(
            connectionId: connectionId,
            channelId: channelId,
            amount: dataChannel.bufferedAmount)
    }
}

private final class FlashNFlipDataChannelContext {
    let channel: RTCDataChannel
    let delegate: FlashNFlipDataChannelDelegate

    init(channel: RTCDataChannel, delegate: FlashNFlipDataChannelDelegate) {
        self.channel = channel
        self.delegate = delegate
        channel.delegate = delegate
    }
}

private final class FlashNFlipPeerContext {
    let connection: RTCPeerConnection
    let delegate: FlashNFlipPeerDelegate
    var channels: [String: FlashNFlipDataChannelContext] = [:]

    init(connection: RTCPeerConnection, delegate: FlashNFlipPeerDelegate) {
        self.connection = connection
        self.delegate = delegate
    }
}

@objc(FlashNFlipAppleWebRTCPlugin)
public final class FlashNFlipAppleWebRTCPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FlashNFlipAppleWebRTCPlugin"
    public let jsName = "FlashNFlipAppleWebRTC"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createPeerConnection", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createDataChannel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createOffer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createAnswer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLocalDescription", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRemoteDescription", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getLocalDescription", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeDataChannel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closePeerConnection", returnType: CAPPluginReturnPromise)
    ]

    private let factory = RTCPeerConnectionFactory()
    private let worker = DispatchQueue(label: "com.flash-n-flip.native-webrtc")
    private var peers: [String: FlashNFlipPeerContext] = [:]

    @objc public func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc public func createPeerConnection(_ call: CAPPluginCall) {
        guard let connectionId = requiredString(call, "connectionId") else { return }
        let iceServerUrls = call.getArray("iceServers", String.self) ?? []
        guard iceServerUrls.allSatisfy({ $0.hasPrefix("stun:") }) else {
            call.reject("Only STUN servers are permitted")
            return
        }
        worker.async { [weak self] in
            guard let self else { return }
            guard self.peers[connectionId] == nil else {
                call.reject("Peer connection already exists")
                return
            }
            let configuration = RTCConfiguration()
            configuration.sdpSemantics = .unifiedPlan
            configuration.iceTransportPolicy = .all
            configuration.iceServers = iceServerUrls.isEmpty
                ? []
                : [RTCIceServer(urlStrings: iceServerUrls)]
            let constraints = RTCMediaConstraints(
                mandatoryConstraints: nil,
                optionalConstraints: nil)
            let delegate = FlashNFlipPeerDelegate(
                plugin: self,
                connectionId: connectionId)
            guard let connection = self.factory.peerConnection(
                with: configuration,
                constraints: constraints,
                delegate: delegate)
            else {
                call.reject("Native peer connection could not be created")
                return
            }
            self.peers[connectionId] = FlashNFlipPeerContext(
                connection: connection,
                delegate: delegate)
            call.resolve()
        }
    }

    @objc public func createDataChannel(_ call: CAPPluginCall) {
        guard let connectionId = requiredString(call, "connectionId"),
              let label = requiredString(call, "label") else { return }
        worker.async { [weak self] in
            guard let self,
                  let peer = self.peers[connectionId] else {
                call.reject("Peer connection is missing")
                return
            }
            let configuration = RTCDataChannelConfiguration()
            configuration.isOrdered = true
            guard let channel = peer.connection.dataChannel(
                forLabel: label,
                configuration: configuration)
            else {
                call.reject("Native data channel could not be created")
                return
            }
            let channelId = UUID().uuidString
            self.storeChannel(
                peer: peer,
                connectionId: connectionId,
                channelId: channelId,
                channel: channel)
            call.resolve([
                "channelId": channelId,
                "state": self.dataChannelState(channel.readyState),
                "bufferedAmount": Int(channel.bufferedAmount)
            ])
        }
    }

    @objc public func createOffer(_ call: CAPPluginCall) {
        createDescription(call, offer: true)
    }

    @objc public func createAnswer(_ call: CAPPluginCall) {
        createDescription(call, offer: false)
    }

    private func createDescription(_ call: CAPPluginCall, offer: Bool) {
        guard let connectionId = requiredString(call, "connectionId") else { return }
        worker.async { [weak self] in
            guard let peer = self?.peers[connectionId] else {
                call.reject("Peer connection is missing")
                return
            }
            let constraints = RTCMediaConstraints(
                mandatoryConstraints: nil,
                optionalConstraints: nil)
            let completion: (RTCSessionDescription?, Error?) -> Void = { description, error in
                if let error {
                    call.reject("Session description could not be created", nil, error)
                    return
                }
                guard let description else {
                    call.reject("Session description is missing")
                    return
                }
                call.resolve(self?.json(description: description) ?? [:])
            }
            if offer {
                peer.connection.offer(for: constraints, completionHandler: completion)
            } else {
                peer.connection.answer(for: constraints, completionHandler: completion)
            }
        }
    }

    @objc public func setLocalDescription(_ call: CAPPluginCall) {
        setDescription(call, local: true)
    }

    @objc public func setRemoteDescription(_ call: CAPPluginCall) {
        setDescription(call, local: false)
    }

    private func setDescription(_ call: CAPPluginCall, local: Bool) {
        guard let connectionId = requiredString(call, "connectionId"),
              let type = requiredString(call, "type"),
              let sdp = requiredString(call, "sdp"),
              let sdpType = sdpType(type) else {
            if call.getString("type") != nil { call.reject("Unsupported SDP type") }
            return
        }
        worker.async { [weak self] in
            guard let peer = self?.peers[connectionId] else {
                call.reject("Peer connection is missing")
                return
            }
            let description = RTCSessionDescription(type: sdpType, sdp: sdp)
            let completion: (Error?) -> Void = { error in
                if let error {
                    call.reject("Session description could not be applied", nil, error)
                } else {
                    call.resolve()
                }
            }
            if local {
                peer.connection.setLocalDescription(
                    description,
                    completionHandler: completion)
            } else {
                peer.connection.setRemoteDescription(
                    description,
                    completionHandler: completion)
            }
        }
    }

    @objc public func getLocalDescription(_ call: CAPPluginCall) {
        guard let connectionId = requiredString(call, "connectionId") else { return }
        worker.async { [weak self] in
            guard let self,
                  let description = self.peers[connectionId]?.connection.localDescription else {
                call.reject("Local session description is missing")
                return
            }
            call.resolve(self.json(description: description))
        }
    }

    @objc public func sendData(_ call: CAPPluginCall) {
        guard let connectionId = requiredString(call, "connectionId"),
              let channelId = requiredString(call, "channelId"),
              let dataBase64 = requiredString(call, "dataBase64"),
              let data = Data(base64Encoded: dataBase64) else {
            if call.getString("dataBase64") != nil { call.reject("Data is not valid Base64") }
            return
        }
        guard data.count <= 512 * 1024 else {
            call.reject("A native DataChannel message is limited to 512 KB")
            return
        }
        let isBinary = call.getBool("isBinary") ?? false
        worker.async { [weak self] in
            guard let channel = self?.peers[connectionId]?.channels[channelId]?.channel else {
                call.reject("Data channel is missing")
                return
            }
            guard channel.readyState == .open,
                  channel.sendData(RTCDataBuffer(data: data, isBinary: isBinary)) else {
                call.reject("Data channel is not open")
                return
            }
            call.resolve(["bufferedAmount": Int(channel.bufferedAmount)])
        }
    }

    @objc public func closeDataChannel(_ call: CAPPluginCall) {
        guard let connectionId = requiredString(call, "connectionId"),
              let channelId = requiredString(call, "channelId") else { return }
        worker.async { [weak self] in
            self?.peers[connectionId]?.channels.removeValue(forKey: channelId)?.channel.close()
            call.resolve()
        }
    }

    @objc public func closePeerConnection(_ call: CAPPluginCall) {
        guard let connectionId = requiredString(call, "connectionId") else { return }
        worker.async { [weak self] in
            guard let peer = self?.peers.removeValue(forKey: connectionId) else {
                call.resolve()
                return
            }
            peer.channels.values.forEach { $0.channel.close() }
            peer.connection.close()
            call.resolve()
        }
    }

    fileprivate func registerRemoteChannel(
        connectionId: String,
        dataChannel: RTCDataChannel
    ) {
        worker.async { [weak self] in
            guard let self,
                  let peer = self.peers[connectionId] else { return }
            let channelId = UUID().uuidString
            self.storeChannel(
                peer: peer,
                connectionId: connectionId,
                channelId: channelId,
                channel: dataChannel)
            self.emit("dataChannel", [
                "connectionId": connectionId,
                "channelId": channelId,
                "label": dataChannel.label,
                "state": self.dataChannelState(dataChannel.readyState)
            ])
        }
    }

    private func storeChannel(
        peer: FlashNFlipPeerContext,
        connectionId: String,
        channelId: String,
        channel: RTCDataChannel
    ) {
        let delegate = FlashNFlipDataChannelDelegate(
            plugin: self,
            connectionId: connectionId,
            channelId: channelId)
        peer.channels[channelId] = FlashNFlipDataChannelContext(
            channel: channel,
            delegate: delegate)
    }

    fileprivate func emitIceGatheringState(
        connectionId: String,
        state: RTCIceGatheringState
    ) {
        let value: String
        switch state {
        case .new: value = "new"
        case .gathering: value = "gathering"
        case .complete: value = "complete"
        @unknown default: value = "new"
        }
        emit("iceGatheringState", ["connectionId": connectionId, "state": value])
    }

    fileprivate func emitPeerConnectionState(
        connectionId: String,
        state: RTCPeerConnectionState
    ) {
        let value: String
        switch state {
        case .new: value = "new"
        case .connecting: value = "connecting"
        case .connected: value = "connected"
        case .disconnected: value = "disconnected"
        case .failed: value = "failed"
        case .closed: value = "closed"
        @unknown default: value = "failed"
        }
        emit("peerConnectionState", ["connectionId": connectionId, "state": value])
    }

    fileprivate func emitDataChannelState(
        connectionId: String,
        channelId: String,
        state: RTCDataChannelState
    ) {
        emit("dataChannelState", [
            "connectionId": connectionId,
            "channelId": channelId,
            "state": dataChannelState(state)
        ])
    }

    fileprivate func emitDataMessage(
        connectionId: String,
        channelId: String,
        data: Data,
        isBinary: Bool
    ) {
        emit("dataMessage", [
            "connectionId": connectionId,
            "channelId": channelId,
            "dataBase64": data.base64EncodedString(),
            "isBinary": isBinary
        ])
    }

    fileprivate func emitBufferedAmount(
        connectionId: String,
        channelId: String,
        amount: UInt64
    ) {
        emit("bufferedAmount", [
            "connectionId": connectionId,
            "channelId": channelId,
            "amount": Int(amount)
        ])
    }

    private func emit(_ event: String, _ data: [String: Any]) {
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners(event, data: data)
        }
    }

    private func requiredString(_ call: CAPPluginCall, _ key: String) -> String? {
        guard let value = call.getString(key), !value.isEmpty else {
            call.reject("\(key) is required")
            return nil
        }
        return value
    }

    private func sdpType(_ value: String) -> RTCSdpType? {
        switch value {
        case "offer": return .offer
        case "answer": return .answer
        default: return nil
        }
    }

    private func json(description: RTCSessionDescription) -> [String: Any] {
        [
            "type": RTCSessionDescription.string(for: description.type),
            "sdp": description.sdp
        ]
    }

    private func dataChannelState(_ state: RTCDataChannelState) -> String {
        switch state {
        case .connecting: return "connecting"
        case .open: return "open"
        case .closing: return "closing"
        case .closed: return "closed"
        @unknown default: return "closed"
        }
    }
}
