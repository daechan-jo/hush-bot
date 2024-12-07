import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import moment from 'moment-timezone';
import { Page } from 'puppeteer';

import { CronType } from '../../types/enum.type';
import { CoupangService } from '../coupang/coupang.service';
import { OnchService } from '../onch/onch.service';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { UtilService } from '../util/util.service';

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

    try {
      await onchPage.waitForSelector('td.title_4.sub_title', { timeout: 3000 });
    } catch (error) {
      console.log(`${CronType.SOLDOUT}${cronId}: 데이터없음`);
      console.log(`${CronType.SOLDOUT}${cronId}: 종료`);
    }

    const lastCronTimeString = await this.redis.get('lastRun:soldout');
    let lastCronTime: Date;

    if (lastCronTimeString) {
      lastCronTime = this.utilService.convertKoreaTime(lastCronTimeString);

      console.log(`${CronType.SOLDOUT}${cronId}: 마지막 실행 시간 ${lastCronTime}`);
    } else {
      lastCronTime = this.utilService.createYesterdayKoreaTime();

      await this.redis.set('lastRun:soldout', moment.tz('Asia/Seoul').toISOString());

      console.log(
        `${CronType.SOLDOUT}${cronId}: 마지막 실행시간이 없습니다. 24시간 전으로 설정합니다.`,
      );
    }

    await this.redis.set('lastRun:soldout', moment.tz('Asia/Seoul').toISOString());

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

    console.log(`${CronType.SOLDOUT}${cronId}: 쿠팡 판매 상품 리스트업...`);
    const coupangProducts = await this.coupangService.fetchCoupangSellerProducts(
      cronId,
      CronType.SOLDOUT,
    );

    await this.deleteMatchProducts(cronId, onchPage, productCodes, coupangProducts);
  }

  async deleteMatchProducts(
    cronId: string,
    onchPage: Page,
    productCodes: { stockProductCodes: any; productDates?: string[] },
    coupangProducts: any[],
  ) {
    console.log(`${CronType.SOLDOUT}${cronId}: 품절 상품 매칭...`);

    const matchedProducts = coupangProducts.filter((product) => {
      const extractedCode = product.sellerProductName.match(/(CH\d{7})/)?.[0] || '';
      return productCodes.stockProductCodes.includes(extractedCode);
    });

    if (matchedProducts.length === 0) {
      console.log(`${CronType.SOLDOUT}${cronId}: 매치된 상품이 없습니다.`);
      return;
    }

    console.log(`${CronType.SOLDOUT}${cronId}: 품절 ${matchedProducts.length}개`);

    await this.coupangService.stopSaleForMatchedProducts(cronId, CronType.SOLDOUT, matchedProducts);
    await this.coupangService.deleteProducts(cronId, CronType.SOLDOUT, matchedProducts);
    await this.onchService.deleteProducts(cronId, CronType.SOLDOUT, onchPage, matchedProducts);

    await this.puppeteerService.closeAllPages();
  }

  async soldOutCron(cronId: string) {
    try {
      const nowTime = moment().format('HH:mm:ss');
      console.log(`${CronType.SOLDOUT}${cronId}-${nowTime}: 품절상품 삭제 크론 시작`);

      await this.soldoutProductsManagement(cronId);
    } catch (error) {
      console.error(`${CronType.ERROR}${CronType.SOLDOUT}${cronId}:`, error);
    } finally {
      console.log(`${CronType.SOLDOUT}${cronId}: 품절상품 삭제 작업 종료`);
    }
  }
}
