import { artifacts, ethers, waffle } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import type { CoinbaseResolver } from "../src/types/CoinbaseResolver";
import { expect } from "chai";

describe("CoinbaseResolver", () => {
  const url = "https://example.com/r/{sender}/{data}";

  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let signer: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;

  let resolver: CoinbaseResolver;

  before(async () => {
    [deployer, owner, signer, user, user2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const resolverArtifact = await artifacts.readArtifact("CoinbaseResolver");
    resolver = <CoinbaseResolver>(
      await waffle.deployContract(deployer, resolverArtifact)
    );
  });

  describe("initialize", () => {
    beforeEach(async () => {
      await expect(
        resolver
          .connect(deployer)
          .initialize(owner.address, url, [signer.address])
      ).not.to.be.reverted;
    });

    it("initializes the contract", async () => {
      expect(await resolver.owner()).to.equal(owner.address);
      expect(await resolver.url()).to.equal(url);
      expect(await resolver.isSigner(signer.address)).to.be.true;
    });

    it("does not allow the contract to be initialized again", async () => {
      await expect(
        resolver
          .connect(deployer)
          .initialize(owner.address, url, [signer.address])
      ).to.be.revertedWith("already initialized");
    });
  });

  context("after initializing", () => {
    beforeEach(async () => {
      await resolver
        .connect(deployer)
        .initialize(owner.address, url, [signer.address]);
    });

    describe("url/setUrl", () => {
      it("lets the owner change the gateway URL", async () => {
        await expect(resolver.connect(owner).setUrl("https://test.com")).not.to
          .be.reverted;

        expect(await resolver.url()).to.equal("https://test.com");
      });

      it("does not allow a non-admin to change the gateway URL", async () => {
        for (const account of [deployer, signer, user, user2]) {
          await expect(
            resolver.connect(account).setUrl("https://test.com")
          ).to.be.revertedWith("caller is not the owner");
        }
      });
    });

    describe("isSigner/addSigners/removeSigners", () => {
      it("lets the owner add and remove signers", async () => {
        for (const account of [user, user2]) {
          expect(await resolver.isSigner(account.address)).to.be.false;
        }

        await expect(
          resolver.connect(owner).addSigners([user.address, user2.address])
        ).not.to.be.reverted;

        for (const account of [signer, user, user2]) {
          expect(await resolver.isSigner(account.address)).to.be.true;
        }

        await expect(
          resolver.connect(owner).removeSigners([user.address, user2.address])
        ).not.to.be.reverted;

        expect(await resolver.isSigner(signer.address)).to.be.true;
        for (const account of [user, user2]) {
          expect(await resolver.isSigner(account.address)).to.be.false;
        }
      });

      it("does not allow a non-admin to add or remove signers", async () => {
        for (const account of [deployer, signer, user, user2]) {
          await expect(
            resolver.connect(account).addSigners([user2.address])
          ).to.be.revertedWith("caller is not the owner");
          await expect(
            resolver.connect(account).removeSigners([signer.address])
          ).to.be.revertedWith("caller is not the owner");
        }
      });
    });

    describe("owner/transferOwnership", () => {
      it("lets the owner transfer ownership to another user", async () => {
        await expect(resolver.connect(owner).transferOwnership(user.address))
          .not.to.be.reverted;

        expect(await resolver.owner()).to.equal(user.address);

        await expect(resolver.connect(user).transferOwnership(owner.address))
          .not.to.be.reverted;

        expect(await resolver.owner()).to.equal(owner.address);
      });

      it("does not allow a non-admin to transfer ownership", async () => {
        for (const account of [deployer, signer, user, user2]) {
          await expect(
            resolver.connect(account).transferOwnership(account.address)
          ).to.be.revertedWith("caller is not the owner");
        }
      });
    });
  });
});
