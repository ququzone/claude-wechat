import type { Credentials } from './types.js'
import { mkdir, writeFile, readFile, access } from 'fs/promises'
import { dirname, homedir } from 'path'
import { existsSync } from 'fs'

const CREDENTIALS_PATH = `${homedir()}/.wechat-channel/credentials.json`

export async function loadCredentials(): Promise<Credentials> {
  const data = await readFile(CREDENTIALS_PATH, 'utf-8')
  return JSON.parse(data)
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  const dir = dirname(CREDENTIALS_PATH)
  await mkdir(dir, { recursive: true })
  await writeFile(CREDENTIALS_PATH, JSON.stringify(creds, null, 2))
  console.log(`Credentials saved to ${CREDENTIALS_PATH}`)
}

export async function credentialsExist(): Promise<boolean> {
  try {
    await access(CREDENTIALS_PATH)
    return true
  } catch {
    return false
  }
}

export function getCredentialPath(): string {
  return CREDENTIALS_PATH
}
