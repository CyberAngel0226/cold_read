import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { runMvpDecisionRunApi } from "./src/mvp-decision-run-api.js";

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export default defineConfig({
  plugins: [
    vue(),
    {
      name: "coldread-mvp-api",
      configureServer(server) {
        server.middlewares.use("/api/decision-runs", async (request, response) => {
          if (request.method !== "POST") {
            response.statusCode = 405;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ kind: "api_error", message: "Method not allowed." }));
            return;
          }

          try {
            const body = await readJsonBody(request);
            const apiResponse = await runMvpDecisionRunApi(
              body !== null && typeof body === "object" ? body : {},
            );

            response.statusCode = apiResponse.status;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify(apiResponse.body));
          } catch {
            response.statusCode = 400;
            response.setHeader("Content-Type", "application/json");
            response.end(
              JSON.stringify({
                kind: "api_error",
                message: "Request body must be valid JSON.",
              }),
            );
          }
        });
      },
    },
  ],
});
