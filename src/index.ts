#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { ILinkClient } from './ilink.js'
import { ensureCredentials } from './auth.js'
import { extractText, truncate } from './utils.js'
import { MessageState, type WeixinMessage, MessageType } from './types.js'

// Create MCP Server and declare as Channel
const mcp = new Server(
  { name: 'wechat', version: '0.0.1' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions: `WeChat messages arrive as <channel source="wechat" chat_id="..." context_token="...">.
Reply using the reply tool with chat_id and text parameters.
Messages are from WeChat users - respond in a friendly, helpful tone.`,
  },
)

// Register reply tool
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'reply',
    description: 'Send a message back to WeChat',
    inputSchema: {
      type: 'object',
      properties: {
        chat_id: { type: 'string', description: 'WeChat user ID to reply to' },
        text: { type: 'string', description: 'Message content to send' },
      },
      required: ['chat_id', 'text'],
    },
  }],
}))

// Global reference for reply tool
let ilinkClient: ILinkClient

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === 'reply') {
    const { chat_id, text } = req.params.arguments as { chat_id: string; text: string }
    console.log(`[wechat] Sending reply to ${chat_id}: ${truncate(text, 50)}`)
    await ilinkClient.sendMessage(chat_id, text)
    return { content: [{ type: 'text', text: 'sent' }] }
  }
  throw new Error(`unknown tool: ${req.params.name}`)
})

// Connect via stdio
await mcp.connect(new StdioServerTransport())
console.error('[wechat] MCP Server connected via stdio')

// Load credentials
const creds = await ensureCredentials()
ilinkClient = new ILinkClient(creds)
console.error(`[wechat] Connected to bot ${ilinkClient.getBotID()}`)

// Message polling loop
async function runMessageLoop() {
  let updateBuf = ''
  let retryCount = 0
  const MAX_RETRIES = 5
  const BASE_DELAY = 3000

  while (true) {
    try {
      const response = await ilinkClient.getUpdates(updateBuf)

      // Reset retry count on success
      retryCount = 0
      updateBuf = response.get_updates_buf || ''

      for (const msg of response.msgs || []) {
        await processMessage(msg)
      }

    } catch (error) {
      retryCount++

      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`[wechat] Network error (attempt ${retryCount}/${MAX_RETRIES}):`, error.message)
      } else {
        console.error('[wechat] Unexpected error:', error)
      }

      // Exponential backoff
      const delay = BASE_DELAY * Math.pow(2, Math.min(retryCount - 1, 5))
      await sleep(delay)

      // Reset buffer after connection loss
      if (retryCount >= 3) {
        console.log('[wechat] Resetting update buffer after retries')
        updateBuf = ''
      }

      // Give up after max retries
      if (retryCount >= MAX_RETRIES) {
        console.error('[wechat] Max retries exceeded. Please check network and restart.')
        throw error
      }
    }
  }
}

async function processMessage(msg: WeixinMessage) {
  // Only process user messages that are finished
  if (msg.message_type !== MessageType.User || msg.message_state !== MessageState.Finish) {
    return
  }

  const text = extractText(msg)
  if (!text) {
    console.log(`[wechat] Received non-text message from ${msg.from_user_id}, skipping`)
    return
  }

  console.log(`[wechat] Received from ${msg.from_user_id}: ${truncate(text, 80)}`)

  try {
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: text,
        meta: {
          chat_id: msg.from_user_id,
          context_token: msg.context_token,
        },
      },
    })
  } catch (error) {
    console.error('[wechat] Failed to forward message to Claude:', error)

    // Send error back to user
    try {
      await ilinkClient.sendMessage(
        msg.from_user_id,
        'Sorry, there was an error processing your message. Please try again.'
      )
    } catch (sendError) {
      console.error('[wechat] Failed to send error message:', sendError)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Start polling
console.error('[wechat] Starting message polling loop...')
await runMessageLoop()
