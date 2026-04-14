# Quick Slides Generator - Mini Project

A practice skill demonstrating NanoClaw + Google Workspace MCP integration.

## What This Demonstrates

1. **Utility Skill Pattern** - How to create a NanoClaw skill with instructions
2. **MCP Tool Integration** - Using Google Workspace (Slides) APIs
3. **Conversational UI** - Natural language → structured output
4. **OAuth Workflow** - Handling user authentication

## Files

- `SKILL.md` - Agent instructions (loaded into container context)
- `example.ts` - Conceptual example showing the workflow
- `README.md` - This file

## How It Works

### 1. User sends message
```
"create slides about AI safety"
```

### 2. Agent reads SKILL.md
The skill instructions are loaded into the agent's context, so it knows how to respond to slide creation requests.

### 3. Agent uses MCP tools
```typescript
// Create presentation
mcp__workspace-mcp__create_presentation({
  user_google_email: "user@example.com",
  title: "AI Safety"
})

// Add slides
mcp__workspace-mcp__batch_update_presentation({
  user_google_email: "user@example.com",
  presentation_id: "...",
  requests: [...]
})
```

### 4. Agent returns URL
```
Created presentation: https://docs.google.com/presentation/d/...
```

## Setup Requirements

1. **Google OAuth** - MCP server needs Google Workspace authentication
2. **Claude API** - NanoClaw agents need ANTHROPIC_API_KEY
3. **MCP Server** - Google Workspace MCP server must be configured

## Testing This Skill

### Option 1: Interactive (requires full setup)

1. Ensure you have Claude API key in `.env`
2. Configure Google Workspace MCP server
3. Message your NanoClaw agent: "create slides about [topic]"

### Option 2: Manual test (just MCP tools)

You can test the MCP tools directly without NanoClaw:

```bash
# If you have the MCP server running
# Use your MCP client to call:
mcp__workspace-mcp__create_presentation({
  user_google_email: "your@email.com",
  title: "Test Presentation"
})
```

## What You Learn

- ✅ How NanoClaw skills work (instruction-based)
- ✅ How agents consume SKILL.md files
- ✅ Google Slides API capabilities
- ✅ MCP tool integration patterns
- ✅ OAuth credential management

## Next Steps

**Enhance this skill:**
- Add image support (insert images from URLs)
- Support templates (branded slide decks)
- Generate from data sources (Sheets, CSV)
- Add charts and graphs
- Support slide themes

**Create related skills:**
- "Email me the slides" - Combine Slides + Gmail
- "Schedule presentation review" - Slides + Calendar
- "Share slides with team" - Slides + Drive permissions

## Architecture Notes

This is a **utility skill** because:
- Ships with code files (SKILL.md, examples)
- Adds new capability to NanoClaw
- Lives in `.claude/skills/` directory
- Not merged to a branch (local-only for practice)

For production skills, see [CONTRIBUTING.md](../../../CONTRIBUTING.md) for the full skill taxonomy and PR requirements.
