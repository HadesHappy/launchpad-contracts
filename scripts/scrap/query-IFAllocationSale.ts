// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat'

import { ethers } from 'ethers'
import IFAllocationSale from '../../artifacts/contracts/IFAllocationSale.sol/IFAllocationSale.json'
import IFAllocationMaster from '../../artifacts/contracts/IFAllocationMaster.sol/IFAllocationMaster.json'
// import ERC20 from '../../artifacts/contracts/TestToken.sol/TestToken.json'
// import {
//   computeMerkleProof,
//   computeMerkleRoot,
//   getAddressIndex,
// } from '../../library/merkleWhitelist'

export async function main(): Promise<void> {
  // params
  const allocationSale: string = process.env.SALE || '' // address

  // get allocationSale contract
  const allocationSaleContract = new hre.ethers.Contract(
    allocationSale,
    IFAllocationSale.abi
  )

  const allocationMaster = (
    await allocationSaleContract
      .connect((await hre.ethers.getSigners())[0])
      .allocationMaster()
  ).toString()
  console.log('Allocation master:', allocationMaster)

  // get allocationMaster contract
  const allocationMasterContract = new hre.ethers.Contract(
    allocationMaster,
    IFAllocationMaster.abi
  )

  //// get info

  const salePrice = (
    await allocationSaleContract
      .connect((await hre.ethers.getSigners())[0])
      .salePrice()
  ).toString()
  console.log('Sale price:', salePrice)

  const minTotalPayment = (
    await allocationSaleContract
      .connect((await hre.ethers.getSigners())[0])
      .minTotalPayment()
  ).toString()
  console.log('Min total payment:', minTotalPayment)

  const maxTotalPayment = (
    await allocationSaleContract
      .connect((await hre.ethers.getSigners())[0])
      .maxTotalPayment()
  ).toString()
  console.log('Max total payment:', maxTotalPayment)

  const startBlock = (
    await allocationSaleContract
      .connect((await hre.ethers.getSigners())[0])
      .startBlock()
  ).toString()

  console.log('Start block:', startBlock)

  const endBlock = (
    await allocationSaleContract
      .connect((await hre.ethers.getSigners())[0])
      .endBlock()
  ).toString()

  console.log('End block:', endBlock)

  const trackId = (
    await allocationSaleContract
      .connect((await hre.ethers.getSigners())[0])
      .trackId()
  ).toString()

  console.log('Track ID:', trackId)

  const allocSnapshotBlock = (
    await allocationSaleContract
      .connect((await hre.ethers.getSigners())[0])
      .allocSnapshotBlock()
  ).toString()

  console.log('Alloc snapshot block:', allocSnapshotBlock)

  const totalWeight = (
    await allocationMasterContract
      .connect((await hre.ethers.getSigners())[0])
      .getTotalStakeWeight(trackId, allocSnapshotBlock)
  ).toString()
  console.log('totalweight', totalWeight)

  console.log(ethers.utils.id('whitelistedPurchase(uint256,bytes32[])'))
  console.log(ethers.utils.id('setWhitelist(bytes32)'))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
