// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

export async function main() {
  // We get the contract to deploy
  const TestTokenFactory = await hre.ethers.getContractFactory('TestToken')

  // deploy test tokens
  const StakeToken = await TestTokenFactory.deploy(
    'Test Stake Token',
    'STAKE',
    '21000000000000000000000000' // 21 million * 10**18
  )
  const PaymentToken = await TestTokenFactory.deploy(
    'Test Payment Token',
    'PAY',
    '21000000000000000000000000' // 21 million * 10**18
  )
  const SaleToken = await TestTokenFactory.deploy(
    'Test Sale Token',
    'SALE',
    '21000000000000000000000000' // 21 million * 10**18
  )

  // log deployed addresses
  console.log("StakeToken deployed to ", StakeToken.address);
  console.log("PaymentToken deployed to ", PaymentToken.address);
  console.log("SaleToken deployed to ", SaleToken.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
