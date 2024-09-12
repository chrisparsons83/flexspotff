import { loader } from './podcast';
import { truncateDB } from '~/utils/vitest';

describe('Podcasts Loader', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  it('should return a response', async () => {
    const responseData = await loader({
      request: new Request('http://localhost:8811/podcast'),
      params: {},
      context: {},
    }).then(response => response.json());

    expect(responseData).toBeInstanceOf(Object);
    expect(responseData.json.episodes).toBeInstanceOf(Array);
  });

  it('should return a returns episode data', async () => {
    const responseData = await loader({
      request: new Request('http://localhost:8811/podcast'),
      params: {},
      context: {},
    }).then(response => response.json());

    responseData.json.episodes.forEach((episode: Object) => {
      expect(episode).toHaveProperty('id');
      expect(episode).toHaveProperty('createdAt');
      expect(episode).toHaveProperty('updatedAt');
      expect(episode).toHaveProperty('authorId');
      expect(episode).toHaveProperty('description');
      expect(episode).toHaveProperty('duration');
      expect(episode).toHaveProperty('episode');
      expect(episode).toHaveProperty('filepath');
      expect(episode).toHaveProperty('filesize');
      expect(episode).toHaveProperty('filetype');
      expect(episode).toHaveProperty('publishDate');
      expect(episode).toHaveProperty('season');
      expect(episode).toHaveProperty('shownotes');
      expect(episode).toHaveProperty('title');
    });
  });
});
