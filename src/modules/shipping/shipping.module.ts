import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ShippingService } from './shipping.service';
import { CoupangModule } from '../coupang/coupang.module';
import { UtilModule } from '../util/util.module';

@Module({
  imports: [ConfigModule, CoupangModule, UtilModule],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
