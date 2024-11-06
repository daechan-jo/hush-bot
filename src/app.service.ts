import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DataService } from './data.service';
import { CoupangService } from './coupang.service';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataService: DataService,
    private readonly coupangService: CoupangService,
  ) {}

  private browser: puppeteer.Browser;

  async init() {
    this.browser = await puppeteer.launch({
      headless: true,
    });
  }

  async loginToSite() {
    const page = await this.browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Safari/537.36',
    );

    // 로그인 페이지
    await page.goto('https://www.onch3.co.kr/login/login_web.php');

    // 이메일과 비밀번호 입력
    await page.type(
      'input[placeholder="온채널 또는 통합계정 아이디"]',
      this.configService.get<string>('ON_CHANNEL_EMAIL'),
    );
    await page.type(
      'input[placeholder="비밀번호 입력"]',
      this.configService.get<string>('ON_CHANNEL_PASSWORD'),
    );

    // 로그인 버튼 클릭
    await page.click('button[name="login"]');
    await page.waitForNavigation();

    return page;
  }

  async crawlForNewProducts() {
    const page = await this.loginToSite();

    page.on('console', (msg) => {
      for (let i = 0; i < msg.args().length; ++i) console.log(`${i}: ${msg.args()[i]}`);
    });

    await page.goto('https://www.onch3.co.kr/admin_mem_clo_list_2.php?ost=&sec=clo&ol=&npage=');
    await page.waitForSelector('td.title_4.sub_title', { timeout: 10000 });

    const lastCronTime = this.dataService.getLastCronTime();
    console.log('마지막 실행 시간:', lastCronTime);

    // 품절 상품 페이지에서 상품코드 추출
    const productCodes = await page.evaluate(
      (lastCronTimeMillis) => {
        const rows = Array.from(document.querySelectorAll('tr')); // 모든 행 가져오기
        const stockProductCodes: string[] = [];
        const productDates: string[] = [];

        rows.forEach((row) => {
          const dateCell = row.querySelector('td.title_4.sub_title');
          const codeCell = row.querySelector('td.title_3.sub_title > b');

          if (dateCell && codeCell) {
            const dateText = dateCell.textContent?.trim() || '';
            const codeText = codeCell.textContent?.trim() || '';

            const productDate = new Date(dateText.slice(0, 10) + 'T' + dateText.slice(10));
            productDates.push(productDate.toISOString());

            if (lastCronTimeMillis && productDate.getTime() > lastCronTimeMillis) {
              stockProductCodes.push(codeText);
            }
          }
        });

        return {
          stockProductCodes: Array.from(new Set(stockProductCodes)),
          productDates,
        };
      },
      lastCronTime ? lastCronTime.getTime() : 0,
    );

    this.dataService.setLastCronTime(new Date());

    console.log('품절 상품 코드', productCodes.stockProductCodes);

    const coupangProducts = await this.coupangService.fetchCoupangSellerProducts();

    const matchedProducts = coupangProducts.filter((product) =>
      productCodes.stockProductCodes.includes(
        product.sellerProductName.match(/(CH\d{7})/)?.[0] || '',
      ),
    );

    console.log('일치하는 품절 쿠팡 상품:', matchedProducts);

    await this.coupangService.stopSaleForMatchedProducts(matchedProducts);
    await this.coupangService.deleteProducts(matchedProducts);

    await this.close();
  }

  @Cron('0 */10 * * * *')
  async handleCron() {
    console.log('크롤링 작업 시작');
    await this.init();
    await this.crawlForNewProducts();
    console.log('크롤링 작업 완료');
  }

  async close() {
    await this.browser.close();
  }
}
