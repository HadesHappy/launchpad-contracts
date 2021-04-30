import '@nomiclabs/hardhat-ethers'
import { ethers, network } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from '@ethersproject/contracts'

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

  it('counts tracks', async () => {
    // num tracks should be 0
    expect(await IFStateMaster.trackCount()).to.equal(0)

    // add a track
    await IFStateMaster.addTrack('TEST Track', TestToken.address, 1000)

    // num tracks should be 1
    expect(await IFStateMaster.trackCount()).to.equal(1)
  })

  it('accrues stake weight', async () => {
    // add a track
    await IFStateMaster.addTrack('TEST Track', TestToken.address, 1000)

    // array of stakeweights over time
    const stakeWeights = []

    // how much to stake on a block-by-block basis
    const stakesOverTime = [
      '1000000000000000000', // 1 token
      '0',
      '0',
      '0',
      '0',
      '50000000000000000000', // 50 tokens
      '0',
      '0',
      '-50000000000000000000', // -50 tokens
      '0',
      '0',
      '2500000000000000000', // 2.5 tokens
      '0',
      '0',
      '0',
    ]

    // get stake weight over time
    for (let i = 0; i < stakesOverTime.length; i++) {
      // owner stakes according to stakesOverTime
      if (stakesOverTime[i] !== '0' && stakesOverTime[i][0] !== '-') {
        // stake
        await TestToken.approve(IFStateMaster.address, stakesOverTime[i]) // approve
        await IFStateMaster.stake(0, stakesOverTime[i]) // stake
      } else if (stakesOverTime[i] !== '0' && stakesOverTime[i][0] === '-') {
        // unstake
        await IFStateMaster.unstake(0, stakesOverTime[i].substring(1)) // unstake
      } else {
        // mine block
        await network.provider.send('evm_mine') // +1 blockheight
      }

      // current block number
      const currBlock = await ethers.provider.getBlockNumber()

      // get current stake
      stakeWeights.push({
        block: currBlock,
        userWeight: await IFStateMaster.getUserStakeWeight(
          0,
          owner.address,
          currBlock
        ),
        totalWeight: await IFStateMaster.getTotalStakeWeight(0, currBlock),
      })
    }

    // print stakeweights
    console.log('printing stakeweights')
    stakeWeights.map(async (stakeWeight) => {
      console.log(
        stakeWeight.block,
        stakeWeight.userWeight.toString(),
        stakeWeight.totalWeight.toString()
      )
    })

    // print track checkpoints
    console.log('printing checkpoints (block no, staked, stakeweight)')
    const nTrackCheckpoints = await IFStateMaster.trackCheckpointCounts(0)
    for (let i = 0; i < nTrackCheckpoints; i++) {
      const checkpoint = await IFStateMaster.trackCheckpoints(0, i)
      console.log(checkpoint.toString())
    }
  })
})
