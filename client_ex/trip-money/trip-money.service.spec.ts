import { Test, TestingModule } from '@nestjs/testing';
import { TripMoneyService } from './trip-money.service';

describe('TripMoneyService', () => {
  let service: TripMoneyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TripMoneyService],
    }).compile();

    service = module.get<TripMoneyService>(TripMoneyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
