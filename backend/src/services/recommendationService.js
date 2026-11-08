import { z } from 'zod';
import { ApiError } from '../errors.js';
import { SYSTEM_INSTRUCTION, buildResponseSchema, buildUserContent } from '../llm/prompt.js';

const MAX_ATTEMPTS = 2;

const outputSchema = z.object({
  movie_id: z.string().regex(/^\d+$/).transform(Number),
  reasoning: z.string().trim().min(1).max(1500),
});

/** Returns { value } or { problem }. This check is the guarantee; the prompt and schema only help. */
function parseOutput(text, candidates) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { problem: 'jawaban bukan JSON yang valid.' };
  }

  const parsed = outputSchema.safeParse(json);
  if (!parsed.success) return { problem: 'format movie_id atau reasoning tidak sesuai.' };

  if (!candidates.some((movie) => movie.id === parsed.data.movie_id)) {
    return { problem: `movie_id ${parsed.data.movie_id} tidak ada di <candidates>.` };
  }

  // The frontend renders this text with innerHTML, and the model can echo the user's input.
  return { value: { ...parsed.data, reasoning: parsed.data.reasoning.replace(/[<>]/g, '') } };
}

export function createRecommendationService({ movieRepo, reviewRepo, llm }) {
  /** Anonymous users choose from the whole catalog. Logged-in users skip what they have seen. */
  async function loadContext(userId) {
    const catalog = await movieRepo.list();
    if (userId === null || userId === undefined) return { candidates: catalog, tasteHistory: [] };

    const tasteHistory = await reviewRepo.listTasteByUser(userId);
    const watched = new Set(tasteHistory.map((item) => item.movie_id));
    const unwatched = catalog.filter((movie) => !watched.has(movie.id));
    return { candidates: unwatched.length > 0 ? unwatched : catalog, tasteHistory };
  }

  return {
    async recommend({ prompt, userId }) {
      const { candidates, tasteHistory } = await loadContext(userId);
      const responseSchema = buildResponseSchema(candidates);
      let correction;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        let text;
        try {
          text = await llm.generate({
            systemInstruction: SYSTEM_INSTRUCTION,
            content: buildUserContent({ candidates, tasteHistory, userPrompt: prompt, correction }),
            responseSchema,
          });
        } catch (err) {
          if (err.retryable && attempt < MAX_ATTEMPTS) continue;
          throw err;
        }

        const { value, problem } = parseOutput(text, candidates);
        if (value) return value;

        console.warn(`Output Gemini ditolak (percobaan ${attempt}): ${problem}`);
        correction = problem;
      }

      throw new ApiError(502, 'Layanan rekomendasi memberi jawaban yang tidak valid. Coba lagi.');
    },
  };
}
