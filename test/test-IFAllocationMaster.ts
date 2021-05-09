import '@nomiclabs/hardhat-ethers'
import { ethers, network } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from '@ethersproject/contracts'
import { mineNext } from './helpers'

export default describe('IFAllocationMaster', function () {
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
      '21000000000000000000000000' // 21 million * 10**18
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
      '200000000000000000' // active rollover rate (20%)
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
      '200000000000000000' // active rollover rate (20%)
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
      '200000000000000000' // active rollover rate (20%)
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
    await TestToken.transfer(simUser1.address, '10000000000000000000000000') // 10M tokens
    await TestToken.transfer(simUser2.address, '10000000000000000000000000') // 10M tokens

    // add a track
    mineNext()
    await IFAllocationMaster.addTrack(
      'TEST Track', // name
      TestToken.address, // stake token
      '1000000000', // weight accrual rate
      '100000000000000000', // passive rollover rate (10%)
      '200000000000000000' // active rollover rate (20%)
    )

    const trackNum = await IFAllocationMaster.trackCount()

    // how much to stake on a block-by-block basis
    const simulationInput = [
      {
        stakeAmounts: [
          { user: simUser1, amount: '1000000000' }, // 1 gwei
          { user: simUser2, amount: '1000000000' }, // 1 gwei
        ],
      },
      {},
      {},
      {},
      {},
      {
        stakeAmounts: [
          { user: simUser1, amount: '50000000000' }, // 50 gwei
          { user: simUser2, amount: '50000000000' }, // 50 gwei
        ],
      },
      {},
      { bumpSaleCounter: true },
      {},
      {},
      {
        stakeAmounts: [
          { user: simUser1, amount: '-50000000000' }, // -50 gwei
          { user: simUser2, amount: '-50000000000' }, // -50 gwei
        ],
      },
      {},
      {},
      {},
      {
        stakeAmounts: [
          { user: simUser1, amount: '2500000000' }, // 2.5 gwei
          { user: simUser2, amount: '2500000000' }, // 2.5 gwei
        ],
        bumpSaleCounter: true,
      },
      { bumpSaleCounter: true },
      { bumpSaleCounter: true },
      {},
      {},
      {},
      {},
      {},
      { bumpSaleCounter: true },
      {},
      {},
      {
        stakeAmounts: [
          { user: simUser1, amount: '500000000000' }, // 500 gwei
          { user: simUser2, amount: '500000000000' }, // 500 gwei
        ],
      },
      {},
      {},
      {},
      { bumpSaleCounter: true },
      {},
      {},
      {},
      { activeRollOvers: [simUser1, simUser2] },
      {
        stakeAmounts: [
          { user: simUser1, amount: '10000000000' },
          { user: simUser2, amount: '10000000000' }, // 10 gwei
        ],
      },
      {},
      {},
      {},
      { bumpSaleCounter: true },
      {},
      {},
      {},
      {},
    ]

    //// block-by-block simulation

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
      if (simulationInput[i].activeRollOvers) {
        for (let user of simulationInput[i].activeRollOvers)
          await IFAllocationMaster.connect(user).activeRollOver(trackNum)
      }

      // user stakes/unstakes according to stakesOverTime
      if (simulationInput[i].stakeAmounts) {
        for (let { user, amount } of simulationInput[i].stakeAmounts) {
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
        userStake: user1Cp.staked,
        userWeight: await IFAllocationMaster.getUserStakeWeight(
          trackNum,
          simUser1.address,
          currBlockNum
        ),
        userSaleCount: user1Cp.numFinishedSales,
        totalWeight: await IFAllocationMaster.getTotalStakeWeight(
          trackNum,
          currBlockNum
        ),
        trackSaleCount: trackCp.numFinishedSales,
        gasUsed: gasUsed,
      })
    }

    // print simulation data
    console.log(`Simulation data (sim start block - ${simStartBlock})`)
    simOutput.map(async (row) => {
      console.log(
        'Block',
        (row.block - simStartBlock).toString(),
        '| User1 stake',
        row.userStake.toString(),
        '| User1 weight',
        row.userWeight.toString(),
        '| User1 cp # sales',
        row.userSaleCount.toString(),
        '| Total weight',
        row.totalWeight.toString(),
        '| Track # sales',
        row.trackSaleCount.toString(),
        '| Gas used',
        row.gasUsed.toString()
      )
    })

    // print track checkpoints
    console.log('\nTrack checkpoints')
    const nTrackCheckpoints = await IFAllocationMaster.trackCheckpointCounts(
      trackNum
    )
    for (let i = 0; i < nTrackCheckpoints; i++) {
      const checkpoint = await IFAllocationMaster.trackCheckpoints(trackNum, i)
      console.log(
        'Block',
        (checkpoint.blockNumber - simStartBlock).toString(),
        '| Total staked',
        checkpoint.totalStaked.toString(),
        '| Total stake weight',
        checkpoint.totalStakeWeight.toString(),
        '| Finished # sales',
        checkpoint.numFinishedSales.toString()
      )
    }

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
