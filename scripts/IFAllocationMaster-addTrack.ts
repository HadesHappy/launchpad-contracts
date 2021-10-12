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
export async function main(): Promise<void> {
  // params
  const allocationMaster = process.env.ALLOCATION_MASTER || '' // allocation master
  const name = process.env.TRACK_NAME || '' // name of track
  const token: string = process.env.TOKEN || '' // address of stake token
  const war: string = process.env.ACCRUAL_RATE || '' // weight accrual rate
  const prr: string = process.env.PASSIVE_RO_RATE || '' // passive rollover rate
  const arr: string = process.env.ACTIVE_RO_RATE || '' // active rollover rate
  const maxTotalStake: string = process.env.MAX_TOTAL_STAKE || ''

  // get allocationMaster contract
  const allocationMasterContract = new hre.ethers.Contract(
    allocationMaster,
    IFAllocationMaster.abi
  )

  // get track number before adding
  const trackNum = await allocationMasterContract
    .connect((await hre.ethers.getSigners())[0])
    .trackCount()

  // transfer
  const result = await allocationMasterContract
    .connect((await hre.ethers.getSigners())[0])
    .addTrack(
      name, // name
      token, // stake token
      war, // weight accrual rate
      prr, // passive rollover rate
      arr, // active rollover rate,
      maxTotalStake // maximum user can stake
    )

  // log
  console.log('Track name:', name)
  console.log('Token:', token)
  console.log('Weight accrual rate:', war)
  console.log('Passive rollover rate:', prr)
  console.log('Active rollover rate:', arr)
  console.log('Maximum total stake', maxTotalStake)
  console.log('---- Output ----')
  console.log('Tx hash:', result.hash)
  console.log('Track number:', trackNum)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
