import { Module } from '@nestjs/common';
import { CoupangModule } from '../coupang/coupang.module';
import { ShippingService } from './shipping.service';
import { UtilModule } from '../util/util.module';

@Module({
  imports: [CoupangModule, UtilModule],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
