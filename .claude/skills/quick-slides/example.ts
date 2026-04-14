/**
 * Example: Quick Slides Generator
 *
 * This demonstrates how to create a Google Slides presentation
 * using the Workspace MCP tools.
 *
 * Usage:
 *   npx tsx .claude/skills/quick-slides/example.ts
 */

// This is a conceptual example showing how the agent would use MCP tools
// In practice, the agent calls these tools directly through the MCP server

interface SlideRequest {
  title: string;
  content: string[];
}

async function createQuickSlides(
  userEmail: string,
  topic: string,
  slides: SlideRequest[]
) {
  console.log(`Creating presentation: ${topic}`);

  // Step 1: Create presentation
  // Tool: mcp__workspace-mcp__create_presentation
  const presentation = {
    user_google_email: userEmail,
    title: topic
  };
  console.log('Created presentation:', presentation);

  // Step 2: Get presentation details to get slide IDs
  // Tool: mcp__workspace-mcp__get_presentation

  // Step 3: Build batch update requests
  const requests = [];

  // First slide is title slide
  requests.push({
    insertText: {
      objectId: 'TITLE_SLIDE_TEXT_BOX_ID', // Would get from presentation object
      text: slides[0].title
    }
  });

  // Add content slides
  for (let i = 1; i < slides.length; i++) {
    const slide = slides[i];

    // Create new slide
    requests.push({
      createSlide: {
        slideLayoutReference: {
          predefinedLayout: 'TITLE_AND_BODY'
        }
      }
    });

    // Add title
    requests.push({
      insertText: {
        objectId: 'SLIDE_TITLE_ID',
        text: slide.title
      }
    });

    // Add bullet points
    slide.content.forEach(bullet => {
      requests.push({
        insertText: {
          objectId: 'SLIDE_BODY_ID',
          text: `• ${bullet}\n`
        }
      });
    });
  }

  // Step 4: Apply batch update
  // Tool: mcp__workspace-mcp__batch_update_presentation
  console.log('Batch update requests:', JSON.stringify(requests, null, 2));

  // Step 5: Return URL
  const presentationUrl = `https://docs.google.com/presentation/d/PRESENTATION_ID/edit`;
  console.log(`\nPresentation created: ${presentationUrl}`);

  return presentationUrl;
}

// Example usage
const exampleSlides: SlideRequest[] = [
  {
    title: "AI Safety",
    content: []
  },
  {
    title: "What is AI Safety?",
    content: [
      "Ensuring AI systems behave as intended",
      "Preventing unintended harmful consequences",
      "Aligning AI goals with human values"
    ]
  },
  {
    title: "Key Challenges",
    content: [
      "Specification problem - defining what we want",
      "Robustness - handling edge cases",
      "Scalable oversight - monitoring advanced systems"
    ]
  },
  {
    title: "Current Approaches",
    content: [
      "Reinforcement Learning from Human Feedback (RLHF)",
      "Constitutional AI",
      "Interpretability research",
      "Red teaming and safety testing"
    ]
  }
];

// Run example
createQuickSlides(
  'user@example.com',
  'AI Safety Overview',
  exampleSlides
);
