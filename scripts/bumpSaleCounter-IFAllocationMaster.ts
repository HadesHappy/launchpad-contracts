// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat

import IFAllocationMaster from '../artifacts/contracts/IFAllocationMaster.sol/IFAllocationMaster.json'

// Runtime Environment's members available in the global scope.
import hre from 'hardhat'

// string calldata name,
// ERC20 stakeToken,
// uint80 _weightAccrualRate,
// uint64 _passiveRolloverRate,
// uint64 _activeRolloverRate
export async function main() {
  // params
  let allocationMaster = process.env.ALLOCATION_MASTER || '' // allocation master
  let trackId: string = process.env.TRACK_ID || '' // track ID

  // get allocationMaster contract
  let allocationMasterContract = new hre.ethers.Contract(
    allocationMaster,
    IFAllocationMaster.abi
  )

  // transfer
  const result = await allocationMasterContract
    .connect((await hre.ethers.getSigners())[0])
    .bumpSaleCounter(trackId)

  // log
  console.log('Track ID:', trackId)
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
