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
  let name = process.env.TRACK_NAME || '' // name of track
  let token: string = process.env.TOKEN || '' // address of stake token
  let war: string = process.env.ACCRUAL_RATE || '' // weight accrual rate
  let prr: string = process.env.PASSIVE_RO_RATE || '' // passive rollover rate
  let arr: string = process.env.ACTIVE_RO_RATE || '' // active rollover rate

  // get allocationMaster contract
  let allocationMasterContract = new hre.ethers.Contract(
    allocationMaster,
    IFAllocationMaster.abi
  )

  // transfer
  const result = await allocationMasterContract
    .connect((await hre.ethers.getSigners())[0])
    .addTrack(
      name, // name
      token, // stake token
      war, // weight accrual rate
      prr, // passive rollover rate
      arr // active rollover rate
    )

  // log
  console.log('Track name', name)
  console.log('Token', token)
  console.log('Weight accrual rate', war)
  console.log('Passive rollover rate', prr)
  console.log('Active rollover rate', arr)
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
