import type { Credentials, QRCodeResponse, QRStatusResponse } from './types.js'
import { saveCredentials, credentialsExist } from './credentials.js'
import { sleep } from './utils.js'

export async function login(): Promise<Credentials> {
  // 1. Fetch QR code
  console.log('Fetching QR code...')
  const qrResp = await fetch('https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode')
  if (!qrResp.ok) {
    throw new Error('Failed to fetch QR code')
  }

  const qrData: QRCodeResponse = await qrResp.json()

  console.log('\nScan this QR code with WeChat:')
  console.log('────────────────────────────────────')
  console.log(qrData.qrcode_img_content)
  console.log('────────────────────────────────────')
  console.log(`\nQR URL: ${qrData.qrcode}`)
  console.log('\nWaiting for scan...')

  // 2. Poll login status
  let lastStatus = ''
  let attempts = 0
  const MAX_ATTEMPTS = 60 // 2 minutes

  while (attempts < MAX_ATTEMPTS) {
    const statusResp = await fetch(
      `https://ilinkai.weixin.qq.com/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrData.qrcode)}`
    )

    if (!statusResp.ok) {
      throw new Error('Failed to check QR status')
    }

    const status: QRStatusResponse = await statusResp.json()

    if (status.status !== lastStatus) {
      lastStatus = status.status
      if (status.status === 'scaned') {
        console.log('QR code scanned! Please confirm on your phone.')
      } else if (status.status === 'confirmed') {
        console.log('Login confirmed!')
      } else if (status.status === 'expired') {
        throw new Error('QR code expired. Please run again.')
      }
    }

    if (status.status === 'confirmed' && status.bot_token && status.ilink_bot_id) {
      const creds: Credentials = {
        bot_token: status.bot_token,
        ilink_bot_id: status.ilink_bot_id,
        baseurl: status.baseurl,
        ilink_user_id: status.ilink_user_id || '',
      }
      await saveCredentials(creds)
      console.log(`\nBot ID: ${creds.ilink_bot_id}`)
      return creds
    }

    await sleep(2000)
    attempts++
  }

  throw new Error('Login timeout. Please try again.')
}

export async function ensureCredentials(): Promise<Credentials> {
  if (await credentialsExist()) {
    const { loadCredentials } = await import('./credentials.js')
    return loadCredentials()
  }
  console.log('No credentials found. Starting login flow...')
  return login()
}
