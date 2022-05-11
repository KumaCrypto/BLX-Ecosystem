import { ethers, run } from "hardhat";
import { BLXBank, BLXBank__factory } from "../typechain-types";

const token = "0x98aF19040b0B36Ef8d55E5c583A0627378803be9";

async function main() {
  const [signer] = await ethers.getSigners();

  const BLXBank: BLXBank = await new BLXBank__factory(signer).deploy(token);
  await BLXBank.deployed();

  await run(`verify:verify`, {
    address: BLXBank.address,
    contract: "contracts/BloxifyToken.sol:BloxifyToken",
    constructorArguments: [token],
  });

  console.log(`
    Deployed in rinkeby
    =================
    "BloxifyToken" contract address: ${BLXBank.address}
    ${BLXBank.address} - deployed this contracts
  `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
