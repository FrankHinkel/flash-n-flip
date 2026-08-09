export const dynamic = "force-static";

export function GET() {
  return new Response(null, {
    status: 307,
    headers: {
      location: "/connect/index.html",
    },
  });
}
