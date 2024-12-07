import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PriceRepository } from './price.repository';
import { PriceService } from './price.service';
import { CronVersion } from '../../entities/cronVersion.entity';
import { OnchItem } from '../../entities/onchItem.entity';
import { OnchProduct } from '../../entities/onchProduct.entity';
import { UpdatedItem } from '../../entities/updatedItem.entity';
import { CoupangModule } from '../coupang/coupang.module';
import { MailModule } from '../mail/mail.module';
import { OnchModule } from '../onch/onch.module';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { UtilModule } from '../util/util.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnchProduct, UpdatedItem, CronVersion, OnchItem]),
    ConfigModule,
    PuppeteerModule,
    UtilModule,
    forwardRef(() => CoupangModule),
    OnchModule,
    MailModule,
  ],
  providers: [PriceService, PriceRepository],
  exports: [PriceService, PriceRepository],
})
export class PriceModule {}
