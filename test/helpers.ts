import { ethers, network } from 'hardhat'
import fs from 'fs/promises'
import CsvParse from 'csv-parse/lib/sync'
import Papa from 'papaparse'
import asyncFs from 'fs/promises'
import { BigNumber } from '@ethersproject/bignumber'

export const mineNext = async (): Promise<void> => {
  await network.provider.send('evm_mine') // mine next (+1 blockheight)
}

export const mineTimeDelta = async (seconds: number): Promise<void> => {
  await network.provider.send('evm_increaseTime', [seconds])
  await network.provider.send('evm_mine')
}

export const getGasUsed = async (): Promise<BigNumber> => {
  // current block number
  const currBlockNum = await ethers.provider.getBlockNumber()

  // current block
  const currBlock = await ethers.provider.getBlock(currBlockNum)

  // gas used
  const gasUsed = currBlock.gasUsed

  return gasUsed
}

export const getBlockTime = async (): Promise<number> => {
  // current block number
  const currBlockNum = await ethers.provider.getBlockNumber()

  // current timestamp at block
  const currTime = (await ethers.provider.getBlock(currBlockNum)).timestamp

  return currTime
}

export const readFile = async (file: string): Promise<string> => {
  return await fs.readFile(file, 'utf8')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseCsv = async (file: string): Promise<any> => {
  // get file content
  const content = await readFile(file)
  // parse csv, return
  const csv = CsvParse(content)
  return csv
}

export const unparseCsv = (json: any): string => {
  return Papa.unparse(json, {
    delimiter: ',',
    header: true,
    newline: '\n',
  })
}

// write file
export const asyncWriteFile = async (
  filePath: string,
  fileName: string,
  content: string
): Promise<void> => {
  // create directory if doesn't exist
  await asyncFs.mkdir(filePath, { recursive: true })

  // write file
  return asyncFs.writeFile(`${filePath}/${fileName}`, content)
}
