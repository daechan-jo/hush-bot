import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CoupangService } from '../coupang/coupang.service';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { OnchService } from '../onch/onch.service';
import { Page } from 'puppeteer';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { UtilService } from '../util/util.service';
import { CronType } from '../../types/enum.types';

@Injectable()
export class SoldoutService {
  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly coupangService: CoupangService,
    private readonly onchService: OnchService,
    private readonly utilService: UtilService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async soldoutProductsManagement(cronId: string) {
    const onchPage = await this.puppeteerService.loginToOnchSite();
    console.log(`${CronType.SOLDOUT}${cronId}: 온채널 로그인...`);

    onchPage.on('console', (msg) => {
      for (let i = 0; i < msg.args().length; ++i) console.log(`${i}: ${msg.args()[i]}`);
    });

    await onchPage.goto(
      'https://www.onch3.co.kr/admin_mem_clo_list_2.php?ost=&sec=clo&ol=&npage=',
      {
        timeout: 0,
      },
    );
    await onchPage.waitForSelector('td.title_4.sub_title', { timeout: 0 });

    const lastCronTimeString = await this.redis.get('lastRun');
    const lastCronTime = lastCronTimeString ? new Date(lastCronTimeString) : null;
    console.log(`${CronType.SOLDOUT}${cronId}: 마지막 실행 시간 ${lastCronTime}`);

    console.log(`${CronType.SOLDOUT}${cronId}: 온채널 품절 상품 탐색...`);
    const productCodes = await this.onchService.crawlingOnchSoldoutProducts(onchPage, lastCronTime);
    if (productCodes.stockProductCodes.length === 0) {
      console.log(`${CronType.SOLDOUT}${cronId}: 품절 상품이 없습니다.`);
      await this.puppeteerService.closeAllPages();
      return;
    }
    console.log(
      `${CronType.SOLDOUT}${cronId}: 온채널 품절 상품\n${productCodes.stockProductCodes}`,
    );

    const coupangProducts = await this.coupangService.fetchCoupangSellerProducts(
      cronId,
      CronType.SOLDOUT,
    );
    console.log(`${CronType.SOLDOUT}${cronId}: 쿠팡 판매 상품 리스트업...`);

    await this.deleteMatchProducts(cronId, onchPage, productCodes, coupangProducts);
    await this.redis.set('lastRun', new Date().toISOString());
  }

  async deleteMatchProducts(
    cronId: string,
    onchPage: Page,
    productCodes: { stockProductCodes: any; productDates?: string[] },
    coupangProducts: any[],
  ) {
    const matchedProducts = coupangProducts.filter((product) =>
      productCodes.stockProductCodes.includes(
        product.sellerProductName.match(/(CH\d{7})/)?.[0] || '',
      ),
    );
    console.log(`${CronType.SOLDOUT}${cronId}: 품절 상품 매칭...`);

    if (matchedProducts.length > 0) {
      console.log(`${CronType.SOLDOUT}${cronId}: 매치된 상품이 없습니다.`);
      return;
    }

    await this.coupangService.stopSaleForMatchedProducts(cronId, CronType.SOLDOUT, matchedProducts);
    await this.coupangService.deleteProducts(cronId, CronType.SOLDOUT, matchedProducts);
    await this.onchService.deleteProducts(cronId, CronType.SOLDOUT, onchPage, matchedProducts);

    await this.puppeteerService.closeAllPages();
  }

  @Cron('0 */5 * * * *')
  async soldOutCron() {
    const isLocked = await this.redis.get('lock');
    const cronId = this.utilService.generateCronId();

    if (isLocked) {
      console.log(`${CronType.SOLDOUT}${cronId}: 락 획득 실패`);
      return;
    }

    try {
      await this.redis.set('lock', 'locked');
      console.log(`${CronType.SOLDOUT}${cronId}: 시작`);

      await this.soldoutProductsManagement(cronId);
    } catch (error) {
      console.error(`${CronType.ERROR}${CronType.SOLDOUT}${cronId}:`, error);
    } finally {
      await this.redis.del('lock');
      console.log(`${CronType.SOLDOUT}${cronId}: 종료`);
    }
  }
}
