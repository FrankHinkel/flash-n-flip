import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

type NativeSessionDescription = {
  type: "offer" | "answer";
  sdp: string;
};

type NativeChannelCreated = {
  channelId: string;
  state: RTCDataChannelState;
  bufferedAmount: number;
};

type NativeWebRtcPlugin = {
  isAvailable(): Promise<{ available: boolean }>;
  createPeerConnection(input: {
    connectionId: string;
    iceServers: string[];
  }): Promise<void>;
  createDataChannel(input: {
    connectionId: string;
    label: string;
  }): Promise<NativeChannelCreated>;
  createOffer(input: {
    connectionId: string;
  }): Promise<NativeSessionDescription>;
  createAnswer(input: {
    connectionId: string;
  }): Promise<NativeSessionDescription>;
  setLocalDescription(input: {
    connectionId: string;
    type: string;
    sdp: string;
  }): Promise<void>;
  setRemoteDescription(input: {
    connectionId: string;
    type: string;
    sdp: string;
  }): Promise<void>;
  getLocalDescription(input: {
    connectionId: string;
  }): Promise<NativeSessionDescription>;
  sendData(input: {
    connectionId: string;
    channelId: string;
    dataBase64: string;
    isBinary: boolean;
  }): Promise<{ bufferedAmount: number }>;
  closeDataChannel(input: {
    connectionId: string;
    channelId: string;
  }): Promise<void>;
  closePeerConnection(input: { connectionId: string }): Promise<void>;
  addListener(
    eventName: string,
    listener: (event: Record<string, unknown>) => void,
  ): Promise<PluginListenerHandle>;
};

const nativeWebRtc = registerPlugin<NativeWebRtcPlugin>(
  "FlashNFlipAppleWebRTC",
);

const peerConnections = new Map<string, NativePeerConnection>();

const eventString = (
  event: Record<string, unknown>,
  key: string,
): string | null => (typeof event[key] === "string" ? event[key] : null);

let listenersReady: Promise<void> | null = null;

const ensureNativeListeners = (): Promise<void> => {
  listenersReady ??= Promise.all([
    nativeWebRtc.addListener("iceGatheringState", (event) => {
      const connectionId = eventString(event, "connectionId");
      const state = eventString(event, "state");
      if (connectionId && state) {
        peerConnections
          .get(connectionId)
          ?.setIceGatheringState(state as RTCIceGatheringState);
      }
    }),
    nativeWebRtc.addListener("peerConnectionState", (event) => {
      const connectionId = eventString(event, "connectionId");
      const state = eventString(event, "state");
      if (connectionId && state) {
        peerConnections
          .get(connectionId)
          ?.setConnectionState(state as RTCPeerConnectionState);
      }
    }),
    nativeWebRtc.addListener("dataChannel", (event) => {
      const connectionId = eventString(event, "connectionId");
      const channelId = eventString(event, "channelId");
      const label = eventString(event, "label");
      const state = eventString(event, "state");
      if (connectionId && channelId && label && state) {
        peerConnections.get(connectionId)?.acceptRemoteDataChannel({
          channelId,
          label,
          state: state as RTCDataChannelState,
        });
      }
    }),
    nativeWebRtc.addListener("dataChannelState", (event) => {
      const connectionId = eventString(event, "connectionId");
      const channelId = eventString(event, "channelId");
      const state = eventString(event, "state");
      if (connectionId && channelId && state) {
        peerConnections
          .get(connectionId)
          ?.channel(channelId)
          ?.setReadyState(state as RTCDataChannelState);
      }
    }),
    nativeWebRtc.addListener("dataMessage", (event) => {
      const connectionId = eventString(event, "connectionId");
      const channelId = eventString(event, "channelId");
      const dataBase64 = eventString(event, "dataBase64");
      if (connectionId && channelId && dataBase64 !== null) {
        peerConnections
          .get(connectionId)
          ?.channel(channelId)
          ?.receive(dataBase64, event.isBinary === true);
      }
    }),
    nativeWebRtc.addListener("bufferedAmount", (event) => {
      const connectionId = eventString(event, "connectionId");
      const channelId = eventString(event, "channelId");
      const amount = event.amount;
      if (
        connectionId &&
        channelId &&
        typeof amount === "number" &&
        Number.isSafeInteger(amount) &&
        amount >= 0
      ) {
        peerConnections
          .get(connectionId)
          ?.channel(channelId)
          ?.setNativeBufferedAmount(amount);
      }
    }),
  ]).then(() => undefined);
  return listenersReady;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
};

