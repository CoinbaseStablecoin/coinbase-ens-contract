import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { CoinbaseResolver__factory } from "../../src/types";

task("deploy:CoinbaseResolver").setAction(
  async (_args: TaskArguments, { ethers }) => {
    const deployer = (await ethers.getSigners())[0];

    const resolverFactory = await ethers.getContractFactory("CoinbaseResolver");
    const proxyFactory = await ethers.getContractFactory("ERC1967Proxy");

    const implementation = await resolverFactory.deploy();
    await implementation.initialize(ethers.constants.AddressZero, "", []);
    await implementation.deployed();
    console.log("Implementation contract deployed at:", implementation.address);

    const iCoinbaseResolver = CoinbaseResolver__factory.createInterface();
    const proxy = await proxyFactory.deploy(
      implementation.address,
      iCoinbaseResolver.encodeFunctionData("initialize", [
        deployer.address,
        "http://localhost:3000/r/{sender}/{data}",
        [deployer.address],
      ])
    );

    await proxy.deployed();
    console.log("Proxy contract deployed at:", proxy.address);

    // validate that the implementation address on the proxy matches the
    // implementation address
    const proxyAsResolver = await ethers.getContractAt(
      "CoinbaseResolver",
      proxy.address
    );

    if ((await proxyAsResolver.implementation()) != implementation.address) {
      throw new Error("the proxy's implementation address is incorrect!");
    }
  }
);
