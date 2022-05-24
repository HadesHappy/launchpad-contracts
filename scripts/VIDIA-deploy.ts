// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat'

export async function main(): Promise<void> {
  // We get the contract to deploy
  console.log(hre.network.name);
  const VIDIAFactory = await hre.ethers.getContractFactory('vIDIA')
  
  // TODO: change the below params before deploying to mainnet
  const VIDIA = await VIDIAFactory.deploy(
    "June IDIA",
    "JIDIA",
    "0x6f981a30263A43E0D060D2033C9F0C6A318572fc",
    "0x44AB9E98FF201f468Fe4687b2FB5247b5BD0fc5a",
  )

  console.log('VIDIA deployed to ', VIDIA.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
