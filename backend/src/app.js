import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { parse as parseYaml } from 'yaml';
import { createAuthMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authLimiter, recommendLimiter } from './middleware/rateLimit.js';
import { createMovieRepository } from './repositories/movieRepository.js';
import { createReviewRepository } from './repositories/reviewRepository.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createWatchlistRepository } from './repositories/watchlistRepository.js';
import { createAuthRouter } from './routes/auth.js';
import { createLibraryRouter } from './routes/library.js';
import { createMoviesRouter } from './routes/movies.js';
import { createAuthService } from './services/authService.js';
import { createLibraryService } from './services/libraryService.js';
import { createRecommendationService } from './services/recommendationService.js';

const skip = (_req, _res, next) => next();

/** Wires the app from its dependencies, so tests can pass a throwaway database and a fake LLM. */
export function createApp({ db, llm, config, enableRateLimit = true }) {
  const userRepo = createUserRepository(db);
  const movieRepo = createMovieRepository(db);
  const watchlistRepo = createWatchlistRepository(db);
  const reviewRepo = createReviewRepository(db);

  const authService = createAuthService({ userRepo, ...config });
  const libraryService = createLibraryService({ movieRepo, watchlistRepo, reviewRepo });
  const recommendationService = createRecommendationService({ movieRepo, reviewRepo, llm });
  const { requireAuth, optionalAuth } = createAuthMiddleware({ jwtSecret: config.jwtSecret, userRepo });

  const app = express();
  app.set('trust proxy', config.trustProxy);

  // Swagger UI needs inline resources, so it sits before the strict headers used by the API.
  const openapi = parseYaml(readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8'));
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openapi));

  // The companion frontend is served from the same origin, so one deployment hosts both.
  // It loads Tailwind and icons from CDNs and uses inline handlers, so it gets the relaxed headers too.
  const frontendDir = fileURLToPath(new URL('../../frontend/', import.meta.url));
  if (existsSync(frontendDir)) {
    const relaxedHeaders = helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false });
    const serveFrontend = express.static(frontendDir);
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      relaxedHeaders(req, res, () => serveFrontend(req, res, next));
    });
  }

  // Auth is a Bearer header, never a cookie, so other origins (a separately hosted frontend,
  // a reviewer's local tool) can call and embed the API without being able to ride a session.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin: config.corsOrigin,
    exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'],
    maxAge: 86_400,
  }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    await db.execute('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', enableRateLimit ? authLimiter() : skip, createAuthRouter({ authService }));
  app.use('/api/movies', createMoviesRouter({
    movieRepo,
    recommendationService,
    optionalAuth,
    recommendLimiter: enableRateLimit ? recommendLimiter() : skip,
  }));
  app.use('/api', createLibraryRouter({ libraryService, requireAuth }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
