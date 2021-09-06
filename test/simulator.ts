import { mineNext } from './helpers'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from '@ethersproject/contracts'
import { BigNumber } from '@ethersproject/bignumber'

interface SimInputRow {
  stakeAmounts?: string[]
  bumpSaleCounter?: boolean
  activeRollOvers?: boolean[]
  label?: string
}

interface SimOutputRow {
  block: number
  user1Stake: BigNumber
  user1Weight: BigNumber
  user1SaleCount: number
  totalWeight: BigNumber
  trackSaleCount: number
  gasUsed: BigNumber
}

export const simAllocationMaster = async (
  allocationMaster: Contract,
  stakeToken: Contract,
  trackNum: number,
  simUsers: SignerWithAddress[],
  simInput: SimInputRow[]
): Promise<SimOutputRow[]> => {
  const simOutput = []

  // simulation
  for (let i = 0; i < simInput.length; i++) {
    // bump sale counter if specified
    if (simInput[i].bumpSaleCounter) {
      await allocationMaster.bumpSaleCounter(trackNum)
    }

    // perform active rollover if specified
    const activeRollovers = simInput[i].activeRollOvers
    if (activeRollovers) {
      for (let j = 0; j < activeRollovers.length; j++)
        await allocationMaster.connect(simUsers[j]).activeRollOver(trackNum)
    }

    // user stakes/unstakes according to stakesOverTime
    const stakeAmounts = simInput[i].stakeAmounts
    if (stakeAmounts) {
      for (let j = 0; j < stakeAmounts.length; j++) {
        const amount = stakeAmounts[j]
        const user = simUsers[j]

        if (amount !== '0' && amount[0] !== '-') {
          // approve
          await stakeToken
            .connect(user)
            .approve(allocationMaster.address, amount)
          // stake
          await allocationMaster.connect(user).stake(trackNum, amount)
        } else if (amount !== '0' && amount[0] === '-') {
          // unstake
          await allocationMaster
            .connect(user)
            .unstake(trackNum, amount.substring(1))
        }
      }
    }

    mineNext()

    // current block number
    const currBlockNum = await ethers.provider.getBlockNumber()

    // current block
    const currBlock = await ethers.provider.getBlock(currBlockNum)

    // gas used
    const gasUsed = currBlock.gasUsed

    // get track checkpoint
    const nTrackCheckpoints = await allocationMaster.trackCheckpointCounts(
      trackNum
    )
    const trackCp = await allocationMaster.trackCheckpoints(
      trackNum,
      nTrackCheckpoints - 1
    )

    // get checkpoints of users
    const nUserCheckpoints = await allocationMaster.userCheckpointCounts(
      trackNum,
      simUsers[0].address
    )
    const user1Cp = await allocationMaster.userCheckpoints(
      trackNum,
      simUsers[0].address,
      nUserCheckpoints - 1
    )

    // save data row
    simOutput.push({
      block: currBlockNum,
      user1Stake: user1Cp.staked,
      user1Weight: await allocationMaster.getUserStakeWeight(
        trackNum,
        simUsers[0].address,
        currBlockNum
      ),
      user1SaleCount: user1Cp.numFinishedSales,
      totalWeight: await allocationMaster.getTotalStakeWeight(
        trackNum,
        currBlockNum
      ),
      trackSaleCount: trackCp.numFinishedSales,
      gasUsed: gasUsed,
    })
  }

  return simOutput
}
