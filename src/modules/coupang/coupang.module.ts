import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoupangRepository } from './coupang.repository';
import { CoupangService } from './coupang.service';
import { CoupangProduct } from '../../entities/coupangProduct.entity';
import { MailModule } from '../mail/mail.module';
import { PriceModule } from '../price/price.module';
import { UtilModule } from '../util/util.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CoupangProduct]),
    MailModule,
    forwardRef(() => PriceModule),
    UtilModule,
  ],
  providers: [CoupangService, CoupangRepository],
  exports: [CoupangService, CoupangRepository],
})
export class CoupangModule {}
