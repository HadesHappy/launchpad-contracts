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
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ONE_ADDRESS = '0x0000000000000000000000000000000000000001'


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
    // Get the ContractFactory and Signers here.
    // Token = await ethers.getContractFactory("Token");
    [owner, vester, vester2] = await ethers.getSigners()

    // To deploy our contract, we just have to call Token.deploy() and await
    // for it to be deployed(), which happens once its transaction has been
    // mined.
    const vIDIAFactory = await ethers.getContractFactory('vIDIA')

    const TestTokenFactory = await ethers.getContractFactory('GenericToken')
    underlying = await TestTokenFactory.connect(owner).deploy(
      'Test Vest Token',
      'Vest',
      MaxUint256
    )
    vIDIA = await vIDIAFactory.deploy(
      'vIDIA contract',
      'VIDIA',
      owner.address,
      underlying.address
    )

    await underlying.transfer(vester.address, convToBN(1000))
    await underlying.approve(vIDIA.address, MaxUint256)
    await underlying.connect(vester).approve(vIDIA.address, MaxUint256)
    await underlying.transfer(vester2.address, convToBN(1000))
    await underlying.approve(vIDIA.address, MaxUint256)
    await underlying.connect(vester2).approve(vIDIA.address, MaxUint256)
  })

  it('test static funcs', async () => {
    expect(await vIDIA.supportsInterface('0xb0202a11')).to.eq(true)
  })

  it('test halt', async () => {
    await expect(vIDIA.connect(vester).halt()).to.be.reverted
    expect(await vIDIA.isHalt()).to.eq(false)

    // test halt functions
    const unhaltedErr = 'Contract is not halted yet'
    await expect(vIDIA.emergencyWithdrawStaked()).to.be.revertedWith(
      unhaltedErr
    )
    await expect(vIDIA.emergencyWithdrawUnstaking()).to.be.revertedWith(
      unhaltedErr
    )

    await vIDIA.halt()
    expect(await vIDIA.isHalt()).to.eq(true)

    // test halted functions
    const haltErr = 'Contract is halted'
    await expect(vIDIA.stake(_0)).to.be.revertedWith(haltErr)
    await expect(vIDIA.unstake(_0)).to.be.revertedWith(haltErr)
    await expect(vIDIA.claimUnstaked()).to.be.revertedWith(haltErr)
    await expect(vIDIA.claimStaked(_0)).to.be.revertedWith(haltErr)
    await expect(vIDIA.claimPendingUnstake(_0)).to.be.revertedWith(haltErr)
    await expect(vIDIA.cancelPendingUnstake(_0)).to.be.revertedWith(haltErr)

    // unhalted functions
    expect(await vIDIA.emergencyWithdrawStaked())
      .to.emit(underlying, 'Transfer')
      .withArgs(vIDIA.address, owner.address, _0)
    expect(await vIDIA.emergencyWithdrawUnstaking())
      .to.emit(underlying, 'Transfer')
      .withArgs(vIDIA.address, owner.address, _0)
  })

  it('test emergency withdraw other tokens', async () => {
    const transferAmt = convToBN(100)
    const TestTokenFactory = await ethers.getContractFactory('GenericToken')
    const randomToken = await TestTokenFactory.connect(owner).deploy(
      'randomToken',
      'RT',
      transferAmt
    )
    await randomToken.transfer(vIDIA.address, transferAmt)
    expect(await randomToken.balanceOf(vIDIA.address)).to.eq(transferAmt)
    expect(
      await vIDIA.emergencyWithdrawOtherTokens(
        randomToken.address,
        owner.address
      )
    )
      .to.emit(randomToken, 'Transfer')
      .withArgs(vIDIA.address, owner.address, transferAmt)
  })

  it('test setters', async () => {
    const value = [0, 100, 200, 300]
    const fns = [
      { set: vIDIA.updateSkipDelayFee, get: vIDIA.skipDelayFee },
      { set: vIDIA.updateCancelUnstakeFee, get: vIDIA.cancelUnstakeFee },
      { set: vIDIA.updateUnstakingDelay, get: vIDIA.unstakingDelay },
    ]

    for (let i = 0; i < fns.length; i++) {
      for (let j = 0; j < value.length; j++) {
        await fns[i].set(value[j])
        expect(await fns[i].get()).to.eq(value[j])
      }

      if (i !== 2)
        // fee setters should throw when setting >100%
        await expect(fns[i].set(5001)).to.be.revertedWith(
          'Fee must be less than 50%'
        )
    }
  })

  it('test stake tokens', async () => {
    const stakeAmt = [100, 250]

    for (let i = 0; i < stakeAmt.length; i++) {
      await vIDIA.connect(vester).stake(stakeAmt[i])
      expect((await vIDIA.totalStakedAmt()).toNumber()).to.eq(
        stakeAmt.reduce((prev, curr, idx) => (idx <= i ? prev + curr : prev))
      )
    }
  })

  it('test stake/unstake', async () => {
    const firstStakeAmt = 100
    const secondStakeAmt = 250 // TODO: format same as prev
    await vIDIA.connect(vester).stake(firstStakeAmt)
    let totalStaked = (await vIDIA.totalStakedAmt()).toNumber()
    expect(totalStaked).to.eq(firstStakeAmt)

    await vIDIA.connect(vester).stake(secondStakeAmt)
    totalStaked = (await vIDIA.totalStakedAmt()).toNumber()
    expect(totalStaked).to.eq(firstStakeAmt + secondStakeAmt)
    await vIDIA.connect(vester).unstake(secondStakeAmt)
    let userData = await vIDIA.userInfo(vester.address)
    expect(userData.unstakingAmt).to.eq(secondStakeAmt)
    const unstakeTime =
      (await getBlockTime()) + (await vIDIA.unstakingDelay()).toNumber()
    expect(userData.unstakeAt).to.eq(unstakeTime)
    await expect(
      vIDIA.connect(vester).unstake(firstStakeAmt)
    ).to.be.revertedWith('User has pending tokens unstaking')

    // test claimUnstaked
    await mineTimeDelta((await vIDIA.unstakingDelay()).toNumber())
    const preUnstake = await underlying.balanceOf(vester.address)
    await vIDIA.connect(vester).claimUnstaked()
    expect((await underlying.balanceOf(vester.address)).toString()).to.eq(
      preUnstake.add(BigNumber.from(secondStakeAmt))
    )
    userData = await vIDIA.userInfo(vester.address)
    expect(userData.unstakeAt).to.eq(0)
    expect(userData.unstakingAmt).to.eq(0)
  })

  it('test whitelist feature', async () => {
    await vIDIA.stake(WeiPerEth)
    await vIDIA.approve(vester.address, MaxUint256)
    await vIDIA.approve(vester2.address, MaxUint256)

    const checkFailure = async (s: SignerWithAddress) => {
      await expect(vIDIA.transfer(s.address, _1)).to.be.revertedWith(
        'Origin and dest address not in whitelist'
      )
      await expect(
        vIDIA.connect(s).transferFrom(owner.address, s.address, _1)
      ).to.be.revertedWith('Origin and dest address not in whitelist')
    }

    const checkSuccess = async (s: SignerWithAddress) => {
      await expect(vIDIA.transfer(s.address, _1))
        .to.emit(vIDIA, 'Transfer')
        .withArgs(owner.address, s.address, _1)
      await expect(vIDIA.connect(s).transferFrom(owner.address, s.address, _1))
        .to.emit(vIDIA, 'Transfer')
        .withArgs(owner.address, s.address, _1)
      await expect(vIDIA.connect(s).transfer(owner.address, _2))
        .to.emit(vIDIA, 'Transfer')
        .withArgs(s.address, owner.address, _2)
    }

    const checkWhitelist = async (addrArr: string[]) => {
      expect(JSON.stringify(await vIDIA.getAllWhitelistedAddrs())).to.eq(
        JSON.stringify(addrArr)
      )
    }

    // case 1: no whitelist, should fail transfer
    await checkWhitelist([ZERO_ADDRESS])
    await checkFailure(vester)
    await checkFailure(vester2)

    // case 2: source addr in whitelist, should not fail xfer
    await vIDIA.addToWhitelist(vester.address)
    await checkWhitelist([ZERO_ADDRESS, vester.address])
    await checkSuccess(vester)
    await checkFailure(vester2)

    // case 3: source addr and dest addr in whitelist, should not fail xfer
    await vIDIA.addToWhitelist(vester2.address)
    await checkWhitelist([ZERO_ADDRESS, vester.address, vester2.address])
    await checkSuccess(vester)
    await checkSuccess(vester2)

    // case 4: dest addr in whitelist, should not fail xfer
    await vIDIA.removeFromWhitelist(vester.address)
    await checkWhitelist([ZERO_ADDRESS, vester2.address])
    await checkFailure(vester)
    await checkSuccess(vester2)

    // case 5: remove all addr from whitelist, should fail xfer
    await vIDIA.removeFromWhitelist(vester2.address)
    await checkWhitelist([ZERO_ADDRESS])
    await checkFailure(vester)
    await checkFailure(vester2)
  })

  it('test claimstaked', async () => {
    const ownerStakeAmt = convToBN(200)
    const rewarderStakeAmt = convToBN(1)
    await vIDIA.stake(ownerStakeAmt)
    await vIDIA.connect(vester).stake(rewarderStakeAmt)

    const withdrawAmt = [convToBN(1), convToBN(12), convToBN(0), convToBN(123)]

    let userVidiaBalance = await vIDIA.balanceOf(owner.address)
    let userUnderlying = await underlying.balanceOf(owner.address)
    let contractUnderlying = await underlying.balanceOf(vIDIA.address)
    let sumFees = await vIDIA.accumulatedFee()

    for (let i = 0; i < withdrawAmt.length; i++) {
      const fee = (await vIDIA.skipDelayFee()).mul(withdrawAmt[i]).div(_10000) // 10000 basis pts = 100%
      const receiveAmt = withdrawAmt[i].sub(fee)

      const newRewardPerShare = (await vIDIA.rewardPerShare()).add(
        fee.mul(FACTOR).div(rewarderStakeAmt)
      )

      const reward = rewarderStakeAmt
        .mul(
          newRewardPerShare.sub(
            (await vIDIA.userInfo(vester.address)).lastRewardPerShare
          )
        )
        .div(FACTOR)

      expect(await vIDIA.claimStaked(withdrawAmt[i]))
        .to.emit(vIDIA, 'ClaimStaked')
        .withArgs(owner.address, fee, receiveAmt)
        .to.emit(underlying, 'Transfer')
        .withArgs(vIDIA.address, owner.address, receiveAmt)

      expect(await vIDIA.calculateUserReward(owner.address)).to.eq(_0) // fees should never accrue to fee payer

      // these are the state changes every loop
      sumFees = sumFees.add(fee)
      expect(await vIDIA.accumulatedFee()).to.equal(sumFees)
      expect(await vIDIA.calculateUserReward(vester.address)).to.eq(sumFees) // all fees to vester
      checkWithinTolerance(reward, sumFees) // default tolerance = 10wei

      userVidiaBalance = userVidiaBalance.sub(withdrawAmt[i])
      expect(await vIDIA.balanceOf(owner.address)).to.equal(userVidiaBalance)

      userUnderlying = userUnderlying.add(receiveAmt)
      expect(await underlying.balanceOf(owner.address)).to.equal(userUnderlying)

      contractUnderlying = contractUnderlying.sub(receiveAmt)
      expect(await underlying.balanceOf(vIDIA.address)).to.equal(
        contractUnderlying
      )
    }
  })

  it('test claimpendingunstake with pending unstake', async () => {
    const ownerStakeAmt = convToBN(200)
    const rewarderStakeAmt = convToBN(1)
    await vIDIA.stake(ownerStakeAmt)
    await vIDIA.connect(vester).stake(rewarderStakeAmt)
    await vIDIA.unstake(ownerStakeAmt.sub(rewarderStakeAmt))

    // sums up to stakeAmt-1 for LOC coverage
    const withdrawAmt = [
      convToBN(1),
      convToBN(6),
      convToBN(0),
      convToBN(99),
      convToBN(93),
    ]

    let userVidiaBalance = await vIDIA.balanceOf(owner.address)
    let userUnderlying = await underlying.balanceOf(owner.address)
    let userStakedAmt = (await vIDIA.userInfo(owner.address)).stakedAmt
    let userUnstakingAmt = (await vIDIA.userInfo(owner.address)).unstakingAmt
    let contractUnderlying = await underlying.balanceOf(vIDIA.address)
    let sumFees = await vIDIA.accumulatedFee()

    for (let i = 0; i < withdrawAmt.length; i++) {
      const fee = (await vIDIA.skipDelayFee()).mul(withdrawAmt[i]).div(_10000) // 10000 basis pts = 100%
      const receiveAmt = withdrawAmt[i].sub(fee)

      const newRewardPerShare = (await vIDIA.rewardPerShare()).add(
        fee.mul(FACTOR).div(rewarderStakeAmt)
      )

      const reward = rewarderStakeAmt
        .mul(
          newRewardPerShare.sub(
            (await vIDIA.userInfo(vester.address)).lastRewardPerShare
          )
        )
        .div(FACTOR)

      expect(await vIDIA.claimPendingUnstake(withdrawAmt[i]))
        .to.emit(vIDIA, 'ClaimPendingUnstake')
        .withArgs(owner.address, fee, receiveAmt)
        .to.emit(underlying, 'Transfer')
        .withArgs(vIDIA.address, owner.address, receiveAmt)

      // no change
      expect(await vIDIA.calculateUserReward(owner.address)).to.eq(_0) // fees should never accrue to fee payer
      expect(await vIDIA.balanceOf(owner.address)).to.equal(userVidiaBalance)

      sumFees = sumFees.add(fee)
      expect(await vIDIA.accumulatedFee()).to.equal(sumFees)
      expect(await vIDIA.calculateUserReward(vester.address)).to.eq(sumFees) // all fees to vester
      checkWithinTolerance(reward, sumFees) // default tolerance = 10wei

      userUnderlying = userUnderlying.add(receiveAmt)
      expect(await underlying.balanceOf(owner.address)).to.equal(userUnderlying)

      userUnstakingAmt = userUnstakingAmt.sub(withdrawAmt[i])
      expect((await vIDIA.userInfo(owner.address)).unstakingAmt).to.equal(
        userUnstakingAmt
      )

      contractUnderlying = contractUnderlying.sub(receiveAmt)
      expect(await underlying.balanceOf(vIDIA.address)).to.equal(
        contractUnderlying
      )
    }

    // test failure mode
    await mineTimeDelta((await vIDIA.unstakingDelay()).toNumber())
    await expect(vIDIA.claimPendingUnstake(0)).to.be.revertedWith(
      'Can unstake without paying fee'
    )
  })

  it('test cancelpendingunstake with pending unstake', async () => {
    const ownerStakeAmt = convToBN(200)
    const rewarderStakeAmt = convToBN(1)
    await vIDIA.stake(ownerStakeAmt)
    await vIDIA.connect(vester).stake(rewarderStakeAmt)
    await vIDIA.unstake(ownerStakeAmt.sub(rewarderStakeAmt))

    // sums up to stakeAmt-1 for LOC coverage
    const withdrawAmt = [
      convToBN(1),
      convToBN(6),
      convToBN(0),
      convToBN(99),
      convToBN(93),
    ]

    let userVidiaBalance = await vIDIA.balanceOf(owner.address)
    let userUnderlying = await underlying.balanceOf(owner.address)
    let userUnstakingAmt = (await vIDIA.userInfo(owner.address)).unstakingAmt
    let userStakedAmt = (await vIDIA.userInfo(owner.address)).stakedAmt
    let contractUnderlying = await underlying.balanceOf(vIDIA.address)
    let sumFees = await vIDIA.accumulatedFee()

    for (let i = 0; i < withdrawAmt.length; i++) {
      const fee = (await vIDIA.cancelUnstakeFee())
        .mul(withdrawAmt[i])
        .div(_10000) // 10000 basis pts = 100%
      const receiveAmt = withdrawAmt[i].sub(fee)

      const newRewardPerShare = (await vIDIA.rewardPerShare()).add(
        fee.mul(FACTOR).div(rewarderStakeAmt)
      )

      const reward = rewarderStakeAmt
        .mul(
          newRewardPerShare.sub(
            (await vIDIA.userInfo(vester.address)).lastRewardPerShare
          )
        )
        .div(FACTOR)

      expect(await vIDIA.cancelPendingUnstake(withdrawAmt[i]))
        .to.emit(vIDIA, 'CancelPendingUnstake')
        .withArgs(owner.address, fee, receiveAmt)

      expect(await vIDIA.calculateUserReward(owner.address)).to.eq(_0) // fees should never accrue to fee payer

      sumFees = sumFees.add(fee)
      expect(await vIDIA.accumulatedFee()).to.equal(sumFees)
      expect(await vIDIA.calculateUserReward(vester.address)).to.eq(sumFees) // all fees to vester
      checkWithinTolerance(reward, sumFees) // default tolerance = 10wei

      // no change
      expect(await underlying.balanceOf(owner.address)) // full fee since owner owns 100% of totalstaked
        .to.equal(userUnderlying)
      expect(await underlying.balanceOf(vIDIA.address)) // full fee sent out since its all owner
        .to.equal(contractUnderlying)

      userVidiaBalance = userVidiaBalance.add(receiveAmt)
      expect(await vIDIA.balanceOf(owner.address)) // receives receiveAmt which is amt - fee
        .to.equal(userVidiaBalance)

      userUnstakingAmt = userUnstakingAmt.sub(withdrawAmt[i])
      expect((await vIDIA.userInfo(owner.address)).unstakingAmt) // reduce unstakedAmt by amt
        .to.equal(userUnstakingAmt)

      userStakedAmt = userStakedAmt.add(receiveAmt)
      expect((await vIDIA.userInfo(owner.address)).stakedAmt) // inc stakedAmt by receiveAmt
        .to.equal(userStakedAmt)
    }

    // test failure mode
    await mineTimeDelta((await vIDIA.unstakingDelay()).toNumber())
    await expect(vIDIA.cancelPendingUnstake(0)).to.be.revertedWith(
      'Can restake without paying fee'
    )
  })

  it('test late staker claim reward', async () => {
    const ownerStakeAmt = convToBN(200)
    const stakeAmtA = convToBN(50)
    const stakeAmtB = convToBN(50)
    await vIDIA.stake(ownerStakeAmt)
    await vIDIA.connect(vester).stake(stakeAmtA)
    await vIDIA.claimStaked(ownerStakeAmt.div(2))

    await vIDIA.connect(vester2).stake(stakeAmtB)
    await vIDIA.claimStaked(ownerStakeAmt.div(2))

    // all reward goes to vester
    const rewardFirst = ownerStakeAmt.div(2).mul(20).div(100)
    // reward is shared by both vester and vester2
    const rewardSecond = ownerStakeAmt.div(2).mul(20).div(100).div(2)
    expect(await vIDIA.calculateUserReward(vester.address)).to.equal(rewardFirst.add(rewardSecond))
    expect(await vIDIA.calculateUserReward(vester2.address)).to.equal(rewardSecond)
  })
  
  it('test padding zero admin and underlying address', async () => {
    console.log(owner.address)
    const VIDIAFactory = await ethers.getContractFactory('vIDIA')
    expect(VIDIAFactory.deploy(
      'VIDIA','VIDIA',ZERO_ADDRESS, ZERO_ADDRESS,
    )).to.be.revertedWith('Admin address must not be zero')
    expect(VIDIAFactory.deploy(
      'VIDIA', 'VIDIA', owner.address, ZERO_ADDRESS,
    )).to.be.revertedWith('Underlying address must not be zero')
    expect((await VIDIAFactory.deploy(
      'VIDIA', 'VIDIA', owner.address, ONE_ADDRESS,
    ))).to.exist
  })
})
