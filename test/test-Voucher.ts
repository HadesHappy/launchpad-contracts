
import '@nomiclabs/hardhat-ethers'
import { ethers, web3 } from 'hardhat'
import { AbiItem } from 'web3-utils'
import hre from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getBlockTime, mineNext } from './helpers'
import { Contract } from '@ethersproject/contracts'
import IDIAVoucher from '../abi/IDIAVoucher.json'
import Multicall from '../abi/Multicall.json'
import GenericToken from '../artifacts/contracts/GenericToken.sol/GenericToken.json'
import { expect } from 'chai'
import { Interface } from '@ethersproject/abi'
import { BytesLike } from 'ethers'

export default describe('Solv Voucher', function () {
  // wallet address
  const MINTER_ADDRESS = '0x22b6eb86Dc704E34b4C729cFeab6CaA4F57EfeE7'
  const ADMIN_ADDRESS = '0x21Bc9179d5c529B52e3EE8f6Ecf0e63FA231d16C'
  const USER_ADDRESS = '0x4b91909484296dfdc302996708cacaec99fda7b8'

  // contract address
  const IDIA_VOUCHER_ADDRESS = '0x039Bb4b13F252597a69fA2e6ad19034E3CCbbF1C'
  const VESTINGPOOL_ADDRESS = '0x67D48Ce0E776147B0d996e1FaCC0FbAA91b1CBC4'
  const PROXY_ADDRESS = '0x0c491ac26d2cdda63667df65b43b967b9293161c'
  const IDIA_ADDRESS = '0x0b15Ddf19D47E6a86A56148fb4aFFFc6929BcB89'
  const MULTICALL_ADDRESS = '0xfF6FD90A470Aaa0c1B8A54681746b07AcdFedc9B'

  // minter and contract instance
  let minter: SignerWithAddress
  let user: SignerWithAddress
  let voucherContract: Contract
  let sourceContract: Contract
  let idiaContract: Contract

  this.timeout(0)
  hre.tracer.enabled = true

  const multicall = async (abi: any[], calls: any[]) => {
    const multicallContract = new web3.eth.Contract((Multicall as unknown) as AbiItem, MULTICALL_ADDRESS)
    const itf = new Interface(abi)
    const calldata = calls.map((call) => [call.address.toLowerCase(), itf.encodeFunctionData(call.name, call.params)])
    const { returnData } = await multicallContract.methods.aggregate(calldata)
    const res = returnData.map((call: BytesLike, i: number) => itf.decodeFunctionResult(calls[i].name, call))
    return res
  }
  
  beforeEach(async () => {
    minter = await ethers.getSigner(MINTER_ADDRESS)
    await hre.network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [MINTER_ADDRESS],
    })
    user = await ethers.getSigner(USER_ADDRESS)
    await hre.network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [USER_ADDRESS],
    })
    idiaContract = new ethers.Contract(IDIA_ADDRESS, GenericToken.abi, minter)
    sourceContract = await (new ethers.Contract(IDIA_VOUCHER_ADDRESS, IDIAVoucher, minter))
    voucherContract = await sourceContract.attach(PROXY_ADDRESS)
  })

  it('can impersonate', async function () {
    const TRANSFER_AMOUNT = ethers.constants.WeiPerEther
    const initialBalance = await idiaContract.balanceOf(ADMIN_ADDRESS)
    await idiaContract.connect(minter).transfer(ADMIN_ADDRESS, TRANSFER_AMOUNT)
    expect(await idiaContract.balanceOf(ADMIN_ADDRESS)).to.be.equals(initialBalance + TRANSFER_AMOUNT)
  })

  it('can mint, transfer, and claim voucher', async function () {
    const voucherValue = ethers.constants.WeiPerEther.mul(10)
    // approve vesting pool to spend max amount
    await idiaContract.connect(minter).approve(VESTINGPOOL_ADDRESS, ethers.constants.MaxUint256)
    // mint a voucher that worths 1 idia
    const tokenId = await voucherContract.nextTokenId()
    await voucherContract.connect(minter).mint(
        0, voucherValue, [1632960000], [10000], ''
    )

    // the minter claims the voucher
    const minterClaimValue = voucherValue.div(10).mul(1)
    expect(await voucherContract.claimableAmount(tokenId)).to.be.equals(voucherValue)
    await voucherContract.connect(minter).claim(tokenId, ethers.constants.WeiPerEther)
    expect(await voucherContract.claimableAmount(tokenId)).to.be.equals(voucherValue.sub(minterClaimValue))

    // the minter transfer the voucher to another address
    const userClaimValue = voucherValue.div(10).mul(2)
    await voucherContract.connect(minter)['safeTransferFrom(address,address,uint256)'](minter.address, user.address, tokenId)
    await voucherContract.connect(user).claim(tokenId, userClaimValue)
    expect(await voucherContract.claimableAmount(tokenId)).to.be.equals(voucherValue.sub(minterClaimValue).sub(userClaimValue))
  })

  it('can batch minting', async function () {
    const voucherValue = ethers.constants.WeiPerEther.mul(10)
    const call = {
        address: PROXY_ADDRESS,
        name: 'mint',
        params: [0, voucherValue, [1632960000], [10000], '']
    }
    const calls = []
    for (let i = 0; i < 1000; i++) {
        calls.push(call)
    }
    console.log(await multicall(IDIAVoucher, calls))
  })
})