const base64ToBytes = (encoded: string): Uint8Array => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const dataBytes = async (
  data: string | Blob | ArrayBuffer | ArrayBufferView,
): Promise<{ bytes: Uint8Array; isBinary: boolean }> => {
  if (typeof data === "string") {
    return { bytes: new TextEncoder().encode(data), isBinary: false };
  }
  if (data instanceof Blob) {
    return { bytes: new Uint8Array(await data.arrayBuffer()), isBinary: true };
  }
  if (ArrayBuffer.isView(data)) {
    return {
      bytes: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      isBinary: true,
    };
  }
  return { bytes: new Uint8Array(data), isBinary: true };
};

class NativeDataChannel extends EventTarget {
  binaryType: BinaryType = "blob";
  bufferedAmountLowThreshold = 0;
  readonly label: string;
  readonly ordered = true;
  readonly protocol = "";
  readonly negotiated = false;
  readonly maxPacketLifeTime: number | null = null;
  readonly maxRetransmits: number | null = null;
  readyState: RTCDataChannelState = "connecting";
  private channelId: string | null = null;
  private nativeBufferedAmount = 0;
  private pendingBridgeBytes = 0;
  private sendQueue = Promise.resolve();

  constructor(
    private readonly connectionId: string,
    label: string,
  ) {
    super();
    this.label = label;
  }

  get bufferedAmount(): number {
    return this.nativeBufferedAmount + this.pendingBridgeBytes;
  }

  attach(input: NativeChannelCreated): void {
    this.channelId = input.channelId;
    this.nativeBufferedAmount = input.bufferedAmount;
    this.setReadyState(input.state);
  }

  setReadyState(state: RTCDataChannelState): void {
    if (this.readyState === state) return;
    this.readyState = state;
    if (state === "open") this.dispatchEvent(new Event("open"));
    if (state === "closed") this.dispatchEvent(new Event("close"));
  }

  setNativeBufferedAmount(amount: number): void {
    const previous = this.bufferedAmount;
    this.nativeBufferedAmount = amount;
    this.emitBufferedAmountLow(previous);
  }

  receive(dataBase64: string, isBinary: boolean): void {
    const bytes = base64ToBytes(dataBase64);
    const copied = new Uint8Array(bytes.byteLength);
    copied.set(bytes);
    const data: string | ArrayBuffer | Blob = isBinary
      ? this.binaryType === "arraybuffer"
        ? copied.buffer
        : new Blob([copied.buffer])
      : new TextDecoder().decode(bytes);
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  send(data: string | Blob | ArrayBuffer | ArrayBufferView): void {
    if (this.readyState !== "open") {
      throw new DOMException("Data channel is not open", "InvalidStateError");
    }
    const estimatedBytes =
      typeof data === "string"
        ? new TextEncoder().encode(data).byteLength
        : data instanceof Blob
          ? data.size
          : data.byteLength;
    this.pendingBridgeBytes += estimatedBytes;
    this.sendQueue = this.sendQueue
      .then(async () => {
        const channelId = this.channelId;
        if (!channelId) throw new Error("Native data channel is not ready");
        const payload = await dataBytes(data);
        const result = await nativeWebRtc.sendData({
          connectionId: this.connectionId,
          channelId,
          dataBase64: bytesToBase64(payload.bytes),
          isBinary: payload.isBinary,
        });
        const previous = this.bufferedAmount;
        this.pendingBridgeBytes = Math.max(
          0,
          this.pendingBridgeBytes - estimatedBytes,
        );
        this.nativeBufferedAmount = result.bufferedAmount;
        this.emitBufferedAmountLow(previous);
      })
      .catch(() => {
        this.pendingBridgeBytes = Math.max(
          0,
          this.pendingBridgeBytes - estimatedBytes,
        );
        this.dispatchEvent(new Event("error"));
      });
  }

  close(): void {
    if (this.readyState === "closed" || this.readyState === "closing") return;
    this.readyState = "closing";
    const channelId = this.channelId;
    if (channelId) {
      void nativeWebRtc
        .closeDataChannel({ connectionId: this.connectionId, channelId })
        .catch(() => undefined);
    }
  }

  private emitBufferedAmountLow(previous: number): void {
    if (
      previous > this.bufferedAmountLowThreshold &&
      this.bufferedAmount <= this.bufferedAmountLowThreshold
    ) {
      this.dispatchEvent(new Event("bufferedamountlow"));
    }
  }
}

class NativePeerConnection extends EventTarget {
  readonly connectionId = crypto.randomUUID();
  connectionState: RTCPeerConnectionState = "new";
  iceGatheringState: RTCIceGatheringState = "new";
  localDescription: RTCSessionDescription | null = null;
  private readonly channels = new Map<string, NativeDataChannel>();
  private readonly localChannelPromises: Promise<void>[] = [];
  private readonly ready: Promise<void>;

