import { Hono } from "hono";

type Env = {
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Env }>();

app.get("/api/*", (c) => c.json({ name: "Cloudflare" }));

// Intercept all requests to inject Firebase config into index.html
app.get("*", async (c) => {
  const url = new URL(c.req.url);

  // Helper to fetch assets safely
  const getAsset = (req: Request) => {
    if (c.env?.ASSETS?.fetch) {
      return c.env.ASSETS.fetch(req);
    }
    return fetch(req);
  };

  // If it's an API request or looks like a static asset that isn't HTML, just let it pass through
  if (
    url.pathname.startsWith("/api/") ||
    (url.pathname.includes(".") && !url.pathname.endsWith(".html"))
  ) {
    return getAsset(c.req.raw);
  }

  // For all other requests (like / or SPA routes), serve index.html with injection
  const response = await getAsset(c.req.raw);

  if (
    response.status === 200 &&
    response.headers.get("content-type")?.includes("text/html")
  ) {
    const config = {
      apiKey: "AIzaSyCjy8Kb9MWb4KnKdN4iaH3_fXO40PXLjgQ",
      authDomain: "tps-loan-calculator.firebaseapp.com",
      projectId: "tps-loan-calculator",
      appId: "1:621307918285:web:ff9c4dabd49db6c794b684",
      storageBucket: "tps-loan-calculator.firebasestorage.app",
      messagingSenderId: "621307918285",
      measurementId: "G-DXSK0TFBFN",
    };

    // Only inject if at least some config is present
    if (Object.values(config).some(Boolean)) {
      const safeConfigJson = JSON.stringify(config)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e");
      const res = new HTMLRewriter()
        .on("head", {
          element(element) {
            element.append(
              `<script>window.__FIREBASE_CONFIG__ = ${safeConfigJson};</script>`,
              { html: true },
            );
          },
        })
        .transform(response);
      
      res.headers.set("X-Content-Type-Options", "nosniff");
      res.headers.set("X-Frame-Options", "DENY");
      res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      return res;
    }
  }

  return response;
});

export default app;
