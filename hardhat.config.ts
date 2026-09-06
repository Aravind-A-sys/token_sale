import { defineConfig } from "hardhat/config";
import { createRequire } from "node:module";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatTypechain from "@nomicfoundation/hardhat-typechain";

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [
    hardhatEthers,
    hardhatEthersChaiMatchers,
    hardhatMocha,
    hardhatNetworkHelpers,
    hardhatTypechain,
  ],
  solidity: {
    version: "0.8.30",
    // Use the lockfile-pinned local compiler, not a separate binary download.
    path: require.resolve("solc/soljson.js"),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhatMainnet: { type: "edr-simulated", chainType: "l1", chainId: 31337 },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
});
