import { randomBytes } from "node:crypto";
import dgram from "node:dgram";

const host = process.argv[2] ?? "127.0.0.1";
const port = Number(process.argv[3] ?? "3478");
if (!host || !Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("Usage: node scripts/probe-stun-only.mjs [host] [port]");
}

const magicCookie = 0x2112a442;

const request = (type, attributes = Buffer.alloc(0)) => {
  const transactionId = randomBytes(12);
  const message = Buffer.alloc(20 + attributes.length);
  message.writeUInt16BE(type, 0);
  message.writeUInt16BE(attributes.length, 2);
  message.writeUInt32BE(magicCookie, 4);
  transactionId.copy(message, 8);
  attributes.copy(message, 20);
  return { message, transactionId };
};

const transact = ({ message, transactionId }, timeoutMs) =>
  new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const finish = (result) => {
      clearTimeout(timer);
      socket.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    socket.once("error", (cause) => {
      clearTimeout(timer);
      socket.close();
      reject(cause);
    });
    socket.on("message", (response) => {
      if (
        response.length >= 20 &&
        response.readUInt32BE(4) === magicCookie &&
        response.subarray(8, 20).equals(transactionId)
      ) {
        finish(response);
      }
    });
    socket.send(message, port, host);
  });

const hasAttribute = (message, expectedType) => {
  const declaredLength = message.readUInt16BE(2);
  const end = Math.min(message.length, 20 + declaredLength);
  let offset = 20;
  while (offset + 4 <= end) {
    const type = message.readUInt16BE(offset);
    const length = message.readUInt16BE(offset + 2);
    if (type === expectedType) return true;
    offset += 4 + Math.ceil(length / 4) * 4;
  }
  return false;
};

const bindingResponse = await transact(request(0x0001), 2_000);
if (
  !bindingResponse ||
  bindingResponse.readUInt16BE(0) !== 0x0101 ||
  !hasAttribute(bindingResponse, 0x0020)
) {
  throw new Error("STUN Binding did not return an XOR-MAPPED-ADDRESS");
}

const requestedTransport = Buffer.from([0x00, 0x19, 0x00, 0x04, 17, 0, 0, 0]);
const allocationResponse = await transact(
  request(0x0003, requestedTransport),
  750,
);
if (allocationResponse) {
  throw new Error("TURN Allocate unexpectedly received a response");
}

console.log("STUN Binding reachable; TURN Allocate ignored.");
