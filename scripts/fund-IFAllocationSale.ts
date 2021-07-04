// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')

import IFAllocationSale from '../artifacts/contracts/IFAllocationSale.sol/IFAllocationSale.json'

export async function main() {
  // params
  let allocationSale: string = process.env.SALE || '' // address
  let amount: string = process.env.AMOUNT || '' // amount to fund

  // get allocationSale contract
  let contract = new hre.ethers.Contract(allocationSale, IFAllocationSale.abi)

  // get original saleAmount
  const originalSaleAmount = await contract
    .connect((await hre.ethers.getSigners())[0])
    .saleAmount()

  // fund
  const result = await contract
    .connect((await hre.ethers.getSigners())[0])
    .fund(amount)

  // get saleAmount
  const newSaleAmount = await contract
    .connect((await hre.ethers.getSigners())[0])
    .saleAmount()

  // log
  console.log('Sale:', allocationSale)
  console.log('Amount:', amount)
  console.log('---- Output ----')
  console.log('Tx hash:', result.hash)
  console.log('Original sale amount:', originalSaleAmount)
  console.log('New sale amount:', newSaleAmount)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
