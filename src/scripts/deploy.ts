import { CoinbaseResolver__factory } from "../../src/types";
import "@nomiclabs/hardhat-ethers";
import hre from "hardhat";

async function main() {
  const { ethers } = hre;

  const deployer = (await ethers.getSigners())[0];

  const resolverFactory = await ethers.getContractFactory("CoinbaseResolver");
  const proxyFactory = await ethers.getContractFactory("ERC1967Proxy");

  console.log("deploying implementation contract...");
  const implementation = await resolverFactory.deploy();
  await implementation.deployed();
  console.log("-> deployed implementation contract at", implementation.address);

  console.log("initializing implementation contract with dummy values...");
  await implementation.initialize(ethers.constants.AddressZero, "", []);
  console.log("-> initialized implementation contract");

  const iCoinbaseResolver = CoinbaseResolver__factory.createInterface();

  const proxyArgs = [
    implementation.address,
    iCoinbaseResolver.encodeFunctionData("initialize", [
      deployer.address,
      "http://localhost:3000/r/{sender}/{data}",
      [deployer.address],
    ]),
  ];

  console.log(
    `deploying proxy contract (arguments: ${JSON.stringify(proxyArgs)})...`
  );
  const proxy = await proxyFactory.deploy(
    implementation.address,
    iCoinbaseResolver.encodeFunctionData("initialize", [
      deployer.address,
      "http://localhost:3000/r/{sender}/{data}",
      [deployer.address],
    ])
  );
  await proxy.deployed();
  console.log("-> deployed proxy contract at", proxy.address);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
