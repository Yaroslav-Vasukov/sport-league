
import { config } from "dotenv";
config({ override: true });

import { Client } from "basic-ftp";
import path from "path";
import fs from "fs/promises";
import * as fss from "fs";
import os from "os";
import { createHash } from "crypto";

// --- Налаштування --------------------------------------------------------
const CHECK_HASH = process.env.CHECK_HASH !== "0"; // увімкнено за замовчуванням
const HASH_ALGO = process.env.HASH_ALGO || "sha1";
const REMOTE_MANIFEST_NAME =
  process.env.FTP_MANIFEST || ".deploy-manifest.json";

const CHECK_MTIME = process.env.CHECK_MTIME !== "0"; // додатковий контроль за часом
const MTIME_TOLERANCE_MS = Number(process.env.MTIME_TOLERANCE_MS ?? 60000);
const DRY_RUN = process.env.DRY_RUN === "1";
// якщо немає mtime і розмір однаковий — все одно вантажити?
const UPLOAD_WHEN_EQUAL_AND_NO_MTIME =
  process.env.UPLOAD_WHEN_EQUAL_AND_NO_MTIME === "1";

// --- Ігнори ---------------------------------------------------------------
const DEFAULT_IGNORES = new Set([".git", "node_modules", ".DS_Store"]);
const IGNORE_EXTS = new Set([".map", ".log"]);

function isIgnored(name) {
  if (DEFAULT_IGNORES.has(name)) return true;
  const dotHidden = name.startsWith(".") && name !== ".well-known";
  if (dotHidden) return true;
  const idx = name.lastIndexOf(".");
  if (idx !== -1) {
    const ext = name.slice(idx).toLowerCase();
    if (IGNORE_EXTS.has(ext)) return true;
  }
  return false;
}

// --- Допоміжні -----------------------------------------------------------
function ensureEnv() {
  const required = ["FTP_HOST", "FTP_USER", "FTP_PASSWORD"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("❌ Missing env:", missing.join(", "));
    process.exit(1);
  }
}

function toPosix(p) {
  return p.replace(/\\/g, "/");
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// MFMT утиліти (використаємо лише коли CHECK_MTIME=1)
function pad2(n) {
  return n.toString().padStart(2, "0");
}
function mfmtStamp(d) {
  // UTC YYYYMMDDhhmmss
  const y = d.getUTCFullYear();
  const M = pad2(d.getUTCMonth() + 1);
  const D = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const m = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  return `${y}${M}${D}${h}${m}${s}`;
}

async function setRemoteMtime(remotePath, date) {
  if (!CHECK_MTIME) return;
  try {
    await client.send(`MFMT ${mfmtStamp(date)} ${remotePath}`);
  } catch {
    // сервер може не підтримувати MFMT — ігноруємо
  }
}

// --- FTP клієнт ----------------------------------------------------------
const client = new Client();

function setupProgress() {
  client.trackProgress((info) => {
    if (info.type === "upload" && info.totalBytes > 0) {
      const pct = Math.max(
        0,
        Math.min(100, Math.round((info.transferred / info.totalBytes) * 100))
      );
      process.stdout.write(
        `\r⬆️  ${info.name} — ${pct}% (${info.transferred}/${info.totalBytes})   `
      );
      if (pct === 100) process.stdout.write("\n");
    }
  });
}

async function connect() {
  const port = Number(process.env.FTP_PORT) || 21;
  await client.access({
    host: process.env.FTP_HOST,
    port,
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    secure: process.env.FTP_SECURE === "1", // FTPS (explicit)
    secureOptions: {
      rejectUnauthorized: process.env.FTP_TLS_REJECT_UNAUTH !== "0",
    },
    timeout: 60_000,
  });
  console.log("✅ Connected to FTP");
}

function isClosed() {
  return (
    client.closed === true ||
    !client.ftp ||
    !client.ftp.socket ||
    client.ftp.socket.destroyed
  );
}

async function reconnectIfClosed() {
  if (isClosed()) {
    try {
      client.close();
    } catch {}
    await connect();
  }
}

async function withRetries(fn, attempts = 3, label = "") {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      await reconnectIfClosed();
      return await fn();
    } catch (e) {
      last = e;
      const msg = String(e?.message || e);
      const wait = 500 * (i + 1);
      console.warn(
        `⏳ Retry ${i + 1}/${attempts}${
          label ? ` [${label}]` : ""
        } in ${wait}ms…`,
        msg
      );
      if (msg.includes("Client is closed") || isClosed()) {
        try {
          client.close();
        } catch {}
        try {
          await connect();
        } catch {}
      }
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

// --- Хеші/маніфест -------------------------------------------------------
let manifest = {}; // { [relPosixPath]: { size:number, hash:string } }

async function computeHash(filePath) {
  return await new Promise((resolve, reject) => {
    const h = createHash(HASH_ALGO);
    const s = fss.createReadStream(filePath);
    s.on("error", reject);
    s.on("data", (chunk) => h.update(chunk));
    s.on("end", () => resolve(h.digest("hex")));
  });
}

async function loadRemoteManifest(remoteDir) {
  const remotePath = path.posix.join(remoteDir, REMOTE_MANIFEST_NAME);
  try {
    const sz = await client.size(remotePath);
    if (sz <= 0) return {};
  } catch {
    return {};
  }
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "deploy-"));
  const tmpFile = path.join(tmpDir, "manifest.json");
  await client.downloadTo(tmpFile, remotePath);
  const text = await fs.readFile(tmpFile, "utf8");
  await fs.rm(tmpDir, { recursive: true, force: true });
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

async function saveRemoteManifest(remoteDir, data) {
  if (DRY_RUN) return;
  const remotePath = path.posix.join(remoteDir, REMOTE_MANIFEST_NAME);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "deploy-"));
  const tmpFile = path.join(tmpDir, "manifest.json");
  await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), "utf8");
  await uploadFileAtomic(tmpFile, remotePath);
  await fs.rm(tmpDir, { recursive: true, force: true });
}

