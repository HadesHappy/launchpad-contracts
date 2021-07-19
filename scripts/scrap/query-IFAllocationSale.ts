// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre: HardhatRuntimeEnvironment = require('hardhat')

import { ethers } from 'ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import IFAllocationSale from '../../artifacts/contracts/IFAllocationSale.sol/IFAllocationSale.json'
import ERC20 from '../../artifacts/contracts/TestToken.sol/TestToken.json'
import {
  computeMerkleProof,
  computeMerkleRoot,
  getAddressIndex,
} from '../../library/merkleWhitelist'

export async function main() {
  // params
  let allocationSale: string = process.env.SALE || '' // address

  // get allocationSale contract
  let allocationSaleContract = new hre.ethers.Contract(
    allocationSale,
    IFAllocationSale.abi
  )

  //// get info

  const saleAmount = (
    await allocationSaleContract
      .connect((await hre.ethers.getSigners())[0])
      .saleAmount()
  ).toString()

  console.log('Sale amount:', saleAmount)

  // const whitelistRootHash = (
  //   await allocationSaleContract
  //     .connect((await hre.ethers.getSigners())[0])
  //     .whitelistRootHash()
  // ).toString()

  // console.log('Whitelist root hash:', whitelistRootHash)

  console.log(ethers.utils.id('setWhitelist(bytes32)'))

  let whitelist = ['0x...', '0x...', '0x...', '0x...', '0x...']
  whitelist = whitelist.map((s) => s.toLowerCase()).sort()

  // get and display root
  const root = computeMerkleRoot(whitelist)
  console.log('root:', root)

  // get index
  const acctIdx = getAddressIndex(whitelist, '0x...')
  console.log('addr index', acctIdx)

  // get proof
  const proof = computeMerkleProof(whitelist, acctIdx)
  console.log('proof', proof)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
