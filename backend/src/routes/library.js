import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { movieIdParam, watchedBody, watchlistBody } from './schemas.js';

const watchlistParam = z.object({ movieId: movieIdParam.shape.id });

/**
 * Watchlist and watched routes. The user id only ever comes from req.userId, set by requireAuth.
 * requireAuth is attached per route: this router is mounted on /api, so router.use() would also
 * answer 401 for unknown paths instead of 404.
 */
export function createLibraryRouter({ libraryService, requireAuth }) {
  const router = Router();

  router.get('/watchlist', requireAuth, async (req, res) => {
    res.json(await libraryService.listWatchlist(req.userId));
  });

  router.post('/watchlist', requireAuth, validate({ body: watchlistBody }), async (req, res) => {
    res.status(201).json(await libraryService.addToWatchlist(req.userId, req.valid.body.movieId));
  });

  router.delete('/watchlist/:movieId', requireAuth, validate({ params: watchlistParam }), async (req, res) => {
    await libraryService.removeFromWatchlist(req.userId, req.valid.params.movieId);
    res.status(204).end();
  });

  router.get('/watched', requireAuth, async (req, res) => {
    res.json(await libraryService.listWatched(req.userId));
  });

  router.post('/watched', requireAuth, validate({ body: watchedBody }), async (req, res) => {
    const { created, entry } = await libraryService.logWatched(req.userId, req.valid.body);
    res.status(created ? 201 : 200).json(entry);
  });

  return router;
}