// --- Порівняння локального та віддаленого --------------------------------
async function shouldUpload(localPath, remotePath, relKey) {
  // симлінки не відправляємо
  const st = await fs.lstat(localPath);
  if (st.isSymbolicLink()) return false;

  const local = await fs.stat(localPath);
  const localSize = local.size;
  const localMtime = local.mtimeMs;

  // 1) Контроль за маніфестом/хешами
  if (CHECK_HASH) {
    const entry = manifest[relKey];
    if (entry) {
      if (entry.size !== localSize) return true; // змінився розмір — вантажимо
      const h = await computeHash(localPath); // розмір той самий — перевіримо контент
      return h !== entry.hash;
    } else {
      // файлу ще немає в маніфесті — вантажимо
      return true;
    }
  }

  // 2) Fallback: size + (optional) mtime через FTP
  try {
    let rSize = -1;
    try {
      rSize = await client.size(remotePath);
    } catch {}

    let rMdtm = null;
    if (CHECK_MTIME) {
      try {
        rMdtm = await client.lastMod(remotePath); // MDTM
      } catch {}
    }

    if (rSize === -1 && !rMdtm) {
      // 3) fallback: directory listing
      const dir = path.posix.dirname(remotePath);
      const base = path.posix.basename(remotePath);
      const list = await client.list(dir);
      const rf = list.find((f) => f.name === base);
      if (!rf) return true; // немає на сервері
      if (Number.isFinite(rf.size) && rf.size !== localSize) return true;

      if (CHECK_MTIME && rf.modifiedAt instanceof Date) {
        const diff = Math.abs(localMtime - rf.modifiedAt.getTime());
        if (diff > MTIME_TOLERANCE_MS) return true;
        return false;
      }
      return UPLOAD_WHEN_EQUAL_AND_NO_MTIME ? true : false;
    }

    if (rSize > 0) {
      if (rSize !== localSize) return true;
      if (!CHECK_MTIME) return false;
    }

    if (CHECK_MTIME && rMdtm instanceof Date) {
      const diff = Math.abs(localMtime - rMdtm.getTime());
      if (diff > MTIME_TOLERANCE_MS) return true;
    }

    return false;
  } catch {
    return true; // у разі сумнівів — перезаливаємо
  }
}

