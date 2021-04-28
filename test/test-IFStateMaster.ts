import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
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

    // num tracks should be 0
    expect(await IFStateMaster.trackCount()).to.equal(0)

    // add a track
    await IFStateMaster.addTrack('TEST Track', TestToken.address, 1)

    // num tracks should be 1
    expect(await IFStateMaster.trackCount()).to.equal(1)
  })
})
