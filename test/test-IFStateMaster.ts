import '@nomiclabs/hardhat-ethers'
import { ethers, network } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from '@ethersproject/contracts'
import { mineNext } from './helpers'

export default describe('IFStateMaster', function () {
  // vars for all tests
  let owner: SignerWithAddress
  let TestToken: Contract
  let IFStateMaster: Contract

  // setup for each test
  beforeEach(async () => {
    // get owner
    owner = (await ethers.getSigners())[0]

    // deploy test token
    const TestTokenFactory = await ethers.getContractFactory('TestToken')
    TestToken = await TestTokenFactory.deploy(
      'test token',
      'TEST',
      '21000000000000000000000000' // 21 million * 10**18
    )

    // deploy statemaster
    const IFStateMasterFactory = await ethers.getContractFactory(
      'IFStateMaster'
    )
    IFStateMaster = await IFStateMasterFactory.deploy()
  })

  // TESTS

  it('counts tracks', async () => {
    // num tracks should be 0
    mineNext()
    expect(await IFStateMaster.trackCount()).to.equal(0)

    // add a track
    mineNext()
    await IFStateMaster.addTrack('TEST Track', TestToken.address, 1000)

    // num tracks should be 1
    mineNext()
    expect(await IFStateMaster.trackCount()).to.equal(1)
  })

  it('accrues stake weight', async () => {
    // add a track
    mineNext()
    await IFStateMaster.addTrack(
      'TEST Track', // track name
      TestToken.address, // token
      1000000000 // weight accrual rate
    )

    const trackNum = await IFStateMaster.trackCount()

    // how much to stake on a block-by-block basis
    const stakesOverTime = [
      '1000000000', // 1 gwei
      '0',
      '0',
      '0',
      '0',
      '50000000000', // 50 gwei
      '0',
      '0',
      '-50000000000', // -50 gwei
      '0',
      '0',
      '2500000000', // 2.5 gwei
      '0',
      '0',
      '0',
      '0',
      '0',
    ]

    //// block-by-block simulation

    // simulation data
    const simData = []
    // simulation starting block
    const simStartBlock = await ethers.provider.getBlockNumber()

    // simulation
    for (let i = 0; i < stakesOverTime.length; i++) {
      // owner stakes/unstakes according to stakesOverTime
      if (stakesOverTime[i] !== '0' && stakesOverTime[i][0] !== '-') {
        // approve + stake
        await TestToken.approve(IFStateMaster.address, stakesOverTime[i]) // approve
        await IFStateMaster.stake(0, stakesOverTime[i]) // stake
      } else if (stakesOverTime[i] !== '0' && stakesOverTime[i][0] === '-') {
        // unstake
        await IFStateMaster.unstake(0, stakesOverTime[i].substring(1)) // unstake
      }

      mineNext()

      // current block number
      const currBlock = await ethers.provider.getBlockNumber()

      // user's staked amount
      const nCheckpoints = await IFStateMaster.userCheckpointCounts(
        trackNum,
        owner.address
      )
      const checkpoint = await IFStateMaster.userCheckpoints(
        trackNum,
        owner.address,
        nCheckpoints - 1
      )

      // get current stake
      simData.push({
        block: currBlock,
        userStake: checkpoint.staked,
        userWeight: await IFStateMaster.getUserStakeWeight(
          trackNum,
          owner.address,
          currBlock
        ),
        totalWeight: await IFStateMaster.getTotalStakeWeight(
          trackNum,
          currBlock
        ),
      })
    }

    // print stakeweights
    console.log('Simulation data')
    simData.map(async (row) => {
      console.log(
        'Block',
        (row.block - simStartBlock).toString(),
        '| User stake',
        row.userStake.toString(),
        '| User weight',
        row.userWeight.toString(),
        '| Total weight',
        row.totalWeight.toString()
      )
    })

    // print track checkpoints
    console.log('\nTrack checkpoints')
    const nTrackCheckpoints = await IFStateMaster.trackCheckpointCounts(
      trackNum
    )
    for (let i = 0; i < nTrackCheckpoints; i++) {
      const checkpoint = await IFStateMaster.trackCheckpoints(trackNum, i)
      console.log(
        'Block',
        checkpoint.blockNumber.toString(),
        '| Total staked',
        checkpoint.totalStaked.toString(),
        '| Total stake weight',
        checkpoint.totalStakeWeight.toString()
      )
    }
  })
})
