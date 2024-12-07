import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { UnityService } from './unity.service';
import { ConformModule } from '../conform/conform.module';
import { OrderModule } from '../order/order.module';
import { ShippingModule } from '../shipping/shipping.module';
import { SoldoutModule } from '../soldout/soldout.module';
import { UtilModule } from '../util/util.module';

@Module({
  imports: [SoldoutModule, ConformModule, OrderModule, ConfigModule, UtilModule, ShippingModule],
  providers: [UnityService],
  exports: [UnityService],
})
export class UnityModule {}
