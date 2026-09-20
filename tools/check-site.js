/* Will the next push deploy? Runs the same check as .github/workflows/deploy.yml, in place, without building _site/.

   node tools/check-site.js

   For every published page: inline <script> blocks must parse, and every local href/src must exist.
   Keep this in step with the "Check every page parses and links resolve" step of the workflow. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const pages = [path.join(ROOT, "index.html")];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) pages.push(p);
  }
})(path.join(ROOT, "books"));

let failed = 0;
for (const file of pages.sort()) {
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  try {
    new Function([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n;\n"));
  } catch (e) { console.error(`${rel}: inline script does not parse — ${e.message}`); failed++; continue; }
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:|#|mailto:|data:)/.test(u)) continue;
    const target = path.resolve(path.dirname(file), u.split("#")[0]);
    // PDFs are stripped from the deployed site, so a link to one would break there
    if (!fs.existsSync(target) || target.endsWith(".pdf")) { console.error(`${rel}: missing ${u}`); failed++; }
  }
}
console.log(failed ? `${failed} problem(s) in ${pages.length} pages` : `OK — ${pages.length} pages parse and every local link resolves`);
process.exit(failed ? 1 : 0);
