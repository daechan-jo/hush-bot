import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderService } from './order.service';
import { CronVersion } from '../../entities/cronVersion.entity';
import { OnchProduct } from '../../entities/onchProduct.entity';
import { UpdatedProduct } from '../../entities/updatedProduct.entity';
import { CoupangModule } from '../coupang/coupang.module';
import { OnchModule } from '../onch/onch.module';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { UtilModule } from '../util/util.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnchProduct, UpdatedProduct, CronVersion]),
    ConfigModule,
    PuppeteerModule,
    UtilModule,
    forwardRef(() => CoupangModule),
    OnchModule,
  ],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
