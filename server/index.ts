import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, "public");

app.use(express.static(publicDirectory));
app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "moneymind" });
});
app.get("*", (_request, response) => {
  response.sendFile(path.join(publicDirectory, "index.html"));
});

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be provided by the deployment environment");
}

app.listen(port, () => {
  console.info("MoneyMind server started");
});
