import { Hono } from "hono";

type Env = {
  FIREBASE_API_KEY?: string;
  FIREBASE_AUTH_DOMAIN?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_APP_ID?: string;
  FIREBASE_STORAGE_BUCKET?: string;
  FIREBASE_MESSAGING_SENDER_ID?: string;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Env }>();

app.get("/api/*", (c) => c.json({ name: "Cloudflare" }));

// Intercept all requests to inject Firebase config into index.html
app.get("*", async (c) => {
  const url = new URL(c.req.url);

  // If it's an API request or looks like a static asset that isn't HTML, just let it pass through
  if (
    url.pathname.startsWith("/api/") ||
    (url.pathname.includes(".") && !url.pathname.endsWith(".html"))
  ) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  // For all other requests (like / or SPA routes), serve index.html with injection
  const response = await c.env.ASSETS.fetch(c.req.raw);

  if (
    response.status === 200 &&
    response.headers.get("content-type")?.includes("text/html")
  ) {
    const config = {
      apiKey: c.env.FIREBASE_API_KEY,
      authDomain: c.env.FIREBASE_AUTH_DOMAIN,
      projectId: c.env.FIREBASE_PROJECT_ID,
      appId: c.env.FIREBASE_APP_ID,
      storageBucket: c.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: c.env.FIREBASE_MESSAGING_SENDER_ID,
    };

    // Only inject if at least some config is present
    if (Object.values(config).some(Boolean)) {
      return new HTMLRewriter()
        .on("head", {
          element(element) {
            element.append(
              `<script>window.__FIREBASE_CONFIG__ = ${JSON.stringify(config)};</script>`,
              { html: true },
            );
          },
        })
        .transform(response);
    }
  }

  return response;
});

export default app;
