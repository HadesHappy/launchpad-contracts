import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from '@ethersproject/contracts'
import { asyncWriteFile, mineNext, readFile, unparseCsv } from './helpers'

import sim1Input from './simulationData/sim1Input.json'

// array of simulations input/output maps
const simulations = [
  { in: sim1Input, out: './test/simulationData/sim1ExpectedOutput.csv' },
]

export default describe('IFAllocationMaster', function () {
  // unset timeout from the test
  this.timeout(0)

  // vars for all tests
  let owner: SignerWithAddress
  let nonOwner: SignerWithAddress
  let simUser1: SignerWithAddress
  let simUser2: SignerWithAddress
  let TestToken: Contract
  let IFAllocationMaster: Contract

  // setup for each test
  beforeEach(async () => {
    // get test accounts
    owner = (await ethers.getSigners())[0]
    nonOwner = (await ethers.getSigners())[1]
    simUser1 = (await ethers.getSigners())[2]
    simUser2 = (await ethers.getSigners())[3]

    // deploy test token
    const TestTokenFactory = await ethers.getContractFactory('TestToken')
    TestToken = await TestTokenFactory.deploy(
      'test token',
      'TEST',
      '21000000000000000000000000000' // 21 billion * 10**18
    )

    // deploy allocation master
    const IFAllocationMasterFactory = await ethers.getContractFactory(
      'IFAllocationMaster'
    )
    IFAllocationMaster = await IFAllocationMasterFactory.deploy()
  })

  // TESTS

  it('counts tracks', async () => {
    // num tracks should be 0
    mineNext()
    expect(await IFAllocationMaster.trackCount()).to.equal(0)

    // add a track
    mineNext()
    await IFAllocationMaster.addTrack(
      'TEST Track', // name
      TestToken.address, // stake token
      1000, // weight accrual rate
      '100000000000000000', // passive rollover rate (10%)
      '200000000000000000', // active rollover rate (20%)
      '1000000000000000000000000000000' // max total stake (1 trillion)
    )

    // num tracks should be 1
    mineNext()
    expect(await IFAllocationMaster.trackCount()).to.equal(1)
  })

  it('can bump sale counter', async () => {
    // add a track
    mineNext()
    await IFAllocationMaster.addTrack(
      'TEST Track', // name
      TestToken.address, // stake token
      1000, // weight accrual rate
      '100000000000000000', // passive rollover rate (10%)
      '200000000000000000', // active rollover rate (20%)
      '1000000000000000000000000000000' // max total stake (1 trillion)
    )
    const trackNum = 0

    // bump sale counter
    mineNext()
    await IFAllocationMaster.bumpSaleCounter(trackNum)
    mineNext()

    // update track as non-owner (should fail)
    mineNext()
    await IFAllocationMaster.connect(nonOwner).bumpSaleCounter(trackNum)
    mineNext()

    // sale counter should update only by owner
    const nTrackCheckpoints = await IFAllocationMaster.trackCheckpointCounts(
      trackNum
    )
    const latestTrackCp = await IFAllocationMaster.trackCheckpoints(
      trackNum,
      nTrackCheckpoints - 1
    )
    mineNext()
    expect(latestTrackCp.numFinishedSales).to.equal(1) // only 1 not 2

    //// user checkpoint should record latest sale count

    // approve
    await TestToken.approve(IFAllocationMaster.address, '1000')
    // stake
    await IFAllocationMaster.stake(trackNum, '1000')
    mineNext()

    // get newly generated checkpoint info
    const nUserCheckpoints = await IFAllocationMaster.userCheckpointCounts(
      trackNum,
      owner.address
    )
    const userCp = await IFAllocationMaster.userCheckpoints(
      trackNum,
      owner.address,
      nUserCheckpoints - 1
    )

    // new user checkpoint's numFinishedSales should match
    expect(userCp.numFinishedSales).to.equal(1)
  })

  it('can disable track', async () => {
    // add a track
    mineNext()
    await IFAllocationMaster.addTrack(
      'TEST Track', // name
      TestToken.address, // stake token
      1000, // weight accrual rate
      '100000000000000000', // passive rollover rate (10%)
      '200000000000000000', // active rollover rate (20%)
      '1000000000000000000000000000000' // max total stake (1 trillion)
    )
    const trackNum = 0

    // disable track as non-owner (should fail)
    mineNext()
    await IFAllocationMaster.connect(nonOwner).disableTrack(trackNum)
    mineNext()

    // try to stake (should work)
    await TestToken.approve(IFAllocationMaster.address, 100) // approve
    await IFAllocationMaster.stake(trackNum, 100) // stake
    mineNext()
    expect(await TestToken.balanceOf(IFAllocationMaster.address)).to.equal(100)

    // disable track as owner (should work)
    mineNext()
    await IFAllocationMaster.disableTrack(trackNum)
    mineNext()

    // try to stake (should not work)
    await TestToken.approve(IFAllocationMaster.address, 5) // approve
    await IFAllocationMaster.stake(trackNum, 5) // stake
    mineNext()
    expect(await TestToken.balanceOf(IFAllocationMaster.address)).to.equal(100)
  })

  it('simulates', async () => {
    // allocate stake token to simulation user1 and user2
    mineNext()
    await TestToken.transfer(simUser1.address, '10000000000000000000000000000') // 10B tokens
    await TestToken.transfer(simUser2.address, '10000000000000000000000000000') // 10B tokens

    // add a track
    mineNext()
    await IFAllocationMaster.addTrack(
      'TEST Track', // name
      TestToken.address, // stake token
      '10000000', // weight accrual rate
      '100000000000000000', // passive rollover rate (10%)
      '200000000000000000', // active rollover rate (20%)
      '10000000000000000000000000000' // max total stake (10B)
    )

    const trackNum = await IFAllocationMaster.trackCount()

    // how much to stake on a block-by-block basis
    const simulationInput = simulations[0].in

    //// block-by-block simulation

    // simulation users
    const simUsers = [simUser1, simUser2]
    // simulation data
    const simOutput = []
    // simulation starting block
    const simStartBlock = await ethers.provider.getBlockNumber()

    // simulation
    for (let i = 0; i < simulationInput.length; i++) {
      // bump sale counter if specified
      if (simulationInput[i].bumpSaleCounter) {
        await IFAllocationMaster.bumpSaleCounter(trackNum)
      }

      // perform active rollover if specified
      const activeRollovers = simulationInput[i].activeRollOvers
      if (activeRollovers) {
        for (let j = 0; j < activeRollovers.length; j++)
          await IFAllocationMaster.connect(simUsers[j]).activeRollOver(trackNum)
      }

      // user stakes/unstakes according to stakesOverTime
      const stakeAmounts = simulationInput[i].stakeAmounts
      if (stakeAmounts) {
        for (let j = 0; j < stakeAmounts.length; j++) {
          const amount = stakeAmounts[j]
          const user = simUsers[j]

          if (amount !== '0' && amount[0] !== '-') {
            // approve
            await TestToken.connect(user).approve(
              IFAllocationMaster.address,
              amount
            )
            // stake
            await IFAllocationMaster.connect(user).stake(trackNum, amount)
          } else if (amount !== '0' && amount[0] === '-') {
            // unstake
            await IFAllocationMaster.connect(user).unstake(
              trackNum,
              amount.substring(1)
            )
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
      const nTrackCheckpoints = await IFAllocationMaster.trackCheckpointCounts(
        trackNum
      )
      const trackCp = await IFAllocationMaster.trackCheckpoints(
        trackNum,
        nTrackCheckpoints - 1
      )

      // get checkpoints of users
      const nUserCheckpoints = await IFAllocationMaster.userCheckpointCounts(
        trackNum,
        simUser1.address
      )
      const user1Cp = await IFAllocationMaster.userCheckpoints(
        trackNum,
        simUser1.address,
        nUserCheckpoints - 1
      )

      // save data row
      simOutput.push({
        block: currBlockNum,
        user1Stake: user1Cp.staked,
        user1Weight: await IFAllocationMaster.getUserStakeWeight(
          trackNum,
          simUser1.address,
          currBlockNum
        ),
        user1SaleCount: user1Cp.numFinishedSales,
        totalWeight: await IFAllocationMaster.getTotalStakeWeight(
          trackNum,
          currBlockNum
        ),
        trackSaleCount: trackCp.numFinishedSales,
        gasUsed: gasUsed,
      })
    }

    // // write output to CSV
    // await asyncWriteFile(
    //   './test/simulationData',
    //   'out.csv',
    //   unparseCsv(simOutput)
    // )

    //// check simulation output against output csv
    // get lines of expected output and simulation
    const expectedLines = (await readFile(simulations[0].out)).split(/\r?\n/)
    const simOutLines = unparseCsv(simOutput).split(/\r?\n/)

    // compare each line
    expectedLines.map((expectedLine, i) => {
      expect(expectedLine).to.equal(simOutLines[i])
    })

    // // print track checkpoints
    // console.log('\nTrack checkpoints')
    // const nTrackCheckpoints = await IFAllocationMaster.trackCheckpointCounts(
    //   trackNum
    // )
    // for (let i = 0; i < nTrackCheckpoints; i++) {
    //   const checkpoint = await IFAllocationMaster.trackCheckpoints(trackNum, i)
    //   console.log(
    //     'Block',
    //     (checkpoint.blockNumber - simStartBlock).toString(),
    //     '| Total staked',
    //     checkpoint.totalStaked.toString(),
    //     '| Total stake weight',
    //     checkpoint.totalStakeWeight.toString(),
    //     '| Finished # sales',
    //     checkpoint.numFinishedSales.toString()
    //   )
    // }

    // get a historical checkpoint
    console.log(
      'Historical checkpoint',
      (
        await IFAllocationMaster.getTotalStakeWeight(
          trackNum,
          simStartBlock + 35
        )
      ).toString()
    )
  })
})
