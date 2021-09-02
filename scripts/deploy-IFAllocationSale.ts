// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat'

export async function main(): Promise<void> {
  // deploy params

  const seller: string = process.env.SELLER || '' // address
  const payToken: string = process.env.PAY_TOKEN || '' // address
  const saleToken: string = process.env.SALE_TOKEN || '' // address
  const allocationMaster: string = process.env.ALLOCATION_MASTER || '' // address
  const trackId: number = parseInt(process.env.TRACK_ID || '') // ID of track

  const snapshotBlock: number = parseInt(process.env.SNAP_BLOCK || '') // block at which to take allocation snapshot
  const startBlock: number = parseInt(process.env.START_BLOCK || '') // start block of sale (inclusive)
  const endBlock: number = parseInt(process.env.END_BLOCK || '') // end block of sale (inclusive)
  const salePrice = process.env.SALE_PRICE // amount of payment token per sale token
  const maxTotalPayment = process.env.MAX_TOTAL_PAYMENT // max total payment (per user)

  // We get the contract to deploy
  const IFAllocationSaleFactory = await hre.ethers.getContractFactory('IFAllocationSale')

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
    maxTotalPayment
  )

  await IFAllocationSale.deployed()

  console.log('IFAllocationSale deployed to ', IFAllocationSale.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
