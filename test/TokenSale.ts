import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();
const PRICE = ethers.parseEther("0.001");
const ALLOCATION = 750_000n;
const UNIT = 10n ** 18n;

async function fixture() {
  const [owner, buyer, other] = await ethers.getSigners();
  const token = await ethers.deployContract("DappToken", [owner.address]);
  const sale = await ethers.deployContract("DappTokenSale", [
    await token.getAddress(),
    PRICE,
    ALLOCATION,
    owner.address,
  ]);
  await token.transfer(await sale.getAddress(), ALLOCATION * UNIT);
  return { token, sale, owner, buyer, other };
}

describe("DappToken", function () {
  it("has standard ERC-20 metadata, 18 decimals, and a fixed million-token supply", async function () {
    const { token, owner, sale } = await networkHelpers.loadFixture(fixture);
    expect(await token.name()).to.equal("DApp Token");
    expect(await token.symbol()).to.equal("DAPP");
    expect(await token.decimals()).to.equal(18);
    expect(await token.totalSupply()).to.equal(1_000_000n * UNIT);
    expect(await token.balanceOf(owner.address)).to.equal(250_000n * UNIT);
    expect(await token.balanceOf(await sale.getAddress())).to.equal(ALLOCATION * UNIT);
  });

  it("supports transfers and emits standard events", async function () {
    const { token, owner, buyer } = await networkHelpers.loadFixture(fixture);
    await expect(token.transfer(buyer.address, 10n * UNIT))
      .to.emit(token, "Transfer")
      .withArgs(owner.address, buyer.address, 10n * UNIT);
    expect(await token.balanceOf(buyer.address)).to.equal(10n * UNIT);
  });

  it("supports approvals and delegated transfers with correct allowance accounting", async function () {
    const { token, owner, buyer, other } = await networkHelpers.loadFixture(fixture);
    await expect(token.approve(other.address, 10n * UNIT))
      .to.emit(token, "Approval")
      .withArgs(owner.address, other.address, 10n * UNIT);
    await token.connect(other).transferFrom(owner.address, buyer.address, 4n * UNIT);
    expect(await token.allowance(owner.address, other.address)).to.equal(6n * UNIT);
    expect(await token.balanceOf(buyer.address)).to.equal(4n * UNIT);
  });

  it("rejects spending more than a balance or an allowance", async function () {
    const { token, owner, buyer } = await networkHelpers.loadFixture(fixture);
    await expect(token.connect(buyer).transfer(owner.address, UNIT)).to.be.revertedWithCustomError(
      token,
      "ERC20InsufficientBalance",
    );
    await expect(
      token.connect(buyer).transferFrom(owner.address, buyer.address, UNIT),
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
  });

  it("rejects minting or transferring to the zero address", async function () {
    const { token } = await networkHelpers.loadFixture(fixture);
    await expect(
      ethers.deployContract("DappToken", [ethers.ZeroAddress]),
    ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
    await expect(token.transfer(ethers.ZeroAddress, UNIT)).to.be.revertedWithCustomError(
      token,
      "ERC20InvalidReceiver",
    );
  });
});

describe("DappTokenSale", function () {
  it("sets the token, owner, immutable price, and whole-token allocation", async function () {
    const { token, sale, owner } = await networkHelpers.loadFixture(fixture);
    expect(await sale.tokenContract()).to.equal(await token.getAddress());
    expect(await sale.owner()).to.equal(owner.address);
    expect(await sale.tokenPrice()).to.equal(PRICE);
    expect(await sale.saleAllocation()).to.equal(ALLOCATION);
    expect(await sale.tokensSold()).to.equal(0n);
    expect(await sale.saleEnded()).to.equal(false);
  });

  it("rejects invalid token addresses, zero price, and invalid allocations", async function () {
    const { token, sale, owner, buyer } = await networkHelpers.loadFixture(fixture);
    for (const address of [ethers.ZeroAddress, buyer.address]) {
      await expect(
        ethers.deployContract("DappTokenSale", [address, PRICE, ALLOCATION, owner.address]),
      ).to.be.revertedWithCustomError(sale, "InvalidToken");
    }
    await expect(
      ethers.deployContract("DappTokenSale", [
        await token.getAddress(),
        0n,
        ALLOCATION,
        owner.address,
      ]),
    ).to.be.revertedWithCustomError(sale, "InvalidPrice");
    for (const allocation of [0n, 1_000_001n]) {
      await expect(
        ethers.deployContract("DappTokenSale", [
          await token.getAddress(),
          PRICE,
          allocation,
          owner.address,
        ]),
      ).to.be.revertedWithCustomError(sale, "InvalidAllocation");
    }
    await expect(
      ethers.deployContract("DappTokenSale", [
        await token.getAddress(),
        PRICE,
        ALLOCATION,
        ethers.ZeroAddress,
      ]),
    ).to.be.revertedWithCustomError(sale, "OwnableInvalidOwner");
  });

  it("rejects a token with incompatible decimals", async function () {
    const { sale, owner } = await networkHelpers.loadFixture(fixture);
    const token = await ethers.deployContract("SixDecimalToken");
    await expect(
      ethers.deployContract("DappTokenSale", [
        await token.getAddress(),
        PRICE,
        ALLOCATION,
        owner.address,
      ]),
    ).to.be.revertedWithCustomError(sale, "InvalidToken");
  });

  it("exchanges exact ETH for whole DAPP, records totals, and emits a purchase event", async function () {
    const { token, sale, buyer } = await networkHelpers.loadFixture(fixture);
    await expect(sale.connect(buyer).buyTokens(10n, { value: PRICE * 10n }))
      .to.emit(sale, "TokensPurchased")
      .withArgs(buyer.address, 10n, PRICE * 10n);
    expect(await token.balanceOf(buyer.address)).to.equal(10n * UNIT);
    expect(await token.balanceOf(await sale.getAddress())).to.equal((ALLOCATION - 10n) * UNIT);
    expect(await sale.tokensSold()).to.equal(10n);
    expect(await sale.totalRaised()).to.equal(PRICE * 10n);
    expect(await ethers.provider.getBalance(await sale.getAddress())).to.equal(PRICE * 10n);
  });

  it("accumulates multiple independent purchases", async function () {
    const { sale, buyer, other } = await networkHelpers.loadFixture(fixture);
    await sale.connect(buyer).buyTokens(10n, { value: PRICE * 10n });
    await sale.connect(other).buyTokens(20n, { value: PRICE * 20n });
    expect(await sale.tokensSold()).to.equal(30n);
    expect(await sale.totalRaised()).to.equal(PRICE * 30n);
  });

  it("rejects zero-token purchases", async function () {
    const { sale, buyer } = await networkHelpers.loadFixture(fixture);
    await expect(sale.connect(buyer).buyTokens(0n)).to.be.revertedWithCustomError(
      sale,
      "InvalidAmount",
    );
  });

  it("rejects underpayment and overpayment without changing state", async function () {
    const { token, sale, buyer } = await networkHelpers.loadFixture(fixture);
    for (const value of [PRICE - 1n, PRICE + 1n]) {
      await expect(sale.connect(buyer).buyTokens(1n, { value }))
        .to.be.revertedWithCustomError(sale, "IncorrectPayment")
        .withArgs(PRICE, value);
    }
    expect(await sale.tokensSold()).to.equal(0n);
    expect(await token.balanceOf(buyer.address)).to.equal(0n);
    expect(await ethers.provider.getBalance(await sale.getAddress())).to.equal(0n);
  });

  it("rejects purchases from an unfunded sale", async function () {
    const { token, owner, buyer } = await networkHelpers.loadFixture(fixture);
    const emptySale = await ethers.deployContract("DappTokenSale", [
      await token.getAddress(),
      PRICE,
      ALLOCATION,
      owner.address,
    ]);
    await expect(emptySale.connect(buyer).buyTokens(1n, { value: PRICE }))
      .to.be.revertedWithCustomError(emptySale, "InsufficientInventory")
      .withArgs(0n, 1n);
    expect(await emptySale.tokensSold()).to.equal(0n);
  });

  it("enforces the allocation even when extra inventory is transferred in", async function () {
    const { token, sale, buyer } = await networkHelpers.loadFixture(fixture);
    await token.transfer(await sale.getAddress(), UNIT);
    await expect(
      sale.connect(buyer).buyTokens(ALLOCATION + 1n, { value: PRICE * (ALLOCATION + 1n) }),
    )
      .to.be.revertedWithCustomError(sale, "AllocationExceeded")
      .withArgs(ALLOCATION, ALLOCATION + 1n);
  });

  it("allows an exact sell-out and rejects subsequent purchases", async function () {
    const { token, sale, buyer } = await networkHelpers.loadFixture(fixture);
    await sale.connect(buyer).buyTokens(ALLOCATION, { value: PRICE * ALLOCATION });
    expect(await token.balanceOf(await sale.getAddress())).to.equal(0n);
    await expect(sale.connect(buyer).buyTokens(1n, { value: PRICE }))
      .to.be.revertedWithCustomError(sale, "AllocationExceeded")
      .withArgs(0n, 1n);
  });

  it("rejects plain ETH transfers instead of accepting unaccounted purchases", async function () {
    const { sale, buyer } = await networkHelpers.loadFixture(fixture);
    await expect(buyer.sendTransaction({ to: await sale.getAddress(), value: PRICE })).to.revert(
      ethers,
    );
  });

  it("restricts all sale administration to the owner", async function () {
    const { sale, buyer } = await networkHelpers.loadFixture(fixture);
    for (const action of [
      () => sale.connect(buyer).pause(),
      () => sale.connect(buyer).unpause(),
      () => sale.connect(buyer).endSale(),
      () => sale.connect(buyer).withdrawProceeds(buyer.address),
      () => sale.connect(buyer).transferOwnership(buyer.address),
    ]) {
      await expect(action())
        .to.be.revertedWithCustomError(sale, "OwnableUnauthorizedAccount")
        .withArgs(buyer.address);
    }
  });

  it("can pause and resume purchases", async function () {
    const { sale, owner, buyer } = await networkHelpers.loadFixture(fixture);
    await expect(sale.pause()).to.emit(sale, "Paused").withArgs(owner.address);
    await expect(sale.connect(buyer).buyTokens(1n, { value: PRICE })).to.be.revertedWithCustomError(
      sale,
      "EnforcedPause",
    );
    await sale.unpause();
    await sale.connect(buyer).buyTokens(1n, { value: PRICE });
    expect(await sale.tokensSold()).to.equal(1n);
  });

  it("withdraws proceeds without erasing cumulative fundraising totals", async function () {
    const { sale, buyer, other } = await networkHelpers.loadFixture(fixture);
    await sale.connect(buyer).buyTokens(10n, { value: PRICE * 10n });
    const before = await ethers.provider.getBalance(other.address);
    await expect(sale.withdrawProceeds(other.address))
      .to.emit(sale, "ProceedsWithdrawn")
      .withArgs(other.address, PRICE * 10n);
    expect(await ethers.provider.getBalance(other.address)).to.equal(before + PRICE * 10n);
    expect(await ethers.provider.getBalance(await sale.getAddress())).to.equal(0n);
    expect(await sale.totalRaised()).to.equal(PRICE * 10n);
  });

  it("rejects empty withdrawals and zero recipients", async function () {
    const { sale, owner } = await networkHelpers.loadFixture(fixture);
    await expect(sale.withdrawProceeds(owner.address)).to.be.revertedWithCustomError(
      sale,
      "NothingToWithdraw",
    );
    await expect(sale.withdrawProceeds(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      sale,
      "InvalidRecipient",
    );
  });

  it("does not lose funds when the recipient rejects ETH", async function () {
    const { sale, buyer } = await networkHelpers.loadFixture(fixture);
    const rejector = await ethers.deployContract("RejectEther");
    await sale.connect(buyer).buyTokens(1n, { value: PRICE });
    await expect(sale.withdrawProceeds(await rejector.getAddress())).to.be.revertedWithCustomError(
      sale,
      "EtherTransferFailed",
    );
    expect(await ethers.provider.getBalance(await sale.getAddress())).to.equal(PRICE);
  });

  it("blocks reentrant withdrawals even when the owner is a contract", async function () {
    const { sale, buyer } = await networkHelpers.loadFixture(fixture);
    const probe = await ethers.deployContract("WithdrawalProbe", [await sale.getAddress()]);
    await sale.transferOwnership(await probe.getAddress());
    await probe.acceptOwnership();
    await sale.connect(buyer).buyTokens(1n, { value: PRICE });
    await probe.withdraw();
    expect(await probe.reentrySucceeded()).to.equal(false);
    expect(await probe.received()).to.equal(PRICE);
    expect(await ethers.provider.getBalance(await sale.getAddress())).to.equal(0n);
  });

  it("closes permanently, returns unsold tokens, and leaves proceeds withdrawable", async function () {
    const { token, sale, owner, buyer } = await networkHelpers.loadFixture(fixture);
    await sale.connect(buyer).buyTokens(10n, { value: PRICE * 10n });
    await expect(sale.endSale())
      .to.emit(sale, "SaleEnded")
      .withArgs(owner.address, (ALLOCATION - 10n) * UNIT);
    expect(await sale.saleEnded()).to.equal(true);
    expect(await token.balanceOf(owner.address)).to.equal(999_990n * UNIT);
    expect(await token.balanceOf(await sale.getAddress())).to.equal(0n);
    await expect(sale.connect(buyer).buyTokens(1n, { value: PRICE })).to.be.revertedWithCustomError(
      sale,
      "SaleClosed",
    );
    await expect(sale.endSale()).to.be.revertedWithCustomError(sale, "SaleClosed");
    await expect(sale.pause()).to.be.revertedWithCustomError(sale, "SaleClosed");
    await expect(sale.unpause()).to.be.revertedWithCustomError(sale, "SaleClosed");
    await sale.withdrawProceeds(owner.address);
    expect(await ethers.provider.getBalance(await sale.getAddress())).to.equal(0n);
  });

  it("allows emergency closure and withdrawal while paused", async function () {
    const { sale, owner, buyer } = await networkHelpers.loadFixture(fixture);
    await sale.connect(buyer).buyTokens(1n, { value: PRICE });
    await sale.pause();
    await sale.endSale();
    await sale.withdrawProceeds(owner.address);
    expect(await sale.saleEnded()).to.equal(true);
  });

  it("requires the proposed owner to accept ownership", async function () {
    const { sale, owner, buyer, other } = await networkHelpers.loadFixture(fixture);
    await sale.transferOwnership(buyer.address);
    expect(await sale.owner()).to.equal(owner.address);
    expect(await sale.pendingOwner()).to.equal(buyer.address);
    await expect(sale.connect(other).acceptOwnership()).to.be.revertedWithCustomError(
      sale,
      "OwnableUnauthorizedAccount",
    );
    await sale.connect(buyer).acceptOwnership();
    expect(await sale.owner()).to.equal(buyer.address);
    await expect(sale.pause()).to.be.revertedWithCustomError(sale, "OwnableUnauthorizedAccount");
    await sale.connect(buyer).pause();
  });

  it("prevents renouncing ownership and orphaning funds", async function () {
    const { sale } = await networkHelpers.loadFixture(fixture);
    await expect(sale.renounceOwnership()).to.be.revertedWithCustomError(
      sale,
      "OwnershipRenunciationDisabled",
    );
  });
});
