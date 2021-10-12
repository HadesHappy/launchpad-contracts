import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { mineNext } from './helpers'

export default describe('GenericToken', function () {
  // unset timeout from the test
  this.timeout(0)

  it('sets starting supply', async function () {
    // get owner
    const [owner] = await ethers.getSigners()

    // parameters
    const startingSupply = 21_000_000_000

    // deploy
    const TestTokenFactory = await ethers.getContractFactory('GenericToken')
    const TestToken = await TestTokenFactory.deploy(
      'test token',
      'TEST',
      startingSupply
    )

    // test
    mineNext()
    expect(await TestToken.balanceOf(owner.address)).to.equal(startingSupply)
  })
})
