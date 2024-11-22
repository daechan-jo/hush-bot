import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnchProduct } from '../../entities/onchProduct.entity';
import { UpdatedProduct } from '../../entities/updatedProduct.entity';
import { CoupangProduct } from '../../entities/coupangProduct.entity';

export class PriceRepository {
  constructor(
    @InjectRepository(UpdatedProduct)
    private readonly onchRepository: Repository<OnchProduct>,
    private readonly dataSource: DataSource,
  ) {}

  async saveUpdateProducts(products: Partial<OnchProduct>[]) {
    return await this.onchRepository.save(products);
  }

  async getProducts() {
    return await this.dataSource
      .createQueryBuilder()
      .select([
        'c.id AS "coupangId"',
        'c.productCode AS "coupangProductCode"',
        'c.price AS "coupangPrice"',
        'c.shippingCost AS "coupangShippingCost"',
        'c.isWinner AS "coupangIsWinner"',
        'o.sellerPrice AS "onchSellerPrice"',
        'o.shippingCost AS "onchShippingCost"',
      ])
      .from(CoupangProduct, 'c')
      .innerJoin(OnchProduct, 'o', 'c.productCode = o.productCode')
      .where('c.id IS NOT NULL')
      .andWhere('c.productCode IS NOT NULL')
      .andWhere('c.price IS NOT NULL')
      .andWhere('c.shippingCost IS NOT NULL')
      .andWhere('c.isWinner IS NOT NULL')
      .andWhere('o.sellerPrice IS NOT NULL')
      .andWhere('o.shippingCost IS NOT NULL')
      .getRawMany();
  }
}
