import { artifacts, ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import type { CoinbaseResolver } from "../src/types/CoinbaseResolver";
import { encode } from "../src/dnsname";
import { expect } from "chai";
import { abi as resolverABI } from "@ensdomains/ens-contracts/artifacts/contracts/resolvers/Resolver.sol/Resolver.json";
import { abi as resolverServiceABI } from "../artifacts/contracts/ens-offchain-resolver/IResolverService.sol/IResolverService.json";
import { abi as IExtendedResolverABI } from "../artifacts/contracts/ens-offchain-resolver/IExtendedResolver.sol/IExtendedResolver.json";
import { BytesLike, Wallet } from "ethers";
import { SigningKey } from "ethers/lib/utils";

const iResolver = new ethers.utils.Interface(resolverABI);
const iResolverService = new ethers.utils.Interface(resolverServiceABI);
const iExtendedResolver = new ethers.utils.Interface(IExtendedResolverABI);

describe("CoinbaseResolver", () => {
  const url = "https://example.com/r/{sender}/{data}";

  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let signer: Wallet;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;

  let resolver: CoinbaseResolver;

  before(async () => {
    signer = ethers.Wallet.createRandom().connect(ethers.provider);
    [deployer, owner, user, user2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const resolverArtifact = await artifacts.readArtifact("CoinbaseResolver");

    resolver = <CoinbaseResolver>(
      await waffle.deployContract(deployer, resolverArtifact)
    );
  });

  describe(".initialize", () => {
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

  describe(".supportsInterface", () => {
    it("returns true if the ERC-165 interface ID is given", async () => {
      expect(await resolver.supportsInterface("0x01ffc9a7")).to.be.true;
    });

    it("returns true if the interface ID of IExtendedResolver is given", async () => {
      expect(
        await resolver.supportsInterface(
          iExtendedResolver.getSighash("resolve(bytes,bytes)")
        )
      ).to.be.true;
    });

    it("returns false if some random interface ID is given", async () => {
      expect(await resolver.supportsInterface("0xcafebabe")).to.be.false;
    });
  });

  context("after initializing", () => {
    beforeEach(async () => {
      await resolver
        .connect(deployer)
        .initialize(owner.address, url, [signer.address]);
    });

    describe(".url/.setUrl", () => {
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

    describe(".isSigner/.addSigners/.removeSigners", () => {
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

    describe(".owner/.transferOwnership", () => {
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

    describe("resolution", () => {
      const name = "pete.eth";
      const dnsName = encode(name);
      const addrCallData = iResolver.encodeFunctionData("addr(bytes32)", [
        ethers.utils.namehash(name),
      ]);
      const addrCallResultData = iResolver.encodeFunctionResult(
        "addr(bytes32)",
        [ethers.Wallet.createRandom().address]
      );
      const requestCallData = iResolverService.encodeFunctionData(
        "resolve(bytes,bytes)",
        [dnsName, addrCallData]
      );

      describe(".resolve", () => {
        it("reverts with an OffchainLookup error", async () => {
          const expectedError = `OffchainLookup(${[
            resolver.address, // sender
            [url], // urls
            requestCallData, // callData
            resolver.interface.getSighash("resolveWithProof(bytes,bytes)"), // callbackFunction
            requestCallData, // extraData
          ]
            .map((o) => JSON.stringify(o))
            .join(", ")})`;

          await expect(
            resolver.resolve(dnsName, addrCallData)
          ).to.be.revertedWith(expectedError);
        });
      });

      describe(".makeSignatureHash", () => {
        it("generates a hash for signing and verifying the offchain response", async () => {
          const expires = Math.floor(Date.now() / 1000) + 10;

          expect(
            await resolver.makeSignatureHash(
              expires,
              requestCallData,
              addrCallResultData
            )
          ).to.equal(
            makeSignatureHash(
              resolver.address,
              expires,
              requestCallData,
              addrCallResultData
            )
          );
        });
      });

      describe(".resolveWithProof", () => {
        it("returns the result when it is not expired and signed by a signer", async () => {
          const expires = Math.floor(Date.now() / 1000) + 300;

          const responseData = makeSignedResponse(
            resolver.address,
            expires,
            requestCallData,
            addrCallResultData,
            signer._signingKey()
          );

          expect(
            await resolver.resolveWithProof(responseData, requestCallData)
          ).to.equal(addrCallResultData);
        });

        it("reverts if the signed response is expired", async () => {
          const expires = Math.floor(Date.now() / 1000);

          const responseData = makeSignedResponse(
            resolver.address,
            expires,
            requestCallData,
            addrCallResultData,
            signer._signingKey()
          );

          await expect(
            resolver.resolveWithProof(responseData, requestCallData)
          ).to.be.revertedWith("Signature expired");
        });

        it("reverts if it is not signed by a signer", async () => {
          // remove signer
          await expect(resolver.connect(owner).removeSigners([signer.address]))
            .not.to.be.reverted;

          const expires = Math.floor(Date.now() / 1000) + 300;

          const responseData = makeSignedResponse(
            resolver.address,
            expires,
            requestCallData,
            addrCallResultData,
            signer._signingKey()
          );

          await expect(
            resolver.resolveWithProof(responseData, requestCallData)
          ).to.be.revertedWith("invalid signature");
        });
      });
    });
  });
});

function makeSignatureHash(
  target: string,
  expires: number,
  request: BytesLike,
  result: BytesLike
): string {
  return ethers.utils.solidityKeccak256(
    ["bytes2", "address", "uint64", "bytes", "bytes"],
    [
      "0x1900",
      target,
      expires,
      ethers.utils.keccak256(request),
      ethers.utils.keccak256(result),
    ]
  );
}

function makeSignedResponse(
  resolverAddress: string,
  expires: number,
  requestCallData: BytesLike,
  resultData: BytesLike,
  signingKey: SigningKey
): string {
  const sig = signingKey.signDigest(
    makeSignatureHash(resolverAddress, expires, requestCallData, resultData)
  );

  const sigRSV = ethers.utils.hexConcat([sig.r, sig.s, [sig.v]]);

  return iResolverService.encodeFunctionResult("resolve(bytes,bytes)", [
    resultData,
    expires,
    sigRSV,
  ]);
}
