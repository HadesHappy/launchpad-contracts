import '@nomiclabs/hardhat-ethers'
import { ethers, network } from 'hardhat'
import { expect } from 'chai'

export default describe('IFStateMaster', function () {
  it('adds tracks', async function () {
    // get owner
    const [owner] = await ethers.getSigners()

    // deploy a test token
    const TestTokenFactory = await ethers.getContractFactory('TestToken')
    const TestToken = await TestTokenFactory.deploy(
      'test token',
      'TEST',
      '21000000000000000000000000' // 21 million * 10**18
    )

    // deploy statemaster
    const IFStateMasterFactory = await ethers.getContractFactory(
      'IFStateMaster'
    )
    const IFStateMaster = await IFStateMasterFactory.deploy()

    // test

    // array of stakeweights over time
    const stakeWeights = []

    // num tracks should be 0
    expect(await IFStateMaster.trackCount()).to.equal(0)

    // add a track
    await IFStateMaster.addTrack('TEST Track', TestToken.address, 1000)

    // num tracks should be 1
    expect(await IFStateMaster.trackCount()).to.equal(1)

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
    stakeWeights.map(async (stakeWeight) => {
      console.log(
        stakeWeight.block,
        stakeWeight.userWeight.toString(),
        stakeWeight.totalWeight.toString()
      )
    })
  })
})
