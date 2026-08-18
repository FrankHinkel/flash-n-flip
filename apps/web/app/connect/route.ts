export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("source");
  const location =
    source === "app" ? "/connect/index.html?source=app" : "/connect/index.html";
  return new Response(null, {
    status: 307,
    headers: {
      "cache-control": "no-store",
      location,
    },
  });
}
