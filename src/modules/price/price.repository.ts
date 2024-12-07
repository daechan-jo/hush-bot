import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { CoupangProduct } from '../../entities/coupangProduct.entity';
import { CronVersion } from '../../entities/cronVersion.entity';
import { OnchProduct } from '../../entities/onchProduct.entity';
import { UpdatedItem } from '../../entities/updatedItem.entity';

export class PriceRepository {
  constructor(
    @InjectRepository(UpdatedItem)
    private readonly updatedItemRepository: Repository<UpdatedItem>,
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

  async saveUpdateItems(items: Partial<UpdatedItem>[], cronVersionId: number) {
    const productsWithVersion = items.map((item) => ({
      ...item,
      cronVersion: { id: cronVersionId },
    }));

    return await this.updatedItemRepository.save(productsWithVersion);
  }

  // async getProducts() {
  //   return await this.dataSource
  //     .createQueryBuilder()
  //     .select([
  //       'c.id AS "coupangId"',
  //       'c.sellerProductId AS "sellerProductId"',
  //       'c.productCode AS "coupangProductCode"',
  //       'c.price AS "coupangPrice"',
  //       'c.shippingCost AS "coupangShippingCost"',
  //       'c.isWinner AS "coupangIsWinner"',
  //       'o.sellerPrice AS "onchSellerPrice"',
  //       'o.shippingCost AS "onchShippingCost"',
  //     ])
  //     .from(CoupangProduct, 'c')
  //     .innerJoin(OnchProduct, 'o', 'c.productCode = o.productCode')
  //     .where('c.id IS NOT NULL')
  //     .andWhere('c.productCode IS NOT NULL')
  //     .andWhere('c.price IS NOT NULL')
  //     .andWhere('c.shippingCost IS NOT NULL')
  //     .andWhere('c.isWinner IS NOT NULL')
  //     .andWhere('o.sellerPrice IS NOT NULL')
  //     .andWhere('o.shippingCost IS NOT NULL')
  //     .getRawMany();
  // }

  async getProducts() {
    const rawProducts = await this.dataSource
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
        'i.itemName AS "itemName"',
        'i.consumerPrice AS "itemConsumerPrice"',
        'i.sellerPrice AS "itemSellerPrice"',
      ])
      .from(CoupangProduct, 'c')
      .innerJoin(OnchProduct, 'o', 'c.productCode = o.productCode')
      .leftJoin('o.onchItems', 'i')
      .where('c.id IS NOT NULL')
      .andWhere('c.productCode IS NOT NULL')
      .andWhere('c.price IS NOT NULL')
      .andWhere('c.shippingCost IS NOT NULL')
      .andWhere('c.isWinner IS NOT NULL')
      .andWhere('o.sellerPrice IS NOT NULL')
      .andWhere('o.shippingCost IS NOT NULL')
      .getRawMany();

    const groupedProducts = rawProducts.reduce((acc, curr) => {
      // 상품 키로 그룹화
      const productKey = curr.coupangId;

      if (!acc[productKey]) {
        // 최초 상품 생성
        acc[productKey] = {
          coupangId: curr.coupangId,
          sellerProductId: curr.sellerProductId,
          coupangProductCode: curr.coupangProductCode,
          coupangPrice: curr.coupangPrice,
          coupangShippingCost: curr.coupangShippingCost,
          coupangIsWinner: curr.coupangIsWinner,
          onchSellerPrice: curr.onchSellerPrice,
          onchShippingCost: curr.onchShippingCost,
          onchItems: [],
        };
      }

      // 아이템 데이터 추가
      if (curr.itemName) {
        acc[productKey].onchItems.push({
          itemName: curr.itemName,
          consumerPrice: curr.itemConsumerPrice,
          sellerPrice: curr.itemSellerPrice,
        });
      }

      return acc;
    }, {});

    // 객체를 배열로 변환
    return Object.values(groupedProducts);
  }

  async getUpdatedItems(cronVersionId: number) {
    return this.updatedItemRepository.find({
      where: { cronVersion: { id: cronVersionId } },
      relations: ['cronVersion'],
    });
  }
}
