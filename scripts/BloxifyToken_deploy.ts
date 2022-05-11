import { ethers, run } from "hardhat";
import { BloxifyToken, BloxifyToken__factory } from "../typechain-types";

async function main() {
  const tokenName: string = "Bloxify Token";
  const tokenSymbol: string = "BLX";
  const initialSupply: number = 10e10;

  const [signer] = await ethers.getSigners();

  const token: BloxifyToken = await new BloxifyToken__factory(signer).deploy(
    tokenName,
    tokenSymbol,
    initialSupply
  );
  await token.deployed();

  await run(`verify:verify`, {
    address: token.address,
    contract: "contracts/BloxifyToken.sol:BloxifyToken",
    constructorArguments: [tokenName, tokenSymbol, initialSupply],
  });

  console.log(`
    Deployed in rinkeby
    =================
    "BloxifyToken" contract address: ${token.address}
    ${signer.address} - deployed this contracts
  `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
