# WeChat Channel for Claude Code

A Claude Code Channel plugin that connects WeChat to Claude Code via iLink Bot API.

## Features

- Bidirectional chat between WeChat mobile and Claude Code desktop
- QR code login flow
- Automatic reconnection with exponential backoff
- Real-time message polling

## Installation

```bash
bun install
```

## First-Time Setup

Login to WeChat:

```bash
bun src/auth.ts
```

Scan the QR code with WeChat to authenticate.

## Usage

Start Claude Code with the WeChat channel:

```bash
claude --dangerously-load-development-channels server:wechat
```

Send messages from WeChat, they will appear in Claude Code as:

```
<channel source="wechat" chat_id="..." context_token="...">your message</channel>
```

Claude can reply using the `reply` tool.

## Configuration

Credentials are stored in `~/.wechat-channel/credentials.json`.

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
