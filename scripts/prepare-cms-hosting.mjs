import { access, cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const source = resolve(root, "cms/dist/cms/browser");
const target = resolve(root, "client/dist/client/browser/cms");
await access(resolve(source, "index.html"));
await access(resolve(root, "client/dist/client/browser/index.html"));
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log(
  "CMS copied to existing Hosting build at /cms/. No deployment performed.",
);
