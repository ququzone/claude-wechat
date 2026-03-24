# WeChat Channel for Claude Code

A Claude Code Channel plugin that connects WeChat to Claude Code via iLink Bot API.

## Features

- Bidirectional chat between WeChat mobile and Claude Code desktop
- QR code login flow
- Automatic reconnection with exponential backoff
- Real-time message polling

## Installation

### Prerequisites

⚠️ **Channels are currently in Research Preview**

- Requires Claude Code v2.1.80 or later
- Must be logged in with claude.ai account (not API key or console auth)
- Team/Enterprise organizations must have Channels explicitly enabled
- Custom channels require development mode flag

### Option 1: Install from Marketplace (Recommended)

```bash
# Add the marketplace
/plugin marketplace add https://github.com/ququzone/claude-wechat

# Install the plugin
/plugin install wechat-channel@claude-wechat
```

### Option 2: Development Mode

```bash
# Install dependencies
bun install

# Login to WeChat (first time only)
bun src/auth.ts
```

Scan the QR code with WeChat to authenticate. Credentials are stored in `~/.wechat-channel/credentials.json`.

## Usage

### Start Claude Code with WeChat Channel

⚠️ **Important**: During the research preview, custom channels must use the development flag:

```bash
# Start Claude Code with the WeChat channel enabled (development mode)
claude --dangerously-load-development-channels plugin:wechat-channel:wechat@claude-wechat
```

**Note**: If you see "Channels are not currently available", ensure:
- You're logged in with claude.ai (not API key)
- Your organization has Channels enabled (for Team/Enterprise accounts)
- You're using Claude Code v2.1.80 or later

### Send and Receive Messages

1. **Send messages from WeChat**: Open WeChat on your phone, find your bot, and send a message
2. **Message appears in Claude Code**:
   ```
   <channel source="wechat" chat_id="...">your message</channel>
   ```
3. **Claude responds**: Claude will automatically reply using the WeChat bot

### Example Conversation

```
You (in WeChat): What's the weather like today?

Claude (in Claude Code): I don't have access to real-time weather data, but I can help you check weather websites or services if you'd like.

(Claude's response is automatically sent back to WeChat)
```

## Configuration

### Credentials File
Credentials are stored in `~/.wechat-channel/credentials.json`:
- Automatically created during first login
- Contains authentication tokens for iLink Bot API
- Do not share this file

### Troubleshooting

**Messages not appearing:**
- Check that Claude Code is running with `--channels` flag
- Verify you're logged in: run `bun src/auth.ts` again
- Check Claude Code logs for errors

**Cannot reply:**
- Ensure the plugin is installed and enabled
- Verify MCP server is running: check `/mcp` in Claude Code

## Architecture

- **iLink API**: WeChat's official Bot API
- **MCP Server**: Channel plugin via stdio
- **Long-polling**: 35s timeout for new messages

## Development

```bash
# Run directly for testing
bun src/index.ts

# Format code
bun run format
```

## License

MIT