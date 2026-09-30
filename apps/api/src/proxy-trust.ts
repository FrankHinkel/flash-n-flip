import { BlockList, isIP } from "node:net";

const internalProxies = new BlockList();
internalProxies.addSubnet("127.0.0.0", 8);
internalProxies.addSubnet("10.0.0.0", 8);
internalProxies.addSubnet("172.16.0.0", 12);
internalProxies.addSubnet("192.168.0.0", 16);
internalProxies.addAddress("::1", "ipv6");
internalProxies.addSubnet("fc00::", 7, "ipv6");

// The API has no published port in production Compose. Its two proxies run
// on the private Docker network. A hop count alone also trusts public peers.
export function trustProxyForEnvironment(
  environment: "development" | "test" | "production",
): false | ((address: string, hop: number) => boolean) {
  if (environment !== "production") return false;
  return (address, hop) => {
    if (hop >= 2) return false;
    const version = isIP(address);
    return (
      version !== 0 &&
      internalProxies.check(address, version === 4 ? "ipv4" : "ipv6")
    );
  };
}
