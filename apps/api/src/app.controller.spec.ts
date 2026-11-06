
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  const mockAppService = {
    getHello: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the database connection status', async () => {
      const expectedMessage =
        'Database connected successfully. Total users: 5';

      mockAppService.getHello.mockResolvedValue(expectedMessage);

      const result = await appController.getHello();

      expect(result).toBe(expectedMessage);
      expect(mockAppService.getHello).toHaveBeenCalledOnce();
    });
  });
});
