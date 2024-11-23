import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnchProduct } from '../../entities/onchProduct.entity';

export class OnchRepository {
  constructor(
    @InjectRepository(OnchProduct)
    private readonly onchRepository: Repository<OnchProduct>,
  ) {}

  async saveOnchProductDetails(details: OnchProduct[]) {
    await this.onchRepository.save(details);
  }

  async getOnchProducts() {
    return await this.onchRepository.find();
  }

  async clearOnchProducts() {
    return await this.onchRepository.clear();
  }
}
