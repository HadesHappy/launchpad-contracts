// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat

import GenericToken from '../artifacts/contracts/GenericToken.sol/GenericToken.json'

// Runtime Environment's members available in the global scope.
import hre from 'hardhat'

export async function main(): Promise<void> {
  // params
  const token = process.env.TOKEN || '' // address

  // get contract from token
  const tokenContract = new hre.ethers.Contract(token, GenericToken.abi)

  // transfer
  const result = await tokenContract
    .connect((await hre.ethers.getSigners())[0])
    .unpause()

  // log
  console.log('Token:', token)
  console.log('---- Output ----')
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
