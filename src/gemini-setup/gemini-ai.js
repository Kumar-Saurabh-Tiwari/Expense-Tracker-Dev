const { GoogleGenAI } = require('@google/genai');

const categories = ['Food', 'Petrol', 'Salary', 'Transport', 'Shopping', 'Bills', 'Other'];

async function askGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('Gemini is not configured.'), {
      status: 503,
      publicMessage: 'AI is not configured. Set GEMINI_API_KEY and restart the app.'
    });
  }

  let result;
  try {
    const ai = new GoogleGenAI({ apiKey });
    result = await ai.interactions.create({
      model: 'gemini-3.5-flash-lite',
      input: prompt,
      store: false,
      generation_config: { temperature: 0.1, max_output_tokens: 80 }
    }, {
      timeout_ms: 10000,
      retries: { strategy: 'none' }
    });
  } catch (error) {
    console.error('Gemini API request failed:', error.status || error.name || 'unknown error');
    const temporaryFailure = [429, 500, 502, 503, 504].includes(error.status) ||
      /timeout|connection/i.test(error.name || '');
    throw Object.assign(
      new Error(temporaryFailure ? 'Gemini is temporarily unavailable.' : 'Gemini request failed.'),
      {
        status: temporaryFailure ? 503 : 502,
        publicMessage: temporaryFailure
          ? 'Gemini is temporarily unavailable. Please try again in a moment.'
          : 'AI suggestion is unavailable right now.'
      }
    );
  }

  const text = result.output_text?.trim();
  if (!text) {
    throw Object.assign(new Error('Gemini returned an empty response.'), {
      status: 502,
      publicMessage: 'Gemini returned an empty response. Please try again.'
    });
  }
  return text;
}

async function suggestCategory(description) {
  const choices = categories.join(', ');
  const suggestion = await askGemini(
    `Choose the best expense category for this description: ${JSON.stringify(description)}. ` +
    `Reply with exactly one category from: ${choices}. If unclear, reply Other.`
  );
  const category = categories.find((item) => item.toLowerCase() === suggestion.toLowerCase());
  if (!category) {
    throw Object.assign(new Error('Gemini returned an invalid category.'), {
      status: 502,
      publicMessage: 'AI returned an invalid category. Choose a category manually.'
    });
  }
  return category;
}

async function createSpendingInsight(categoryTotals) {
  return askGemini(
    `Give one practical, friendly spending insight in 25 words or fewer based on this user's last 30 days of spending by category: ` +
    `${JSON.stringify(categoryTotals)}. Do not invent data or shame the user.`
  );
}

module.exports = { suggestCategory, createSpendingInsight };