  constructor(configuration: RTCConfiguration) {
    super();
    peerConnections.set(this.connectionId, this);
    const iceServers = (configuration.iceServers ?? []).flatMap((server) => {
      const urls =
        typeof server.urls === "string" ? [server.urls] : server.urls;
      return urls.filter((url) => url.startsWith("stun:"));
    });
    this.ready = ensureNativeListeners()
      .then(() => nativeWebRtc.isAvailable())
      .then(({ available }) => {
        if (!available) throw new Error("Native WebRTC is unavailable");
        return nativeWebRtc.createPeerConnection({
          connectionId: this.connectionId,
          iceServers,
        });
      });
  }

  createDataChannel(label: string): RTCDataChannel {
    const channel = new NativeDataChannel(this.connectionId, label);
    const created = this.ready
      .then(() =>
        nativeWebRtc.createDataChannel({
          connectionId: this.connectionId,
          label,
        }),
      )
      .then((result) => {
        channel.attach(result);
        this.channels.set(result.channelId, channel);
      });
    this.localChannelPromises.push(created);
    return channel as unknown as RTCDataChannel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    await this.ready;
    await Promise.all(this.localChannelPromises);
    return nativeWebRtc.createOffer({ connectionId: this.connectionId });
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    await this.ready;
    return nativeWebRtc.createAnswer({ connectionId: this.connectionId });
  }

  async setLocalDescription(
    description: RTCSessionDescriptionInit,
  ): Promise<void> {
    await this.ready;
    if (!description.type || !description.sdp) {
      throw new Error("Local session description is incomplete");
    }
    await nativeWebRtc.setLocalDescription({
      connectionId: this.connectionId,
      type: description.type,
      sdp: description.sdp,
    });
    this.localDescription = {
      type: description.type,
      sdp: description.sdp,
      toJSON: () => ({ type: description.type, sdp: description.sdp }),
    };
  }

  async setRemoteDescription(
    description: RTCSessionDescriptionInit,
  ): Promise<void> {
    await this.ready;
    if (!description.type || !description.sdp) {
      throw new Error("Remote session description is incomplete");
    }
    await nativeWebRtc.setRemoteDescription({
      connectionId: this.connectionId,
      type: description.type,
      sdp: description.sdp,
    });
  }

  async refreshLocalDescription(): Promise<void> {
    await this.ready;
    const description = await nativeWebRtc.getLocalDescription({
      connectionId: this.connectionId,
    });
    this.localDescription = {
      ...description,
      toJSON: () => description,
    };
  }

  close(): void {
    if (this.connectionState === "closed") return;
    this.setConnectionState("closed");
    peerConnections.delete(this.connectionId);
    void this.ready
      .then(() =>
        nativeWebRtc.closePeerConnection({ connectionId: this.connectionId }),
      )
      .catch(() => undefined);
  }

  setIceGatheringState(state: RTCIceGatheringState): void {
    if (this.iceGatheringState === state) return;
    this.iceGatheringState = state;
    this.dispatchEvent(new Event("icegatheringstatechange"));
  }

  setConnectionState(state: RTCPeerConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.dispatchEvent(new Event("connectionstatechange"));
  }

  acceptRemoteDataChannel(input: {
    channelId: string;
    label: string;
    state: RTCDataChannelState;
  }): void {
    const channel = new NativeDataChannel(this.connectionId, input.label);
    channel.attach({
      channelId: input.channelId,
      state: input.state,
      bufferedAmount: 0,
    });
    this.channels.set(input.channelId, channel);
    const event = new Event("datachannel") as Event & {
      channel: RTCDataChannel;
    };
    event.channel = channel as unknown as RTCDataChannel;
    this.dispatchEvent(event);
  }

  channel(channelId: string): NativeDataChannel | undefined {
    return this.channels.get(channelId);
  }
}

export const nativeDirectWebRtcAvailable = (): boolean =>
  Capacitor.isNativePlatform();

export const createNativePeerConnection = (
  configuration: RTCConfiguration,
): RTCPeerConnection =>
  new NativePeerConnection(configuration) as unknown as RTCPeerConnection;

export const refreshNativeLocalDescription = async (
  connection: RTCPeerConnection,
): Promise<void> => {
  const refresh = (
    connection as RTCPeerConnection & {
      refreshLocalDescription?: () => Promise<void>;
    }
  ).refreshLocalDescription;
  if (refresh) await refresh.call(connection);
};
