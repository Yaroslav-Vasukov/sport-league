import { defineConfig } from "vite";
import path from "path";
import fs from "fs";
import * as sass from "sass";
import { fileURLToPath, pathToFileURL } from "url";
import sharp from "sharp";
import postcss from "postcss";
import pxtorem from "postcss-pxtorem";
import { PurgeCSS } from "purgecss";
import glob from "glob-all";
import Twig from "twig";
import twigPlugin from "@fulcrumsaas/vite-plugin-twig"; // Twig на Vite 5

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- purge css ------------------------------------------------
const USE_PURGED = process.env.USE_PURGED === "1";
const oldCss = path.resolve(__dirname, "dev/assets/styles/old-styles.css");

// ---- shared constants/helpers ------------------------------------------------
const IMG_DIR_DEV = path.resolve(__dirname, "dev/assets/images");
const IMG_URL_RE =
  /\/assets\/images\/[^"')\s]+\.(jpg|jpeg|png|bmp)(?=(?:[?#][^"')\s]*)?)/gi;
const SRC_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".bmp"];

const REM_ROOT = Number(process.env.REM_ROOT || 16); // 1rem = REM_ROOT px

const norm = (p) => p.replace(/\\/g, "/");
const hasAnyExt = (name, exts) =>
  exts.some((e) => name.toLowerCase().endsWith(e));

// Smart webp options: lossless for png with alpha, else quality 82
async function webpConvert(inPath, outPath) {
  const meta = await sharp(inPath).metadata();
  const isPng = /\.png$/i.test(inPath);
  const hasAlpha = !!meta.hasAlpha;
  const pipeline = sharp(inPath);
  if (isPng && hasAlpha) {
    await pipeline.webp({ lossless: true }).toFile(outPath);
  } else {
    await pipeline.webp({ quality: 82 }).toFile(outPath);
  }
}

