---
name: quiz_generator
description:
    Creates a 20-question multiple choice Google Slides quiz from a user-uploaded PDF or webpage URL via Discord. Triggers when user shares a file attachment or URL and asks to create a quiz, study questions, or test their knowledge. Grades user answers submitted as "1A 2B 3C" format and provides score and feedback on wrong answers.
---

# Quiz Generator

Generate interactive study quizzes from PDFs or web content and deliver them as Google Slides presentations.

## CRITICAL: Message Routing

**YOU MUST READ THE ENTIRE MESSAGE FIRST** before deciding what to do.

### Route 1: User says "/login" → Authentication Flow
If the message contains "/login" (even with `@Andy /login`), **IMMEDIATELY go to Authentication Flow below**. Do NOT say "not logged in" - HANDLE THE LOGIN!

### Route 2: User says "/quiz" or asks to create quiz → Quiz Generation Flow
If the message contains "/quiz" or asks to create a quiz, go to Quiz Generation Flow.

### Route 3: User provides answers like "1A 2B 3C..." → Answer Grading Flow
If the message looks like quiz answers, go to Answer Grading Flow.

### Route 4: User provides an email address → Store It
If the message contains an email address (has @ and a domain), store it as GOOGLE_EMAIL and confirm.

---

## Authentication Flow

**WHEN TO USE**: User's message contains "/login" or "login" or "@Andy /login"

**Steps:**

1. **Generate OAuth URL**
   - Use `mcp__workspace-mcp__get_oauth_url` to generate a Google OAuth URL
   - Respond with the OAuth URL as a clickable link
   - Example: "To create quizzes, sign in with Google:\n\n[Click here to sign in](OAuth_URL_HERE)\n\nAfter signing in, come back and type `/quiz` to create your first quiz!"
   - IMPORTANT: The OAuth link handles everything - user clicks, selects their Google account, and grants permissions

2. **After OAuth completion**
   - User will see a success page in their browser
   - They can return to Discord and use `/quiz`
   - workspace-mcp handles all token storage automatically

## Quiz Generation Flow

### When user requests a quiz:

1. **Check authentication first**:
   - workspace-mcp will automatically handle authentication
   - If user is not authenticated, the MCP tools will return an error asking them to authenticate
   - In that case, provide them with the OAuth URL using `mcp__workspace-mcp__get_oauth_url`

2. **Extract content**:
   - **If PDF attachment**: Use available PDF reading tools to extract text
   - **If URL provided**: Fetch and parse the webpage content
   - **If neither**: Ask "Please provide a URL or attach a PDF file"

3. **Generate 20 questions**:
   - Analyze the content and identify 20 key concepts
   - For each concept, create a multiple-choice question with 4 options (A, B, C, D)
   - One correct answer per question
   - Store the correct answers internally for grading later

4. **Create Google Slides presentation**:
   - Use `mcp__workspace-mcp__create_presentation` to create a new presentation with title "Quiz: [content topic/title]"
   - Use `mcp__workspace-mcp__batch_update_presentation` to add slides:
     - **Slide 1**: Title slide with quiz topic
     - **Slides 2-21**: One question per slide with 4 options formatted as:
       ```
       Question [N]: [Question text]

       A) [Option A]
       B) [Option B]
       C) [Option C]
       D) [Option D]
       ```

5. **Return the presentation link**:
   - Get the presentation URL from the API response
   - Respond: "Quiz created! View it here: [Google Slides URL]\n\nWhen you're ready, submit your answers like this: 1A 2B 3C 4D..."

## Answer Grading Flow

### When user submits answers (format: "1A 2B 3C..."):

1. **Validate format**:
   - Should be "1A 2B 3C 4D 5A..." (question number + letter)
   - Must have exactly 20 answers
   - If invalid, respond: "Please submit all 20 answers in format: 1A 2B 3C 4D..."

2. **Grade the answers**:
   - Compare each answer to the stored correct answers
   - Count correct answers

3. **Provide feedback**:
   ```
   Score: [X]/20 ([percentage]%)

   Wrong answers:
   - Question 3: You answered B, correct answer is C
   - Question 7: You answered A, correct answer is D
   [etc.]

   Type /retry to generate new questions from the same content.
   ```

## MCP Tools Available

- `mcp__workspace-mcp__get_oauth_url` - Get Google OAuth URL for user authentication
- `mcp__workspace-mcp__create_presentation` - Create a new Google Slides presentation
- `mcp__workspace-mcp__batch_update_presentation` - Add or modify slides in a presentation

## Important Notes

- **workspace-mcp handles authentication automatically** - if user is not authenticated, tools will return an error with OAuth URL
- **Store the correct answers in session context** after generating questions (you'll need them for grading)
- **Be conversational** - users may say "make me a quiz about..." instead of using /quiz
- **Handle errors gracefully** - if PDF extraction or URL fetch fails, explain the issue clearly