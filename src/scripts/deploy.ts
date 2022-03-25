import { CoinbaseResolver__factory } from "../../src/types";
import "@nomiclabs/hardhat-ethers";
import hre from "hardhat";

async function main() {
  const { ethers } = hre;

  const deployer = (await ethers.getSigners())[0];
  const resolverFactory = await ethers.getContractFactory("CoinbaseResolver");

  const constructorArgs: [string, string, string, string, string[]] = [
    deployer.address,
    deployer.address,
    deployer.address,
    "http://localhost:3000/r/{sender}/{data}",
    [deployer.address],
  ];

  const iCoinbaseResolver = CoinbaseResolver__factory.createInterface();
  const constructorData = iCoinbaseResolver.encodeDeploy(constructorArgs);

  console.log(`deploying CoinbaseResolver (arguments: ${constructorData})...`);

  const implementation = await resolverFactory.deploy(...constructorArgs);
  console.log(
    "-> deployed CoinbaseResolver contract at",
    implementation.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
