import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'

export default describe('IFStateMaster', function () {
  it('counts tracks', async function () {
    // get owner
    const [owner] = await ethers.getSigners()

    // deploy a test token
    const TestTokenFactory = await ethers.getContractFactory('TestToken')
    const TestToken = await TestTokenFactory.deploy(
      'test token',
      'TEST',
      21_000_000_000
    )

    // deploy statemaster
    const IFStateMasterFactory = await ethers.getContractFactory('IFStateMaster')
    const IFStateMaster = await IFStateMasterFactory.deploy()

    // test

    // num tracks should be 0
    expect(await IFStateMaster.trackCount()).to.equal(0)

    // add a track
    await IFStateMaster.addTrack(TestToken.address)

    // num tracks should be 1
    expect(await IFStateMaster.trackCount()).to.equal(1)
  })
})
