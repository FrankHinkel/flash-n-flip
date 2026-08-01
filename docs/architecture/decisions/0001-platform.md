# ADR 0001: Expo, Next.js, Node.js, and PostgreSQL

Status: superseded by ADR 0018

Use Expo and React Native for native iOS and Android experiences, Next.js for
public Web and Admin surfaces, Fastify on Node.js for the API, and PostgreSQL
for durable server state.

The mobile quality ceiling and access to native accessibility APIs outweigh the
extra UI implementation compared with a WebView wrapper. Share domain,
scheduler, sync, validation, API client, translations, and design tokens.

ADR 0018 replaces the native UI choice with Capacitor and the established Web
experience. Node.js, Next.js, PostgreSQL, and the shared-package boundaries
remain in force.
