// Runtime Environment's members available in the global scope.
import hre, { ethers } from 'hardhat'
import IDIAVoucher from '../abi/IDIAVoucher.json'
import BatchMintParams from './inputs/BatchMintParams.json'
import GenericToken from '../artifacts/contracts/GenericToken.sol/GenericToken.json'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from '@ethersproject/bignumber'
import { assert } from 'console'

// for local testing propose
const IMPERSONATE_ADDRESS = '0x22b6eb86Dc704E34b4C729cFeab6CaA4F57EfeE7'

export async function main(): Promise<void> {
  // get vouchers params
  const vouchers = BatchMintParams.vouchers

  let signer: SignerWithAddress

  // initialize an impersonated account if it is running on local network
  if (hre.network.name === 'hardhat') {
    signer = await ethers.getSigner(IMPERSONATE_ADDRESS)
    await hre.network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [IMPERSONATE_ADDRESS],
    })
  } else {
    // get signer address from hardhat config
    signer = (await hre.ethers.getSigners())[0]
  }

  // get contract
  const batchMintContract = await (await hre.ethers.getContractFactory('BatchMintVoucher')).deploy(
    BatchMintParams.proxyAddress,
    BatchMintParams.idiaAddress,
    BatchMintParams.vestingPoolAddress,
  )
  const idiaContract = new ethers.Contract(BatchMintParams.idiaAddress, GenericToken.abi, signer)
  const sourceContract = await (new ethers.Contract(BatchMintParams.idiaVoucherAddress, IDIAVoucher, signer))
  const voucherContract = await sourceContract.attach(BatchMintParams.proxyAddress)

  // Send token
  const totalValue = vouchers.reduce((acc, voucher) => { 
    return acc.add(BigNumber.from(voucher.value)) }, BigNumber.from(0)
  )
  console.log('Total value to send:', totalValue.toNumber())
  await idiaContract.connect(signer).transfer(
    batchMintContract.address, 
    totalValue,
  )
  console.log('Balance of contract:', (await idiaContract.balanceOf(batchMintContract.address)).toNumber())
  assert(BigNumber.from((await idiaContract.balanceOf(batchMintContract.address))).gte(totalValue), 'Not enough balance')

  // start token id
  const start = (await voucherContract.nextTokenId()).toNumber()
  console.log('Start minting from token id:', start)

  // mint
  await batchMintContract.batchMint(
    vouchers.map((voucher) => voucher.address),
    vouchers.map((voucher) => voucher.term),
    vouchers.map((voucher) => voucher.value),
    vouchers.map((voucher) => voucher.maturities),
    vouchers.map((voucher) => voucher.percentages),
    vouchers.map((voucher) => voucher.originalInvestor),
  )

  // end token id
  const end = (await voucherContract.nextTokenId()).toNumber()

  // log
  console.log(`minted and transfered token from id ${start} to ${end}`)
  console.log('Balance of contract:', (await idiaContract.balanceOf(batchMintContract.address)).toNumber())

  // check if all vouchers are sent properly
  vouchers.forEach(async (voucher, i) => {
    assert((await voucherContract.ownerOf(start + i)) === voucher.address, `Voucher ${start + i} is not owned by ${voucher.address}`)
  })
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
