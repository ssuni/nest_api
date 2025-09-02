import { Test, TestingModule } from '@nestjs/testing';
import { TripMoneyResolver } from './trip-money.resolver';
import { TripMoneyService } from './trip-money.service';

describe('TripMoneyResolver', () => {
  let resolver: TripMoneyResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TripMoneyResolver, TripMoneyService],
    }).compile();

    resolver = module.get<TripMoneyResolver>(TripMoneyResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
