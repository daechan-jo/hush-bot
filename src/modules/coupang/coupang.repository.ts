import { CoupangProduct } from '../../entities/coupangProduct.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export class CoupangRepository {
  constructor(
    @InjectRepository(CoupangProduct)
    private readonly coupangRepository: Repository<CoupangProduct>,
  ) {}

  async saveCoupangProductDetails(details: Partial<CoupangProduct>[]) {
    await this.coupangRepository.save(details);
  }

  async getCoupangProducts() {
    return await this.coupangRepository.find();
  }
}
