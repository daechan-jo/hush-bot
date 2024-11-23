import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnchProduct } from '../../entities/onchProduct.entity';
import { UpdatedProduct } from '../../entities/updatedProduct.entity';
import { CoupangProduct } from '../../entities/coupangProduct.entity';
import { CronVersion } from '../../entities/cronVersion.entity';

export class PriceRepository {
  constructor(
    @InjectRepository(UpdatedProduct)
    private readonly updatedProductRepository: Repository<UpdatedProduct>,
    @InjectRepository(CronVersion)
    private readonly cronVersionRepository: Repository<CronVersion>,
    private readonly dataSource: DataSource,
  ) {}

  async createCronVersion(cronId: string): Promise<number> {
    const result = await this.cronVersionRepository
      .createQueryBuilder()
      .insert()
      .into('cron_version')
      .values({ cronId })
      .returning('id')
      .execute();

    return result.generatedMaps[0].id;
  }

  async saveUpdateProducts(products: Partial<UpdatedProduct>[], cronVersionId: number) {
    const productsWithVersion = products.map((product) => ({
      ...product,
      cronVersion: { id: cronVersionId },
    }));

    return await this.updatedProductRepository.save(productsWithVersion);
  }

  async getProducts() {
    return await this.dataSource
      .createQueryBuilder()
      .select([
        'c.id AS "coupangId"',
        'c.sellerProductId AS "sellerProductId"',
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

  async getUpdatedProducts(cronVersionId: number) {
    return this.updatedProductRepository.find({
      where: { cronVersion: { id: cronVersionId } },
      relations: ['cronVersion'],
    });
  }
}
