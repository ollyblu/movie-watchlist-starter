import { Router } from 'express';
import { ApiError } from '../errors.js';
import { validate } from '../middleware/validate.js';
import { movieIdParam, movieListQuery, recommendBody } from './schemas.js';

export function createMoviesRouter({ movieRepo, recommendationService, optionalAuth, recommendLimiter }) {
  const router = Router();

  router.get('/', validate({ query: movieListQuery }), async (req, res) => {
    res.json(await movieRepo.list(req.valid.query));
  });

  router.post('/recommend', recommendLimiter, optionalAuth, validate({ body: recommendBody }), async (req, res) => {
    res.json(await recommendationService.recommend({ prompt: req.valid.body.prompt, userId: req.userId }));
  });

  router.get('/:id', validate({ params: movieIdParam }), async (req, res) => {
    const movie = await movieRepo.findById(req.valid.params.id);
    if (!movie) throw new ApiError(404, 'Film tidak ditemukan');
    res.json(movie);
  });

  return router;
}
