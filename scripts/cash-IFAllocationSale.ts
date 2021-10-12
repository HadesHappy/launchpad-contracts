// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat'

import IFAllocationSale from '../artifacts/contracts/IFAllocationSale.sol/IFAllocationSale.json'
import ERC20 from '../artifacts/contracts/GenericToken.sol/GenericToken.json'

export async function main(): Promise<void> {
  // params
  const allocationSale: string = process.env.SALE || '' // address

  // get allocationSale contract
  const allocationSaleContract = new hre.ethers.Contract(
    allocationSale,
    IFAllocationSale.abi
  )


  // cash
  const result = await allocationSaleContract
    .connect((await hre.ethers.getSigners())[0])
    .cash()

  // wait for cash to be mined
  await result.wait()

  // log
  console.log('Sale:', allocationSale)
  console.log('Tx hash:', result.hash)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
