// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

export async function main() {
  // deploy params

  let seller: string = process.env.SELLER // address
  let payToken: string = process.env.PAY_TOKEN // address
  let saleToken: string = process.env.SALE_TOKEN // address
  let allocationMaster: string = process.env.ALLOCATION_MASTER // address
  let trackId: number = parseInt(process.env.TRACK_ID) // ID of track

  let snapshotBlock: number = parseInt(process.env.SNAP_BLOCK) // block at which to take allocation snapshot
  let startBlock: number = parseInt(process.env.START_BLOCK) // start block of sale (inclusive)
  let endBlock: number = parseInt(process.env.END_BLOCK) // end block of sale (inclusive)
  const salePrice = process.env.SALE_PRICE // amount of payment token per sale token
  const maxTotalDeposit = process.env.MAX_TOTAL_DEPOSIT // max deposit

  // We get the contract to deploy
  const IFAllocationSaleFactory = await hre.ethers.getContractFactory("IFAllocationSale");

  // deploy
  const IFAllocationSale = await IFAllocationSaleFactory.deploy(
    salePrice,
    seller,
    payToken,
    saleToken,
    allocationMaster,
    trackId,
    snapshotBlock,
    startBlock,
    endBlock,
    maxTotalDeposit
  );

  await IFAllocationSale.deployed();

  console.log("IFAllocationSale deployed to ", IFAllocationSale.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
