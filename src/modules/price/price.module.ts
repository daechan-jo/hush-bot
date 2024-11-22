import { Module } from '@nestjs/common';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { CoupangModule } from '../coupang/coupang.module';
import { PriceService } from './price.service';
import { OnchModule } from '../onch/onch.module';
import { OnchProduct } from '../../entities/onchProduct.entity';
import { UpdatedProduct } from '../../entities/updatedProduct.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceRepository } from './price.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnchProduct, UpdatedProduct]),
    PuppeteerModule,
    CoupangModule,
    OnchModule,
  ],
  providers: [PriceService, PriceRepository],
  exports: [PriceService, PriceRepository],
})
export class PriceModule {}
