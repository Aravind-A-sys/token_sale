import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const children = new Set();
let stopping = false;

function start(file, args, stdio = "inherit") {
  const child = spawn(process.execPath, [file, ...args], { cwd: root, stdio });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 3000);
  timer.unref();
}

process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());

function finished(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 || stopping ? resolve() : reject(new Error(`Process exited with code ${code}.`)),
    );
  });
}

async function main() {
  console.log("\nStarting an isolated Ethereum development chain. Test funds only.\n");
  const chain = start(
    "node_modules/hardhat/dist/src/cli.js",
    ["node", "--hostname", "0.0.0.0", "--port", "8545"],
    ["ignore", "pipe", "pipe"],
  );
  chain.stderr.pipe(process.stderr);
  chain.once("exit", (code) => {
    if (!stopping) stop(code || 1);
  });

  await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(new Error("Local chain did not become ready in 90 seconds.")),
      90_000,
    );
    chain.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    chain.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("Could not start the chain. Check whether port 8545 is already in use."));
    });
    // Suppress the public test-key listing and routine RPC noise, not errors.
    chain.stdout.on("data", (chunk) => {
      if (output === "ready") return;
      output += chunk.toString();
      if (output.includes("Started HTTP and WebSocket JSON-RPC server")) {
        output = "ready";
        clearTimeout(timer);
        resolve();
      }
    });
  });
  if (stopping) return;
  console.log("Local chain ready on port 8545. Deploying and funding the sale…");
  await finished(
    start("node_modules/hardhat/dist/src/cli.js", [
      "run",
      "scripts/deploy.ts",
      "--network",
      "localhost",
    ]),
  );
  if (stopping) return;
  await finished(start("node_modules/vite/bin/vite.js", ["--host", "0.0.0.0"]));
  stop();
}

main().catch((error) => {
  console.error(error.message);
  stop(1);
});
