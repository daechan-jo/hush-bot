import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { OnchProduct } from '../../entities/onchProduct.entity';

export class OnchRepository {
  constructor(
    @InjectRepository(OnchProduct)
    private readonly onchRepository: Repository<OnchProduct>,
    private readonly dataSource: DataSource,
  ) {}

  async saveOnchProductDetails(details: OnchProduct[]) {
    await this.onchRepository.save(details);
  }

  async getOnchProducts() {
    return await this.onchRepository.find();
  }

  async clearOnchProducts() {
    return await this.dataSource.query('TRUNCATE TABLE "onch_product" CASCADE');
  }
}
