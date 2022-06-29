// Runtime Environment's members available in the global scope.
import hre, { ethers } from 'hardhat'
import IDIAVoucher from '../abi/IDIAVoucher.json'
import BatchMintParams from './inputs/BatchMintParams.json'
import GenericToken from '../artifacts/contracts/GenericToken.sol/GenericToken.json'

const IMPERSONATE_ADDRESS = '0x22b6eb86Dc704E34b4C729cFeab6CaA4F57EfeE7'

export async function main(): Promise<void> {
  // const signer = (await hre.ethers.getSigners())[0]
  const signer = await ethers.getSigner(IMPERSONATE_ADDRESS)
  await hre.network.provider.request({
          method: 'hardhat_impersonateAccount',
          params: [IMPERSONATE_ADDRESS],
  })

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
  await idiaContract.connect(signer).transfer(batchMintContract.address, ethers.constants.WeiPerEther)
  console.log('balance of contract:', await idiaContract.balanceOf(batchMintContract.address))

  // starting token id
  const start = await voucherContract.nextTokenId()
  console.log(start)

  // mint
  await batchMintContract.batchMint(
    BatchMintParams.terms,
    BatchMintParams.values,
    BatchMintParams.maturities,
    BatchMintParams.percentages,
    BatchMintParams.originalInvestors,
  )

  // ending token id
  const end = await voucherContract.nextTokenId()

  // log
  console.log('token ids', start, end)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
