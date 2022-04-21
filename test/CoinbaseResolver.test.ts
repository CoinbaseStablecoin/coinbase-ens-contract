import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import type { CoinbaseResolver } from "../src/types";
import { encode } from "../src/dnsname";
import { expect } from "chai";
import { BytesLike, utils, Wallet } from "ethers";
import { SigningKey } from "ethers/lib/utils";
import {
  IExtendedResolver__factory,
  IResolverService__factory,
  Resolver__factory,
} from "../src/types";

const iResolver = Resolver__factory.createInterface();
const iResolverService = IResolverService__factory.createInterface();
const iExtendedResolver = IExtendedResolver__factory.createInterface();

describe("CoinbaseResolver", () => {
  const url = "https://example.com/r/{sender}/{data}";

  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let signerManager: SignerWithAddress;
  let gatewayManager: SignerWithAddress;
  let signer: Wallet;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;

  let resolver: CoinbaseResolver;

  before(async () => {
    signer = ethers.Wallet.createRandom().connect(ethers.provider);

    let user3: SignerWithAddress;
    [deployer, owner, signerManager, gatewayManager, user, user2, user3] =
      await ethers.getSigners();

    // fund signer address
    await user3.sendTransaction({
      to: signer.address,
      value: (await user3.getBalance()).div(2),
    });
  });

  beforeEach(async () => {
    const resolverFactory = await ethers.getContractFactory("CoinbaseResolver");
    resolver = await resolverFactory
      .connect(deployer)
      .deploy(
        owner.address,
        signerManager.address,
        gatewayManager.address,
        url,
        [signer.address]
      );
  });

  it("initializes the contract", async () => {
    expect(await resolver.owner()).to.equal(owner.address);
    expect(await resolver.signerManager()).to.equal(signerManager.address);
    expect(await resolver.gatewayManager()).to.equal(gatewayManager.address);
    expect(await resolver.url()).to.equal(url);
    expect(await resolver.isSigner(signer.address)).to.be.true;
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

  describe(".url/.setUrl", () => {
    it("lets the gateway manager change the gateway URL", async () => {
      await expect(resolver.connect(gatewayManager).setUrl("https://test.com"))
        .to.emit(resolver, "UrlSet")
        .withArgs(url, "https://test.com");

      expect(await resolver.url()).to.equal("https://test.com");
    });

    it("does not allow an address that is not a gateway manager to change the gateway URL", async () => {
      for (const account of [deployer, signerManager, signer, user, user2]) {
        await expect(
          resolver.connect(account).setUrl("https://test.com")
        ).to.be.revertedWith(
          "Manageable::onlyGatewayManager: caller is not gateway manager"
        );
      }
    });
  });

  describe(".signers/.isSigner/.addSigners/.removeSigners", () => {
    it("lets the signer manager add and remove signers", async () => {
      for (const account of [user, user2]) {
        expect(await resolver.isSigner(account.address)).to.be.false;
      }

      await expect(
        resolver.connect(signerManager).addSigners([
          user.address,
          user.address, // duplicate address is ignored
          user2.address,
          signer.address, // existing signer address is ignored
        ])
      )
        .to.emit(resolver, "SignerAdded")
        .withArgs(user.address)
        .and.to.emit(resolver, "SignerAdded")
        .withArgs(user2.address);

      let signers = await resolver.signers();
      expect(signers).to.have.lengthOf(3);

      for (const account of [signer, user, user2]) {
        expect(await resolver.isSigner(account.address)).to.be.true;
        expect(signers).to.contain(account.address);
      }

      await expect(
        resolver.connect(signerManager).removeSigners([
          user.address,
          user.address, // duplicate address is ignored
          user2.address,
          owner.address, // non-signer address is ignored
        ])
      )
        .to.emit(resolver, "SignerRemoved")
        .withArgs(user.address)
        .and.to.emit(resolver, "SignerRemoved")
        .withArgs(user2.address);

      signers = await resolver.signers();
      expect(signers).to.eql([signer.address]);
      expect(await resolver.isSigner(signer.address)).to.be.true;

      for (const account of [user, user2]) {
        expect(await resolver.isSigner(account.address)).to.be.false;
      }
    });

    it("does not allow an address that is not a signer manager to add or remove signers", async () => {
      for (const account of [deployer, gatewayManager, signer, user, user2]) {
        await expect(
          resolver.connect(account).addSigners([user2.address])
        ).to.be.revertedWith(
          "Manageable::onlySignerManager: caller is not signer manager"
        );
        await expect(
          resolver.connect(account).removeSigners([signer.address])
        ).to.be.revertedWith(
          "Manageable::onlySignerManager: caller is not signer manager"
        );
      }
    });
  });

  describe(".owner/.transferOwnership", () => {
    it("lets the owner transfer ownership to another user", async () => {
      await expect(resolver.connect(owner).transferOwnership(user.address)).not
        .to.be.reverted;

      expect(await resolver.owner()).to.equal(user.address);

      await expect(resolver.connect(user).transferOwnership(owner.address)).not
        .to.be.reverted;

      expect(await resolver.owner()).to.equal(owner.address);
    });

    it("does not allow a non-owner to transfer ownership", async () => {
      await expect(resolver.connect(owner).renounceOwnership()).not.to.be
        .reverted;

      for (const account of [
        owner, // renounced ownership
        deployer,
        signerManager,
        gatewayManager,
        signer,
        user,
        user2,
      ]) {
        await expect(
          resolver.connect(account).transferOwnership(account.address)
        ).to.be.revertedWith("caller is not the owner");
      }
    });

    it("does not allow a transfer of ownership to a zero address", async () => {
      await expect(
        resolver.connect(owner).transferOwnership(ethers.constants.AddressZero)
      ).to.be.revertedWith("new owner is the zero address");
    });
  });

  describe(".signerManager/.changeSignerManager", () => {
    it("lets the owner change signer manager to another user", async () => {
      await expect(resolver.connect(owner).changeSignerManager(user.address))
        .to.emit(resolver, "SignerManagerChanged")
        .withArgs(signerManager.address, user.address);

      expect(await resolver.signerManager()).to.equal(user.address);
    });

    it("does not allow a non-owner to change signer manager", async () => {
      for (const account of [
        deployer,
        signerManager,
        gatewayManager,
        signer,
        user,
        user2,
      ]) {
        await expect(
          resolver.connect(account).changeSignerManager(account.address)
        ).to.be.revertedWith("caller is not the owner");
      }
    });

    it("does not allow a change signer manager to a zero address", async () => {
      await expect(
        resolver
          .connect(owner)
          .changeSignerManager(ethers.constants.AddressZero)
      ).to.be.revertedWith(
        "Manageable::changeSignerManager: manager is the zero address"
      );
    });
  });

  describe(".gatewayManager/.changeGatewayManager", () => {
    it("lets the owner change gateway manager to another user", async () => {
      await expect(resolver.connect(owner).changeGatewayManager(user.address))
        .to.emit(resolver, "GatewayManagerChanged")
        .withArgs(gatewayManager.address, user.address);

      expect(await resolver.gatewayManager()).to.equal(user.address);
    });

    it("does not allow a non-owner to change gateway manager", async () => {
      for (const account of [
        deployer,
        signerManager,
        gatewayManager,
        signer,
        user,
        user2,
      ]) {
        await expect(
          resolver.connect(account).changeGatewayManager(account.address)
        ).to.be.revertedWith("caller is not the owner");
      }
    });

    it("does not allow a change gateway manager to a zero address", async () => {
      await expect(
        resolver
          .connect(owner)
          .changeGatewayManager(ethers.constants.AddressZero)
      ).to.be.revertedWith(
        "Manageable::changeGatewayManager: manager is the zero address"
      );
    });
  });

  describe("resolution", () => {
    const name = "pete.eth";
    const dnsName = encode(name);
    const addrCallData = (iResolver as utils.Interface).encodeFunctionData(
      "addr(bytes32)",
      [ethers.utils.namehash(name)]
    );
    const addrCallResultData = iResolver.encodeFunctionResult("addr(bytes32)", [
      ethers.Wallet.createRandom().address,
    ]);
    const requestCallData = iResolverService.encodeFunctionData("resolve", [
      dnsName,
      addrCallData,
    ]);

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
        await expect(
          resolver.connect(signerManager).removeSigners([signer.address])
        ).not.to.be.reverted;

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
