import { forwardRef, Module } from '@nestjs/common';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { CoupangModule } from '../coupang/coupang.module';
import { PriceService } from './price.service';
import { OnchModule } from '../onch/onch.module';
import { OnchProduct } from '../../entities/onchProduct.entity';
import { UpdatedProduct } from '../../entities/updatedProduct.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceRepository } from './price.repository';
import { UtilModule } from '../util/util.module';
import { CronVersion } from '../../entities/cronVersion.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnchProduct, UpdatedProduct, CronVersion]),
    PuppeteerModule,
    UtilModule,
    forwardRef(() => CoupangModule),
    OnchModule,
  ],
  providers: [PriceService, PriceRepository],
  exports: [PriceService, PriceRepository],
})
export class PriceModule {}
