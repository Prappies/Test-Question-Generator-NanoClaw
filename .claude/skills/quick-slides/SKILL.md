# Quick Slides Generator

Generate Google Slides presentations from conversational input.

## Triggers

- "create slides about [topic]"
- "make a presentation on [topic]"
- "generate slides: [content]"
- "new presentation about [topic]"

## How It Works

When the user requests slides, create a Google Slides presentation using the MCP workspace tools.

## Instructions

1. **Extract the topic/content** from the user's message
2. **Create the presentation** using `mcp__workspace-mcp__create_presentation`
3. **Add slides** using `mcp__workspace-mcp__batch_update_presentation` with requests to:
   - Create title slide
   - Create content slides (3-5 slides typically)
   - Add text boxes with content
4. **Return the presentation URL** to the user

## Example Workflow

User: "create slides about AI safety"

Agent should:
1. Create presentation titled "AI Safety"
2. Add title slide with "AI Safety"
3. Add 3-4 content slides:
   - "What is AI Safety?"
   - "Key Challenges"
   - "Current Approaches"
   - "Future Directions"
4. Populate each slide with relevant text content
5. Return the Google Slides URL

## Required Parameter

All workspace MCP tools require `user_google_email`. Ask the user for their Google email on first use, then remember it for the session.

## MCP Tools Available

- `mcp__workspace-mcp__create_presentation` - Create new presentation
- `mcp__workspace-mcp__get_presentation` - Get presentation details
- `mcp__workspace-mcp__batch_update_presentation` - Add/modify slides
- `mcp__workspace-mcp__get_page` - Get specific slide details
- `mcp__workspace-mcp__get_page_thumbnail` - Generate thumbnails

## Slide Creation Example

```javascript
// Create presentation
const presentation = await create_presentation({
  user_google_email: "user@example.com",
  title: "My Topic"
});

// Add slides with batch_update_presentation
const requests = [
  {
    createSlide: {
      slideLayoutReference: { predefinedLayout: "TITLE" }
    }
  },
  {
    createSlide: {
      slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" }
    }
  }
];
```

## Notes

- Keep presentations focused (3-7 slides for most topics)
- Use clear, concise text
- Add visual hierarchy with title/body layouts
- Return the edit URL so user can further customize
