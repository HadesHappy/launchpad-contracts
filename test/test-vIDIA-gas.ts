import '@nomiclabs/hardhat-ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Contract } from '@ethersproject/contracts'
import { mineNext, getBlockTime, mineTimeDelta } from './helpers'
import { first } from 'lodash'
import { BigNumber } from 'ethers'

const MaxUint256 = ethers.constants.MaxUint256
const WeiPerEth = ethers.constants.WeiPerEther
const _0 = ethers.constants.Zero
const _1 = ethers.constants.One
const _2 = ethers.constants.Two
const _10 = BigNumber.from(10)
const _10000 = BigNumber.from(10000)
const FACTOR = BigNumber.from(_10.pow(BigNumber.from(30)))

const TWO_WEEKS = 14 * 86400

const convToBN = (num: number) => {
  return BigNumber.from(num).mul(WeiPerEth)
}

const checkWithinTolerance = (
  test: BigNumber,
  target: BigNumber,
  tolerance = _10
) => {
  expect(test.add(tolerance).gte(target)).to.eq(
    true,
    `failed gte tolerance, ${test.toString()} and ${target.toString()}`
  )
  expect(test.sub(tolerance).lte(target)).to.eq(
    true,
    `failed lte tolerance, ${test.toString()} and ${target.toString()}`
  )
}

export default describe('vIDIA', async () => {
  let vIDIA: Contract
  let underlying: Contract
  let owner: SignerWithAddress
  let vester: SignerWithAddress
  let vester2: SignerWithAddress

  beforeEach(async () => {
    [owner, vester, vester2] = await ethers.getSigners()
    const vIDIAFactory = await ethers.getContractFactory('vIDIA')
    const TestTokenFactory = await ethers.getContractFactory('GenericToken')
    underlying = await TestTokenFactory.connect(owner).deploy('', '', MaxUint256)
    vIDIA = await vIDIAFactory.deploy('', '', owner.address, underlying.address)

    await underlying.approve(vIDIA.address, MaxUint256)

    await underlying.transfer(vester.address, convToBN(1000))
    await underlying.connect(vester).approve(vIDIA.address, MaxUint256)
    await vIDIA.connect(vester).stake(convToBN(100))
    await underlying.transfer(vester2.address, convToBN(1000))
    await underlying.connect(vester2).approve(vIDIA.address, MaxUint256)
    await vIDIA.connect(vester2).stake(convToBN(100))
  })

  it('test stake gas', async () => {
    const tx = await vIDIA.connect(vester).stake(WeiPerEth)
    expect((await tx.wait()).gasUsed).to.eq(76280) // 84478
  })

  it('test stake/unstake', async () => {
    const tx = await vIDIA.connect(vester).unstake(WeiPerEth)
    expect((await tx.wait()).gasUsed).to.eq(101579) // 119305
  })

  it('test claimstaked', async () => {
    const tx = await vIDIA.connect(vester).claimStaked(WeiPerEth)
    expect((await tx.wait()).gasUsed).to.eq(139789) // 148231
  })

  it('test claimunstaked', async () => {
    await vIDIA.connect(vester).unstake(WeiPerEth)
    await mineTimeDelta((await vIDIA.unstakingDelay()).toNumber())
    const tx = await vIDIA.connect(vester).claimUnstaked()
    expect((await tx.wait()).gasUsed).to.eq(47075) // 48553
  })

  it('test claimpendingunstake', async () => {
    const claimAmount = WeiPerEth

    await vIDIA.connect(vester).unstake(claimAmount)
    const tx = await vIDIA.connect(vester).claimPendingUnstake(claimAmount)
    expect((await tx.wait()).gasUsed).to.eq(122247) // 131595
  })

  it('test cancelpendingunstake', async () => {
    const claimAmount = WeiPerEth

    await vIDIA.connect(vester).unstake(claimAmount)
    const tx = await vIDIA.connect(vester).cancelPendingUnstake(claimAmount)
    expect((await tx.wait()).gasUsed).to.eq(121368) // 139231
  })
  
  it('test rewardclaim', async () => {
    let tx = await vIDIA.connect(vester2).claimReward(vester2.address)
    expect((await tx.wait()).gasUsed, "zero reward").to.eq(28563) // 46162

    await vIDIA.connect(vester).claimStaked(WeiPerEth)
    tx = await vIDIA.connect(vester2).claimReward(vester2.address)
    // +16 gas for the if (reward > 0) condition, but saves 15k gas when theres no reward
    expect((await tx.wait()).gasUsed, "non zero reward").to.eq(69269) // 71662 
  })
})
