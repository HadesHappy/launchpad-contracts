// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat

import TestToken from '../artifacts/contracts/TestToken.sol/TestToken.json'

// Runtime Environment's members available in the global scope.
import hre from 'hardhat'

export async function main() {
  // params
  let token = process.env.TOKEN || '' // address
  let to: string = process.env.TO || '' // address
  let amount: string = process.env.AMOUNT || '' // amount

  // get contract from token
  let tokenContract = new hre.ethers.Contract(token, TestToken.abi)

  // transfer
  const result = await tokenContract
    .connect((await hre.ethers.getSigners())[0])
    .transfer(to, amount)

  // log
  console.log('Token', token)
  console.log('Amount', amount)
  console.log('Sent to', to)
  console.log('----')
  console.log('Tx hash', result.hash)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