// --- Атомарний аплоад ----------------------------------------------------
async function uploadFileAtomic(localPath, remotePath) {
  const tmp = `${remotePath}.uploading-${Date.now()}`;

  if (DRY_RUN) {
    console.log(`🧪 DRY_RUN: upload ${toPosix(localPath)} -> ${remotePath}`);
    return;
  }

  await client.ensureDir(path.posix.dirname(remotePath)); // переконаємось, що каталог існує
  await client.uploadFrom(localPath, tmp); // завантажуємо у тимчасову назву

  // Переіменування: якщо сервер не дозволяє overwrite — приберемо старий і повторимо
  try {
    await client.rename(tmp, remotePath);
  } catch {
    try {
      await client.remove(remotePath);
    } catch {}
    await client.rename(tmp, remotePath);
  }

  // Проставимо mtime на сервері, якщо просили суворий режим і є MFMT
  try {
    const local = await fs.stat(localPath);
    await setRemoteMtime(remotePath, local.mtime);
  } catch {}
}

// --- Рекурсивний аплоад каталогу -----------------------------------------
async function uploadFolder(localDir, remoteDir, baseLocalDir) {
  const entries = await fs.readdir(localDir, { withFileTypes: true });

  for (const entry of entries) {
    const name = entry.name;
    if (isIgnored(name)) continue;

    const localPath = path.join(localDir, name);
    const remotePath = path.posix.join(remoteDir, name);
    const relKey = toPosix(path.relative(baseLocalDir, localPath));

    if (entry.isDirectory()) {
      if (!DRY_RUN) await client.ensureDir(remotePath);
      console.log(`📁 Enter ${toPosix(localPath)} -> ${remotePath}`);
      await uploadFolder(localPath, remotePath, baseLocalDir);
    } else {
      const needUpload = await shouldUpload(localPath, remotePath, relKey);
      if (needUpload) {
        console.log(`📤 Uploading ${name}`);
        await withRetries(
          () => uploadFileAtomic(localPath, remotePath),
          3,
          name
        );

        // після успішного аплоада — оновлюємо маніфест
        if (CHECK_HASH) {
          const sz = (await fs.stat(localPath)).size;
          const h = await computeHash(localPath);
          manifest[relKey] = { size: sz, hash: h };
        }
      } else {
        console.log(`✅ Skipping ${name}`);
        // якщо запису ще не було — додамо (щоб маніфест був повним)
        if (CHECK_HASH && !manifest[relKey]) {
          const sz = (await fs.stat(localPath)).size;
          const h = await computeHash(localPath);
          manifest[relKey] = { size: sz, hash: h };
        }
      }
    }
  }
}

// --- Точка входу ----------------------------------------------------------
async function deploy() {
  ensureEnv();

  const localDir = path.resolve(process.env.LOCAL_DIR || "src");
  const remoteDirRaw = process.env.FTP_REMOTE_PATH || "/src";
  const remoteDir = remoteDirRaw.endsWith("/")
    ? remoteDirRaw.slice(0, -1)
    : remoteDirRaw;

  if (!(await pathExists(localDir))) {
    console.error(`❌ Local dir not found: ${localDir}`);
    process.exit(1);
  }

  try {
    setupProgress();
    await connect();

    if (!DRY_RUN) await client.ensureDir(remoteDir);
    console.log(`🚀 Deploy ${toPosix(localDir)} -> ${remoteDir}`);

    // підвантажимо маніфест із сервера (якщо є)
    manifest = CHECK_HASH ? await loadRemoteManifest(remoteDir) : {};

    await uploadFolder(localDir, remoteDir, localDir);

    // збережемо оновлений маніфест
    if (CHECK_HASH) await saveRemoteManifest(remoteDir, manifest);

    console.log("🎉 Deployment completed");
  } catch (err) {
    console.error("❌ Deployment failed:", err?.message || err);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

deploy();