function twigDevPlugin() {
  return {
    name: "twig-dev-transform",
    apply: "serve",
    order: "pre",              // ← вместо enforce: "pre"
    configResolved() {
      Twig.cache(false);
    },
    transformIndexHtml: {
      order: "pre",            // ← вместо enforce: "pre"
      async handler(_html, ctx) { // ← вместо transform()
        return await new Promise((resolve, reject) => {
          Twig.renderFile(ctx.filename, {}, (err, out) => {
            if (err) reject(err);
            else resolve(out);
          });
        });
      },
    },
    configureServer(server) {
      server.watcher.on("change", (file) => {
        if (/\.(twig|html)$/.test(file)) {
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}
function twigBuildPlugin() {
  return {
    name: "twig-build-transform",
    apply: "build",
    order: "pre",
    configResolved() {
      Twig.cache(false);
    },
    transformIndexHtml: {
      order: "pre",
      async handler(_html, ctx) {
        return await new Promise((resolve, reject) => {
          Twig.renderFile(ctx.filename, {}, (err, out) => {
            if (err) reject(err);
            else resolve(out);
          });
        });
      },
    },
  };
}


// tiny concurrency limiter
function createLimiter(limit = 4) {
  let active = 0;
  const q = [];
  const run = async (fn) => {
    if (active >= limit) await new Promise((r) => q.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      const n = q.shift();
      if (n) n();
    }
  };
  return (fn) => run(fn);
}

// -----------------------------------------------------------------------------
// SCSS compile (prepend + importer + px→rem via PostCSS)
const entryScss = path.resolve(__dirname, "dev/assets/styles/main.scss");
const devCss = path.resolve(__dirname, "dev/assets/styles/main.css");

async function compileScss(outFile) {
  const aliasMap = {
    "@": path.resolve(__dirname, "dev"),
    "@components": path.resolve(__dirname, "dev/components"),
  };

  function tryCandidates(baseDir, rel) {
    const noExt = rel.replace(/\.scss$/i, "");
    const baseName = path.basename(noExt);
    const dirName = path.dirname(noExt);
    const candidates = [
      noExt + ".scss",
      path.join(noExt, "index.scss"),
      path.join(dirName, "_" + baseName + ".scss"),
    ];
    for (const c of candidates) {
      const full = path.resolve(baseDir, c);
      if (fs.existsSync(full)) return full;
    }
    return null;
  }

  const scssImporter = {
    canonicalize(url, options) {
      if (url.startsWith("~")) url = url.slice(1);

      if (options?.containingUrl?.protocol === "file:") {
        const baseDir = path.dirname(fileURLToPath(options.containingUrl));
        const relHit = tryCandidates(baseDir, url);
        if (relHit) return pathToFileURL(relHit);
      }

      for (const [alias, base] of Object.entries(aliasMap)) {
        if (url === alias || url.startsWith(alias + "/")) {
          const rel = url === alias ? "" : url.slice(alias.length + 1);
          const found = tryCandidates(base, rel);
          if (found) return pathToFileURL(found);
        }
      }

      const fromA = tryCandidates(
        path.resolve(__dirname, "dev/assets/styles"),
        url
      );
      if (fromA) return pathToFileURL(fromA);
      const fromB = tryCandidates(path.resolve(__dirname, "dev"), url);
      if (fromB) return pathToFileURL(fromB);

      return null;
    },

    load(u) {
      if (u.protocol !== "file:") return null;
      const p = fileURLToPath(u);
      const src = fs.readFileSync(p, "utf8");

      const isUtils =
        /[\\\/]dev[\\\/]assets[\\\/]styles[\\\/]utils[\\\/]/i.test(p);
      const hasNoUtilsPragma = /@no-utils\b/.test(src);
      if (isUtils || hasNoUtilsPragma) {
        return { contents: src, syntax: "scss" };
      }

      const alreadyUsesIndex = /@use\s+["'](?:\.{1,2}\/)*utils\/index["']/.test(
        src
      );
      const prelude = alreadyUsesIndex ? "" : '@use "utils/index" as *;\n';
      return { contents: prelude + src, syntax: "scss" };
    },
  };

  const entry = fs.readFileSync(entryScss, "utf8");
  const src = '@use "utils/index" as *;\n' + entry;

  const res = sass.compileString(src, {
    style: "compressed",
    loadPaths: [
      path.resolve(__dirname, "dev/assets/styles"),
      path.resolve(__dirname, "dev"),
    ],
    importers: [scssImporter],
  });

  const processed = await postcss([
    pxtorem({
      rootValue: Number(process.env.REM_ROOT || 16),
      propList: ["*"],
      unitPrecision: 5,
      replace: true,
      minPixelValue: 1,
      exclude: (file) => !!file && /node_modules/i.test(file),
    }),
  ]).process(res.css, {
    from: entryScss,
    to: outFile,
    map: false,
  });

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, processed.css);
  console.log("✅ SCSS →", outFile);
}

function debounce(fn, ms = 120) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}


// -----------------------------------------------------------------------------
// Vite config
export default defineConfig({
  appType: "mpa",
  root: path.resolve(__dirname, "dev"),
  base: "/",
  optimizeDeps: {
    entries: [path.resolve(__dirname, "dev/assets/scripts/main.js")],
  },

  plugins: [
    
    twigDevPlugin(), 
    twigBuildPlugin(),
    twigPlugin({
  root: path.resolve(__dirname, "dev"),
  namespaces: {
    layouts:    path.resolve(__dirname, "dev/layouts"),
    components: path.resolve(__dirname, "dev/components"),
    pages:      path.resolve(__dirname, "dev/pages"),
  },
}),

    // routes (pretty URLs → .html)
    {
      name: "pretty-routes",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (!req.url) return next();
          if (req.url === "/" || req.url === "/index")
            req.url = "/pages/home.html";
          const m = req.url.match(
            /^\/(news|post|videos|calendar|history|review|video|teams|team|player|contact|lives)\/?$/i
          );
          if (m) req.url = `/pages/${m[1]}.html`;
          next();
        });
      },
    },

    // одноразовая очистка старого CSS (Purge по .html/.twig)
    {
      name: "purge-once",
      apply: () => USE_PURGED,
      async configResolved() {
        const CSS_IN = oldCss;
        if (!fs.existsSync(CSS_IN)) {
          console.warn("⚠️ purge-once: CSS not found:", CSS_IN);
          return;
        }

        const backup = CSS_IN.replace(/\.css$/i, `.${Date.now()}.bak.css`);
        fs.copyFileSync(CSS_IN, backup);
        console.log("📦 purge-once: backup saved:", backup);

        const content = glob.sync([
          path.resolve(__dirname, "dev/pages/**/*.{html,twig}"),
          path.resolve(__dirname, "dev/components/**/*.{html,twig}"),
          path.resolve(__dirname, "dev/**/*.{js,ts}"),
        ]);

        const safelist = {
          standard: [
            "html",
            "body",
            "active",
            "open",
            "hidden",
            "show",
            "is-active",
            "is-open",
            "is-hidden",
            "is-sticky",
          ],
          deep: [/^swiper-/, /^lg-/, /^toast/, /^modal/],
          greedy: [/^is-/, /^has-/],
        };

        const raw = fs.readFileSync(CSS_IN, "utf8");
        const res = await new PurgeCSS().purge({
          content,
          css: [{ raw }],
          safelist,
          keyframes: true,
          fontFace: true,
          rejected: true,
        });

        const out = res[0]?.css ?? "";
        fs.writeFileSync(CSS_IN, out);
        console.log("✅ purge-once: CSS cleaned:", CSS_IN);

        const rejected = res[0]?.rejected || [];
        if (rejected.length) {
          console.log("🧹 purge-once: rejected selectors:", rejected.length);
          console.log(rejected.slice(0, 50).join("\n"));
        }
      },
    },

    // SCSS live compile (dev)
    {
      name: "scss-dev",
      apply: "serve",
      configureServer(server) {
        if (USE_PURGED) return;
        const reload = debounce(() => server.ws.send({ type: "full-reload" }));
        compileScss(devCss).then(reload);
        server.watcher.on("change", (file) => {
          if (file.endsWith(".scss")) {
            compileScss(devCss).then(reload);
          }
        });
      },
    },

    // SCSS build step
    {
      name: "scss-build",
      apply: "build",
      async buildStart() {
        if (USE_PURGED) return;
        await compileScss(devCss);
      },
    },

    // dev: convert images to webp
    {
      name: "webp-dev-only",
      apply: "serve",
      configureServer(server) {
        const ROOT = norm(IMG_DIR_DEV).toLowerCase();
        if (!fs.existsSync(IMG_DIR_DEV))
          fs.mkdirSync(IMG_DIR_DEV, { recursive: true });
        const limit = createLimiter(4);

        const inImages = (p) => p && norm(p).toLowerCase().startsWith(ROOT);
        const isConvertible = (p) =>
          inImages(p) && hasAnyExt(p, SRC_IMAGE_EXTS);

        async function toWebp(srcPath) {
          try {
            const { dir, name } = path.parse(srcPath);
            const out = path.resolve(dir, `${name}.webp`);
            if (fs.existsSync(out)) {
              const srcStat = fs.statSync(srcPath);
              const outStat = fs.statSync(out);
              if (outStat.mtimeMs >= srcStat.mtimeMs) return;
            }
            await limit(() => webpConvert(srcPath, out));
            console.log(
              "🟢 WEBP(dev):",
              norm(srcPath).replace(norm(__dirname) + "/", ""),
              "→",
              norm(out).replace(norm(__dirname) + "/", "")
            );
          } catch (e) {
            console.warn("🔴 WEBP(dev) error:", srcPath, e.message);
          }
        }

        (function walk(dir) {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.resolve(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (isConvertible(full)) toWebp(full);
          }
        })(IMG_DIR_DEV);

        server.watcher.on("add", (p) => {
          if (isConvertible(p)) toWebp(p);
        });
        server.watcher.on("change", (p) => {
          if (isConvertible(p)) toWebp(p);
        });

        server.middlewares.use((req, _res, next) => {
          if (!req.url) return next();
          const m = req.url.match(
            /^\/assets\/images\/(.+)\.(jpg|jpeg|png|bmp)$/i
          );
          if (!m) return next();
          const webpPath = path.resolve(IMG_DIR_DEV, m[1] + ".webp");
          if (fs.existsSync(webpPath)) req.url = `/assets/images/${m[1]}.webp`;
          next();
        });
      },
    },

    // build: ensure webp exists
    {
      name: "ensure-webp-on-build",
      apply: "build",
      async buildStart() {
        if (!fs.existsSync(IMG_DIR_DEV)) return;
        const tasks = [];
        (function walk(dir) {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.resolve(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (hasAnyExt(entry.name, SRC_IMAGE_EXTS)) {
              const base = entry.name.replace(/\.(jpg|jpeg|png|bmp)$/i, "");
              const out = path.resolve(dir, `${base}.webp`);
              let need = true;
              if (fs.existsSync(out)) {
                const srcStat = fs.statSync(full);
                const outStat = fs.statSync(out);
                if (outStat.mtimeMs >= srcStat.mtimeMs) need = false;
              }
              if (need) {
                tasks.push(
                  webpConvert(full, out)
                    .then(() =>
                      console.log(
                        "🟢 build:webp:",
                        norm(full).replace(norm(__dirname) + "/", ""),
                        "→",
                        norm(out).replace(norm(__dirname) + "/", "")
                      )
                    )
                    .catch((e) =>
                      console.warn("🔴 build:webp error:", full, e.message)
                    )
                );
              }
            }
          }
        })(IMG_DIR_DEV);
        if (tasks.length) await Promise.all(tasks);
      },
    },

    // build: rewrite refs to webp & prune originals
    {
      name: "rewrite-to-webp-and-prune",
      apply: "build",
      generateBundle(_options, bundle) {
        const webps = new Set(
          Object.values(bundle)
            .filter(
              (i) =>
                i.type === "asset" &&
                typeof i.fileName === "string" &&
                i.fileName.toLowerCase().endsWith(".webp")
            )
            .map((i) => norm(i.fileName).toLowerCase())
        );

        const toWebpIfExists = (pathStr) => {
          const m = pathStr.match(
            /^(.*\/assets\/images\/)([^\/]+)\.(jpg|jpeg|png|bmp)(?=(?:[?#][^"')\s]*)?)/i
          );
          if (!m) return null;
          const candidate = (m[1] + m[2] + ".webp").toLowerCase();
          return webps.has(candidate) ? m[1] + m[2] + ".webp" : null;
        };

        for (const item of Object.values(bundle)) {
          if (item.type !== "asset") continue;
          const f = (item.fileName || "").toLowerCase();
          if (!f.endsWith(".html") && !f.endsWith(".css")) continue;
          const original = item.source.toString();
          const replaced = original.replace(
            IMG_URL_RE,
            (match) => toWebpIfExists(match) || match
          );
          if (replaced !== original) {
            item.source = replaced;
            console.log("✏️  rewrite refs:", item.fileName);
          }
        }

        const exts = SRC_IMAGE_EXTS;
        for (const [key, item] of Object.entries(bundle)) {
          if (item.type !== "asset") continue;
          const f = norm(item.fileName);
          const lower = f.toLowerCase();
          const ext = exts.find((e) => lower.endsWith(e));
          if (!ext) continue;
          const base = f.slice(0, -ext.length) + ".webp";
          if (webps.has(base.toLowerCase())) {
            delete bundle[key];
            console.log("🗑  prune:", f, "→ kept:", base);
          }
        }
      },
    },
  ],

  build: {
    assetsInlineLimit: 0,
    outDir: path.resolve(__dirname, "src"),
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "dev/pages/home.html"),
        news: path.resolve(__dirname, "dev/pages/news.html"),
        lives: path.resolve(__dirname, "dev/pages/lives.html"),
        history: path.resolve(__dirname, "dev/pages/history.html"),
        calendar: path.resolve(__dirname, "dev/pages/calendar.html"),
        post: path.resolve(__dirname, "dev/pages/post.html"),
        videos: path.resolve(__dirname, "dev/pages/videos.html"),
        review: path.resolve(__dirname, "dev/pages/review.html"),
        video: path.resolve(__dirname, "dev/pages/video.html"),
        teams: path.resolve(__dirname, "dev/pages/teams.html"),
        team: path.resolve(__dirname, "dev/pages/team.html"),
        player: path.resolve(__dirname, "dev/pages/player.html"),
        contact: path.resolve(__dirname, "dev/pages/contact.html"),
      },
      preserveEntrySignatures: false,
      output: {
        entryFileNames: "assets/scripts/[name].js",
        chunkFileNames: "assets/scripts/[name].js",
        assetFileNames: (info) => {
          const ext = info.name.split(".").pop().toLowerCase();
          if (ext === "css") return "assets/styles/main[extname]";
          if (["png", "jpg", "jpeg", "bmp", "webp", "gif", "svg"].includes(ext))
            return "assets/images/[name][extname]";
          if (["woff", "woff2", "ttf", "otf", "eot"].includes(ext))
            return "assets/fonts/[name][extname]";
          if (["mp4", "webm", "ogg", "mp3", "wav"].includes(ext))
            return "assets/media/[name][extname]";
          if (["ico", "xml", "txt", "json", "map"].includes(ext))
            return "assets/[name][extname]";
          return "assets/other/[name][extname]";
        },
      },
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "dev"),
      "@components": path.resolve(__dirname, "dev/components"),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        includePaths: [
          path.resolve(__dirname, "dev/components"),
          path.resolve(__dirname, "dev/assets/styles"),
        ],
      },
    },
  },

  server: {
    host: true,
    port: 5500,
    https: false,
    strictPort: true,
    open: "/pages/home.html", // теперь открываем .html
    fs: { allow: [path.resolve(__dirname, "dev")] },
  },
  hmr: { clientPort: 5500 },
});
