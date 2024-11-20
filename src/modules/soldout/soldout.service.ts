import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataService } from '../data/data.service';
import { CoupangService } from '../coupang/coupang.service';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { TaskService } from '../task/task.service';
import { OnchService } from '../onch/onch.service';
import { Page } from 'puppeteer';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class SoldoutService {
  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly dataService: DataService,
    private readonly coupangService: CoupangService,
    private readonly taskService: TaskService,
    private readonly onchService: OnchService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async soldoutProductsManagement() {
    const onchPage = await this.puppeteerService.loginToOnchSite();

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
    console.log('마지막 실행 시간:', lastCronTime);

    // 온채널 품절 상품 페이지에서 상품코드 추출
    const productCodes = await this.onchService.crawlingOnchSoldoutProducts(onchPage, lastCronTime);

    this.dataService.setLastCronTime(new Date());

    console.log('품절 상품 코드', productCodes.stockProductCodes);
    const coupangProducts = await this.coupangService.fetchCoupangSellerProducts();

    await this.deleteMatchProducts(onchPage, productCodes, coupangProducts);
    await this.redis.set('lastRun', new Date().toISOString());
  }

  async deleteMatchProducts(
    onchPage: Page,
    productCodes: { stockProductCodes: any; productDates?: string[] },
    coupangProducts: any[],
  ) {
    const matchedProducts = coupangProducts.filter((product) =>
      productCodes.stockProductCodes.includes(
        product.sellerProductName.match(/(CH\d{7})/)?.[0] || '',
      ),
    );

    console.log('일치하는 품절 쿠팡 상품:', matchedProducts);

    await this.coupangService.stopSaleForMatchedProducts(matchedProducts);
    await this.coupangService.deleteProducts(matchedProducts, '품절');
    await this.onchService.deleteProducts(onchPage, matchedProducts);

    await this.puppeteerService.closeAllPages();
  }

  @Cron('0 */5 * * * *')
  async soldOutCron() {
    const isLocked = await this.redis.get('lock');

    if (isLocked) {
      console.log('품절 상품 크론: 현재 다른 작업이 진행 중입니다. 잠금을 획득하지 못했습니다.');
      return;
    }

    try {
      // Redis 락 설정
      await this.redis.set('lock', 'locked');
      console.log('품절 상품 크론: 시작');

      // 크론 작업 실행
      await this.soldoutProductsManagement();
    } catch (error) {
      console.error('크론 작업 중 오류 발생:', error);
    } finally {
      // 락 해제 (서비스 종료 시점)
      await this.redis.del('lock');
      console.log('품절 상품 크론: 종료');
    }
  }
}
