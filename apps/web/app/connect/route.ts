export const dynamic = "force-static";

export function GET(request: Request) {
  return Response.redirect(new URL("/connect/index.html", request.url), 307);
}
