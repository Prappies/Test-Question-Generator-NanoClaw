# Testing Quick Slides Generator

## Quick Test Checklist

### Prerequisites Check

- [ ] Google Workspace MCP server is configured
- [ ] You have a Google account
- [ ] Claude API key in `.env` (if testing via NanoClaw)

### Test 1: Create Basic Presentation

**Via NanoClaw message:**
```
create slides about "Coffee Brewing Methods"
```

**Expected behavior:**
1. Agent asks for your Google email (first time only)
2. Agent creates presentation
3. Returns Google Slides URL

**Verify:**
- Open the URL
- Check that presentation exists
- Check that it has multiple slides
- Verify content matches topic

### Test 2: More Complex Topic

**Via NanoClaw message:**
```
make a presentation on "Git Workflow Best Practices" with sections on branching, commit messages, and pull requests
```

**Expected behavior:**
1. Agent creates 4-5 slides
2. Slides cover all requested sections
3. Content is well-structured

### Test 3: Direct MCP Tool Usage

If you want to test the MCP tools directly (without NanoClaw):

```typescript
// Using the MCP tool directly
const result = await mcp__workspace-mcp__create_presentation({
  user_google_email: "your-email@gmail.com",
  title: "Test Presentation"
});

console.log(result);
// Should return presentation ID and URL
```

## Troubleshooting

### "Authentication required"
- Run OAuth flow for Google Workspace MCP
- Check that user_google_email is correct

### "ANTHROPIC_API_KEY not found"
- Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`
- Restart NanoClaw

### "MCP server not available"
- Check MCP server configuration
- Verify Google Workspace MCP is running

### Agent doesn't recognize trigger
- Check that SKILL.md is in `.claude/skills/quick-slides/`
- Restart NanoClaw container to reload skills
- Try exact phrases from SKILL.md triggers

## Success Criteria

✅ Can create presentation from natural language
✅ Presentation has multiple slides
✅ Content is relevant to topic
✅ Returns working Google Slides URL
✅ Can open and edit presentation in browser

## Example Output

```
User: create slides about AI safety

Agent: I'll create a presentation about AI safety for you.
What's your Google email address?

User: user@gmail.com

Agent: Creating presentation...

Created "AI Safety" presentation with 4 slides:
- Title: AI Safety
- What is AI Safety?
- Key Challenges
- Current Approaches

View and edit: https://docs.google.com/presentation/d/abc123/edit
```

## Next Level Testing

Once basic tests work, try:

1. **Data integration** - "Create slides from this CSV data"
2. **Image insertion** - "Add images to the slides"
3. **Theme/branding** - "Use company template"
4. **Batch creation** - "Create 5 different presentations"
5. **Collaboration** - "Share the slides with team@company.com"

## Performance Notes

- Presentation creation: ~2-5 seconds
- Each slide addition: ~1 second
- Total for 5-slide deck: ~10 seconds

Optimize by batching all slide operations into a single `batch_update_presentation` call.
