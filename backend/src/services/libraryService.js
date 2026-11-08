import { ApiError } from '../errors.js';

/** A user's watchlist and watched history. Each method takes the id from the verified token. */
export function createLibraryService({ movieRepo, watchlistRepo, reviewRepo }) {
  async function assertMovieExists(movieId) {
    if (!(await movieRepo.findById(movieId))) throw new ApiError(404, 'Film tidak ditemukan');
  }

  return {
    listWatchlist: (userId) => watchlistRepo.listByUser(userId),

    async addToWatchlist(userId, movieId) {
      await assertMovieExists(movieId);
      const added = await watchlistRepo.add(userId, movieId);
      if (!added) throw new ApiError(409, 'Film sudah ada di watchlist');
      return watchlistRepo.find(userId, movieId);
    },

    async removeFromWatchlist(userId, movieId) {
      const removed = await watchlistRepo.remove(userId, movieId);
      if (!removed) throw new ApiError(404, 'Film tidak ada di watchlist');
    },

    listWatched: (userId) => reviewRepo.listByUser(userId),

    async logWatched(userId, { movieId, rating, review }) {
      await assertMovieExists(movieId);
      const created = await reviewRepo.upsert(userId, movieId, { rating, review });
      return { created, entry: await reviewRepo.find(userId, movieId) };
    },
  };
}
