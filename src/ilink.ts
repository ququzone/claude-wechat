import type { Credentials, GetUpdatesResponse, SendMessageResponse, BaseInfo } from './types.js'
import { generateClientID, generateWechatUIN, truncate } from './utils.js'

export class ILinkClient {
  private baseURL: string
  private botToken: string
  private botID: string
  private wechatUIN: string

  constructor(creds: Credentials) {
    this.baseURL = creds.baseurl || 'https://ilinkai.weixin.qq.com'
    this.botToken = creds.bot_token
    this.botID = creds.ilink_bot_id
    this.wechatUIN = generateWechatUIN()
  }

  async getUpdates(buf: string): Promise<GetUpdatesResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 40000)

    try {
      const response = await fetch(`${this.baseURL}/ilink/bot/getupdates`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          get_updates_buf: buf,
          base_info: { channel_version: '1.0.0' } as BaseInfo,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // @ts-ignore
      const data: GetUpdatesResponse = await response.json()

      if (data.errcode) {
        throw new Error(`iLink API error: ${data.errmsg || 'Unknown error'} (ret=${data.errcode})`)
      }

      return data

    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout after 40s')
      }
      throw error
    }
  }

  async sendMessage(userID: string, text: string): Promise<void> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot send empty message')
    }

    const response = await fetch(`${this.baseURL}/ilink/bot/sendmessage`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        msg: {
          from_user_id: this.botID,
          to_user_id: userID,
          client_id: generateClientID(),
          message_type: 2,
          message_state: 2,
          item_list: [{ type: 1, text_item: { text: text.trim() } }],
          context_token: '',
        },
        base_info: {} as BaseInfo,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to send message: HTTP ${response.status}`)
    }

    // @ts-ignore
    const data: SendMessageResponse = await response.json()
    if (data.ret !== 0) {
      throw new Error(`Send failed: ${data.errmsg || 'Unknown error'}`)
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'AuthorizationType': 'ilink_bot_token',
      'Authorization': `Bearer ${this.botToken}`,
      'X-WECHAT-UIN': this.wechatUIN,
    }
  }

  getBotID(): string {
    return this.botID
  }
}
