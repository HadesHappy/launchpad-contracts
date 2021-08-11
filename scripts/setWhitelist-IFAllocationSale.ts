// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre: HardhatRuntimeEnvironment = require('hardhat')

import fs from 'fs'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import IFAllocationSale from '../artifacts/contracts/IFAllocationSale.sol/IFAllocationSale.json'
import { computeMerkleRoot } from '../library/merkleWhitelist'

export async function main() {
  // allocation sale params
  let allocationSale: string = process.env.SALE || '' // address
  let whitelist: string[] = [] // whitelisted addresses array

  // get whitelist
  if (process.env.WHITELIST && process.env.WHITELIST_JSON_FILE) {
    console.log('Can only set either whitelist or whitelistJson')
  } else if (process.env.WHITELIST) {
    // set whitelist
    whitelist = process.env.WHITELIST?.split(',').filter((a) => a !== '') || []
  } else if (process.env.WHITELIST_JSON_FILE) {
    // read file
    const contents = fs.readFileSync(process.env.WHITELIST_JSON_FILE, 'utf8')
    // parse contents
    let parsed
    try {
      parsed = JSON.parse(contents)
    } catch (e) {
      console.log('Could not parse whitelist JSON file')
      return
    }
    // set whitelist
    whitelist = parsed
  } else {
    console.log('No whitelist specified')
  }

  // get allocationSale contract
  let allocationSaleContract = new hre.ethers.Contract(
    allocationSale,
    IFAllocationSale.abi
  )

  // sort whitelisted addresses
  whitelist = whitelist.map((s) => s.toLowerCase()).sort()

  // get merkle root
  const merkleRoot = computeMerkleRoot(whitelist)

  // add whitelist merkleroot to sale
  const result = await allocationSaleContract
    .connect((await hre.ethers.getSigners())[0])
    .setWhitelist(merkleRoot)

  // wait for tx to be mined
  await result.wait()

  // log
  console.log('Sale:', allocationSale)
  console.log('Whitelist:', whitelist)
  console.log('New merkle root:', merkleRoot)
  console.log('---- Output ----')
  console.log('Tx hash:', result.hash)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
