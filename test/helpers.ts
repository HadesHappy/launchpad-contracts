import { ethers, network } from 'hardhat'
import fs from 'fs/promises'
import CsvParse from 'csv-parse/lib/sync'
import Papa from 'papaparse'

export const mineNext = async () => {
  await network.provider.send('evm_mine') // mine next (+1 blockheight)
}

export const getGasUsed = async () => {
  // current block number
  const currBlockNum = await ethers.provider.getBlockNumber()

  // current block
  const currBlock = await ethers.provider.getBlock(currBlockNum)

  // gas used
  const gasUsed = currBlock.gasUsed

  return gasUsed
}

export const readFile = async (file: string) => {
  return await fs.readFile(file, 'utf8')
}

export const parseCsv = async (file: string) => {
  // get file content
  const content = await readFile(file)
  // parse csv, return
  const csv = CsvParse(content)
  return csv
}

export const unparseCsv = (json: any) => {
  return Papa.unparse(json, {
    delimiter: ',',
    header: true,
    newline: '\n',
  })
}
