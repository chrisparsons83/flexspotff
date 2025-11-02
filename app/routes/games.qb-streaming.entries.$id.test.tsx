import { action } from './games.qb-streaming.entries.$id';
import type { ActionFunctionArgs } from '@remix-run/node';
import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest';
import * as nflGameModel from '~/models/nflgame.server';
import * as qbSelectionModel from '~/models/qbselection.server';
import * as qbStreamingWeekModel from '~/models/qbstreamingweek.server';
import type { User } from '~/models/user.server';
import * as auth from '~/services/auth.server';
import { prisma } from '~/db.server';

// Mock all dependencies
vi.mock('~/services/auth.server', () => ({
  authenticator: {
    isAuthenticated: vi.fn(),
  },
}));
vi.mock('~/models/qbstreamingweek.server');
vi.mock('~/models/qbselection.server');
vi.mock('~/models/nflgame.server');
vi.mock('~/db.server', () => ({
  prisma: {
    $disconnect: vi.fn(),
  },
}));

describe('QB Streaming Entries Action', () => {
  const mockUser: User = {
    id: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    discordId: 'discord-123',
    discordName: 'TestUser',
    discordAvatar: 'avatar-url',
    discordRoles: [],
  };
  const weekId = 'week-123';
  const standardOptionId = 'standard-option-123';
  const deepOptionId = 'deep-option-123';
  const altStandardOptionId = 'standard-option-456';
  const altDeepOptionId = 'deep-option-456';

  // Mock dates
  const now = new Date('2024-01-15T12:00:00Z');
  const futureDate = new Date('2024-01-15T20:00:00Z'); // 8 hours from now
  const pastDate = new Date('2024-01-15T08:00:00Z'); // 4 hours ago

  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(now);

    // Default auth mock - isAuthenticated returns Promise<User | null>
    // In tests we mock it to always return User (successful auth)
    // @ts-expect-error - Mocking narrower type (User) than actual (User | null) for test clarity
    vi.mocked(auth.authenticator.isAuthenticated).mockResolvedValue(mockUser);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const createMockRequest = (
    standardPlayerId: string,
    deepPlayerId: string,
  ): ActionFunctionArgs => {
    const formData = new FormData();
    formData.set('standardPlayerId', standardPlayerId);
    formData.set('deepPlayerId', deepPlayerId);

    return {
      params: { id: weekId },
      request: new Request('http://localhost', {
        method: 'POST',
        body: formData,
      }),
      context: {},
    };
  };

  const createMockWeek = () => ({
    id: weekId,
    year: 2024,
    week: 1,
    QBStreamingWeekOptions: [
      {
        id: standardOptionId,
        nflGameId: 'game-1',
        isDeep: false,
        playerId: 'player-1',
        qbStreamingWeekId: weekId,
      },
      {
        id: deepOptionId,
        nflGameId: 'game-2',
        isDeep: true,
        playerId: 'player-2',
        qbStreamingWeekId: weekId,
      },
      {
        id: altStandardOptionId,
        nflGameId: 'game-3',
        isDeep: false,
        playerId: 'player-3',
        qbStreamingWeekId: weekId,
      },
      {
        id: altDeepOptionId,
        nflGameId: 'game-4',
        isDeep: true,
        playerId: 'player-4',
        qbStreamingWeekId: weekId,
      },
    ],
  });

  describe('Creating new selections', () => {
    it('should create selections when both games are unlocked', async () => {
      const mockWeek = createMockWeek();
      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(null);
      vi.mocked(nflGameModel.getNflGameById)
        .mockResolvedValueOnce({
          id: 'game-1',
          gameStartTime: futureDate,
        } as any)
        .mockResolvedValueOnce({
          id: 'game-2',
          gameStartTime: futureDate,
        } as any);
      vi.mocked(qbSelectionModel.createQBSelection).mockResolvedValue(
        {} as any,
      );

      const result = await action(
        createMockRequest(standardOptionId, deepOptionId),
      );

      expect(qbSelectionModel.createQBSelection).toHaveBeenCalledWith({
        userId: mockUser.id,
        standardPlayerId: standardOptionId,
        deepPlayerId: deepOptionId,
        qbStreamingWeekId: weekId,
      });
      const data = await result.json();
      expect(data).toEqual({ message: 'Your picks have been created.' });
    });

    it('should throw error when trying to create with locked standard player', async () => {
      const mockWeek = createMockWeek();
      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(null);
      vi.mocked(nflGameModel.getNflGameById).mockResolvedValueOnce({
        id: 'game-1',
        gameStartTime: pastDate,
      } as any);

      await expect(
        action(createMockRequest(standardOptionId, deepOptionId)),
      ).rejects.toThrow(
        'Cannot select a standard player whose game has already started',
      );
    });

    it('should throw error when trying to create with locked deep player', async () => {
      const mockWeek = createMockWeek();
      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(null);
      vi.mocked(nflGameModel.getNflGameById)
        .mockResolvedValueOnce({
          id: 'game-1',
          gameStartTime: futureDate,
        } as any)
        .mockResolvedValueOnce({
          id: 'game-2',
          gameStartTime: pastDate,
        } as any);

      await expect(
        action(createMockRequest(standardOptionId, deepOptionId)),
      ).rejects.toThrow(
        'Cannot select a deep player whose game has already started',
      );
    });
  });

  describe('Updating selections when both are unlocked', () => {
    it('should update both selections when both games are unlocked', async () => {
      const mockWeek = createMockWeek();
      const mockExistingSelection = {
        id: 'selection-123',
        qbStreamingWeekId: weekId,
        userId: mockUser.id,
        standardPlayerId: standardOptionId,
        deepPlayerId: deepOptionId,
        standardPlayer: {
          id: standardOptionId,
          nflGame: { id: 'game-1', gameStartTime: futureDate },
        },
        deepPlayer: {
          id: deepOptionId,
          nflGame: { id: 'game-2', gameStartTime: futureDate },
        },
      };

      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(
        mockExistingSelection as any,
      );
      vi.mocked(nflGameModel.getNflGameById)
        .mockResolvedValueOnce({
          id: 'game-3',
          gameStartTime: futureDate,
        } as any)
        .mockResolvedValueOnce({
          id: 'game-4',
          gameStartTime: futureDate,
        } as any);
      vi.mocked(qbSelectionModel.updateQBSelection).mockResolvedValue(
        {} as any,
      );

      const result = await action(
        createMockRequest(altStandardOptionId, altDeepOptionId),
      );

      expect(qbSelectionModel.updateQBSelection).toHaveBeenCalledWith({
        id: 'selection-123',
        qbStreamingWeekId: weekId,
        userId: mockUser.id,
        standardPlayerId: altStandardOptionId,
        deepPlayerId: altDeepOptionId,
      });
      const data = await result.json();
      expect(data).toEqual({ message: 'Your picks have been updated.' });
    });
  });

  describe('Updating when standard is locked, deep is unlocked', () => {
    it('should keep locked standard, allow deep change', async () => {
      const mockWeek = createMockWeek();
      const mockExistingSelection = {
        id: 'selection-123',
        qbStreamingWeekId: weekId,
        userId: mockUser.id,
        standardPlayerId: standardOptionId,
        deepPlayerId: deepOptionId,
        standardPlayer: {
          id: standardOptionId,
          nflGame: { id: 'game-1', gameStartTime: pastDate }, // Locked
        },
        deepPlayer: {
          id: deepOptionId,
          nflGame: { id: 'game-2', gameStartTime: futureDate }, // Unlocked
        },
      };

      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(
        mockExistingSelection as any,
      );
      vi.mocked(nflGameModel.getNflGameById).mockResolvedValueOnce({
        id: 'game-4',
        gameStartTime: futureDate,
      } as any);
      vi.mocked(qbSelectionModel.updateQBSelection).mockResolvedValue(
        {} as any,
      );

      const result = await action(
        createMockRequest(altStandardOptionId, altDeepOptionId),
      );

      // Should ignore the submitted standard ID and keep the existing one
      expect(qbSelectionModel.updateQBSelection).toHaveBeenCalledWith({
        id: 'selection-123',
        qbStreamingWeekId: weekId,
        userId: mockUser.id,
        standardPlayerId: standardOptionId, // Original, not altStandardOptionId
        deepPlayerId: altDeepOptionId, // Changed
      });
      const data = await result.json();
      expect(data).toEqual({ message: 'Your picks have been updated.' });
    });

    it('should prevent HTML tampering of locked standard selection', async () => {
      const mockWeek = createMockWeek();
      const mockExistingSelection = {
        id: 'selection-123',
        qbStreamingWeekId: weekId,
        userId: mockUser.id,
        standardPlayerId: standardOptionId,
        deepPlayerId: deepOptionId,
        standardPlayer: {
          id: standardOptionId,
          nflGame: { id: 'game-1', gameStartTime: pastDate }, // Locked
        },
        deepPlayer: {
          id: deepOptionId,
          nflGame: { id: 'game-2', gameStartTime: futureDate },
        },
      };

      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(
        mockExistingSelection as any,
      );
      vi.mocked(nflGameModel.getNflGameById).mockResolvedValueOnce({
        id: 'game-2',
        gameStartTime: futureDate,
      } as any);
      vi.mocked(qbSelectionModel.updateQBSelection).mockResolvedValue(
        {} as any,
      );

      // User tries to submit a different standard ID by modifying HTML
      const result = await action(
        createMockRequest(altStandardOptionId, deepOptionId),
      );

      // Server should ignore the tampered value
      expect(qbSelectionModel.updateQBSelection).toHaveBeenCalledWith(
        expect.objectContaining({
          standardPlayerId: standardOptionId, // Original, not the tampered value
        }),
      );
      const data = await result.json();
      expect(data).toEqual({ message: 'Your picks have been updated.' });
    });
  });

  describe('Updating when deep is locked, standard is unlocked', () => {
    it('should keep locked deep, allow standard change', async () => {
      const mockWeek = createMockWeek();
      const mockExistingSelection = {
        id: 'selection-123',
        qbStreamingWeekId: weekId,
        userId: mockUser.id,
        standardPlayerId: standardOptionId,
        deepPlayerId: deepOptionId,
        standardPlayer: {
          id: standardOptionId,
          nflGame: { id: 'game-1', gameStartTime: futureDate }, // Unlocked
        },
        deepPlayer: {
          id: deepOptionId,
          nflGame: { id: 'game-2', gameStartTime: pastDate }, // Locked
        },
      };

      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(
        mockExistingSelection as any,
      );
      vi.mocked(nflGameModel.getNflGameById).mockResolvedValueOnce({
        id: 'game-3',
        gameStartTime: futureDate,
      } as any);
      vi.mocked(qbSelectionModel.updateQBSelection).mockResolvedValue(
        {} as any,
      );

      const result = await action(
        createMockRequest(altStandardOptionId, altDeepOptionId),
      );

      // Should allow standard change but keep locked deep
      expect(qbSelectionModel.updateQBSelection).toHaveBeenCalledWith({
        id: 'selection-123',
        qbStreamingWeekId: weekId,
        userId: mockUser.id,
        standardPlayerId: altStandardOptionId, // Changed
        deepPlayerId: deepOptionId, // Original, not altDeepOptionId
      });
      const data = await result.json();
      expect(data).toEqual({ message: 'Your picks have been updated.' });
    });

    it('should prevent HTML tampering of locked deep selection', async () => {
      const mockWeek = createMockWeek();
      const mockExistingSelection = {
        id: 'selection-123',
        qbStreamingWeekId: weekId,
        userId: mockUser.id,
        standardPlayerId: standardOptionId,
        deepPlayerId: deepOptionId,
        standardPlayer: {
          id: standardOptionId,
          nflGame: { id: 'game-1', gameStartTime: futureDate },
        },
        deepPlayer: {
          id: deepOptionId,
          nflGame: { id: 'game-2', gameStartTime: pastDate }, // Locked
        },
      };

      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(
        mockExistingSelection as any,
      );
      vi.mocked(nflGameModel.getNflGameById).mockResolvedValueOnce({
        id: 'game-1',
        gameStartTime: futureDate,
      } as any);
      vi.mocked(qbSelectionModel.updateQBSelection).mockResolvedValue(
        {} as any,
      );

      // User tries to submit a different deep ID by modifying HTML
      const result = await action(
        createMockRequest(standardOptionId, altDeepOptionId),
      );

      // Server should ignore the tampered value
      expect(qbSelectionModel.updateQBSelection).toHaveBeenCalledWith(
        expect.objectContaining({
          deepPlayerId: deepOptionId, // Original, not the tampered value
        }),
      );
      const data = await result.json();
      expect(data).toEqual({ message: 'Your picks have been updated.' });
    });
  });

  describe('Updating when both are locked', () => {
    it('should keep both locked selections regardless of submitted values', async () => {
      const mockWeek = createMockWeek();
      const mockExistingSelection = {
        id: 'selection-123',
        qbStreamingWeekId: weekId,
        userId: mockUser.id,
        standardPlayerId: standardOptionId,
        deepPlayerId: deepOptionId,
        standardPlayer: {
          id: standardOptionId,
          nflGame: { id: 'game-1', gameStartTime: pastDate }, // Locked
        },
        deepPlayer: {
          id: deepOptionId,
          nflGame: { id: 'game-2', gameStartTime: pastDate }, // Locked
        },
      };

      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(
        mockExistingSelection as any,
      );
      vi.mocked(qbSelectionModel.updateQBSelection).mockResolvedValue(
        {} as any,
      );

      const result = await action(
        createMockRequest(altStandardOptionId, altDeepOptionId),
      );

      // Should keep both original values
      expect(qbSelectionModel.updateQBSelection).toHaveBeenCalledWith({
        id: 'selection-123',
        qbStreamingWeekId: weekId,
        userId: mockUser.id,
        standardPlayerId: standardOptionId, // Original
        deepPlayerId: deepOptionId, // Original
      });
      const data = await result.json();
      expect(data).toEqual({ message: 'Your picks have been updated.' });
    });
  });

  describe('Error cases', () => {
    it('should throw error when week does not exist', async () => {
      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        null,
      );

      await expect(
        action(createMockRequest(standardOptionId, deepOptionId)),
      ).rejects.toThrow('Week does not exist');
    });

    it('should throw error when standard option not found in week', async () => {
      const mockWeek = createMockWeek();
      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(null);

      await expect(
        action(createMockRequest('invalid-id', deepOptionId)),
      ).rejects.toThrow('Standard QB Streaming Option not found');
    });

    it('should throw error when deep option not found in week', async () => {
      const mockWeek = createMockWeek();
      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(null);
      vi.mocked(nflGameModel.getNflGameById).mockResolvedValueOnce({
        id: 'game-1',
        gameStartTime: futureDate,
      } as any);

      await expect(
        action(createMockRequest(standardOptionId, 'invalid-id')),
      ).rejects.toThrow('Deep QB Streaming Option not found');
    });

    it('should throw error when game not found', async () => {
      const mockWeek = createMockWeek();
      vi.mocked(qbStreamingWeekModel.getQBStreamingWeek).mockResolvedValue(
        mockWeek as any,
      );
      vi.mocked(qbSelectionModel.getQBSelection).mockResolvedValue(null);
      vi.mocked(nflGameModel.getNflGameById).mockResolvedValue(null);

      await expect(
        action(createMockRequest(standardOptionId, deepOptionId)),
      ).rejects.toThrow('Game not found');
    });

    it('should throw error when standardPlayerId is not a string', async () => {
      const formData = new FormData();
      formData.set('standardPlayerId', '');
      formData.delete('standardPlayerId'); // Make it undefined
      formData.set('deepPlayerId', deepOptionId);

      const request: ActionFunctionArgs = {
        params: { id: weekId },
        request: new Request('http://localhost', {
          method: 'POST',
          body: formData,
        }),
        context: {},
      };

      await expect(action(request)).rejects.toThrow(
        'Bad form submit for standardPlayerId',
      );
    });
  });
});
