import { ethers, run, upgrades } from "hardhat";
import { BLXLocker } from "../typechain-types";

const token = "0x98aF19040b0B36Ef8d55E5c583A0627378803be9";

async function main() {
  const [signer] = await ethers.getSigners();

  const BLXLocker_ = await ethers.getContractFactory("BLXLocker");

  const BLXLocker = (await upgrades.deployProxy(BLXLocker_, {
    kind: "uups",
  })) as BLXLocker;
  await BLXLocker.deployed();

  await BLXLocker.initialaze(token);

  await run(`verify:verify`, {
    address: BLXLocker.address,
    contract: "contracts/BloxifyToken.sol:BloxifyToken",
    constructorArguments: [token],
  });

  console.log(`
    Deployed in rinkeby
    =================
    "BLXLocker" contract address: ${BLXLocker.address}
    ${signer} - deployed this contracts
  `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
