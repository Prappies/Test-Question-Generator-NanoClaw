/**
 * Google Slides API Integration
 * Uses OAuth tokens from google-oauth.ts to create and manage presentations
 */

import { logger } from './logger.js';
import { getAccessToken } from './google-oauth.js';

/**
 * Create a new Google Slides presentation
 */
export async function createPresentation(
  userId: string,
  title: string
): Promise<{ presentationId: string; presentationUrl: string } | null> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    logger.error({ userId }, 'No OAuth token found for user');
    return null;
  }

  try {
    const response = await fetch('https://slides.googleapis.com/v1/presentations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ userId, status: response.status, error }, 'Failed to create presentation');
      return null;
    }

    const presentation = await response.json() as any;
    const presentationId = presentation.presentationId;
    const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

    logger.info({ userId, presentationId, title }, 'Created presentation');

    return { presentationId, presentationUrl };
  } catch (err) {
    logger.error({ userId, err }, 'Error creating presentation');
    return null;
  }
}

/**
 * Add slides to a presentation using batchUpdate
 */
export async function addSlides(
  userId: string,
  presentationId: string,
  slides: Array<{ title: string; content: string }>
): Promise<boolean> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    logger.error({ userId }, 'No OAuth token found for user');
    return false;
  }

  try {
    // Build batch update requests
    const requests: any[] = [];

    for (const slide of slides) {
      // Create a new slide
      const slideId = `slide_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      requests.push({
        createSlide: {
          objectId: slideId,
          slideLayoutReference: {
            predefinedLayout: 'TITLE_AND_BODY'
          }
        }
      });

      // Add title text
      requests.push({
        insertText: {
          objectId: slideId,
          text: slide.title,
          insertionIndex: 0
        }
      });

      // Add content text
      requests.push({
        insertText: {
          objectId: slideId,
          text: slide.content,
          insertionIndex: 0
        }
      });
    }

    const response = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error({ userId, presentationId, status: response.status, error }, 'Failed to add slides');
      return false;
    }

    logger.info({ userId, presentationId, slideCount: slides.length }, 'Added slides to presentation');
    return true;
  } catch (err) {
    logger.error({ userId, presentationId, err }, 'Error adding slides');
    return false;
  }
}

/**
 * Get presentation details
 */
export async function getPresentation(
  userId: string,
  presentationId: string
): Promise<any | null> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    logger.error({ userId }, 'No OAuth token found for user');
    return null;
  }

  try {
    const response = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presentationId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error({ userId, presentationId, status: response.status, error }, 'Failed to get presentation');
      return null;
    }

    const presentation = await response.json();
    return presentation;
  } catch (err) {
    logger.error({ userId, presentationId, err }, 'Error getting presentation');
    return null;
  }
}

/**
 * Create a complete quiz presentation with questions
 */
export async function createQuizPresentation(
  userId: string,
  title: string,
  questions: Array<{ question: string; options: string[]; correctAnswer: string }>
): Promise<{ presentationId: string; presentationUrl: string } | null> {
  // Create the presentation
  const result = await createPresentation(userId, title);
  if (!result) return null;

  const { presentationId, presentationUrl } = result;

  // Build slides for each question
  const slides = questions.map((q, index) => ({
    title: `Question ${index + 1}`,
    content: `${q.question}\n\n${q.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n')}`
  }));

  // Add all slides
  const success = await addSlides(userId, presentationId, slides);
  if (!success) {
    logger.error({ userId, presentationId }, 'Failed to add quiz slides');
    return null;
  }

  return { presentationId, presentationUrl };
}
