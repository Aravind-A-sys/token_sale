import { mkdir, rename, writeFile } from "node:fs/promises";
import { artifacts, network } from "hardhat";

const connection = await network.create();
const { ethers } = connection;
const { chainId } = await ethers.provider.getNetwork();
if (connection.networkName !== "localhost" || chainId !== 31337n) {
  throw new Error("Safety check: this script deploys only to the local Hardhat network (31337).");
}
const metadata = await ethers.provider.send("hardhat_metadata", []);
if (typeof metadata.instanceId !== "string") throw new Error("Expected an isolated Hardhat node.");

const [owner] = await ethers.getSigners();
const token = await ethers.deployContract("DappToken", [owner.address]);
await token.waitForDeployment();
const sale = await ethers.deployContract("DappTokenSale", [
  await token.getAddress(),
  ethers.parseEther("0.001"),
  750_000n,
  owner.address,
]);
await sale.waitForDeployment();
await (await token.transfer(await sale.getAddress(), ethers.parseUnits("750000", 18))).wait();
const receipt = await sale.deploymentTransaction()!.wait();

const deployment = {
  version: 1,
  chainId: Number(chainId),
  networkName: "Hardhat Local",
  instanceId: metadata.instanceId,
  deploymentBlock: receipt!.blockNumber,
  tokenAddress: await token.getAddress(),
  saleAddress: await sale.getAddress(),
  tokenAbi: (await artifacts.readArtifact("DappToken")).abi,
  saleAbi: (await artifacts.readArtifact("DappTokenSale")).abi,
};

await mkdir("frontend/public", { recursive: true });
await writeFile("frontend/public/deployment.json.tmp", JSON.stringify(deployment, null, 2) + "\n");
await rename("frontend/public/deployment.json.tmp", "frontend/public/deployment.json");
console.log(
  `\nLocal deployment ready. No real funds are involved.\nToken: ${deployment.tokenAddress}\nSale:  ${deployment.saleAddress}\n750,000 DAPP funded at 0.001 test ETH each.\n`,
);
await connection.close();
