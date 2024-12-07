import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import moment from 'moment';

import { CronType } from '../../types/enum.type';
import { CoupangService } from '../coupang/coupang.service';
import { MailService } from '../mail/mail.service';
import { OnchService } from '../onch/onch.service';
import { PuppeteerService } from '../puppeteer/puppeteer.service';

@Injectable()
export class ConformService {
  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly coupangService: CoupangService,
    private readonly onchService: OnchService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async deleteConfirmedProducts(cronId: string) {
    const coupangPage = await this.puppeteerService.loginToCoupangSite();

    // 쿠팡 페이지에서 상품 코드 추출
    await coupangPage.goto(
      `https://wing.coupang.com/vendor-inventory/list?searchKeywordType=ALL&searchKeywords=&salesMethod=ALL&productStatus=ALL&stockSearchType=ALL&shippingFeeSearchType=ALL&displayCategoryCodes=&listingStartTime=null&listingEndTime=null&saleEndDateSearchType=ALL&bundledShippingSearchType=ALL&displayDeletedProduct=false&shippingMethod=ALL&exposureStatus=NON_CONFORMING_ATTR&locale=ko_KR&sortMethod=SORT_BY_REGISTRATION_DATE&countPerPage=50&page=1`,
      { timeout: 0 },
    );
    await coupangPage.waitForNavigation({ waitUntil: 'networkidle0' });

    try {
      console.log(`${CronType.CONFORM}${cronId}: 컨펌 상품 확인중...`);
      await coupangPage.waitForSelector('tr.inventory-line', { timeout: 6000 });
    } catch (err) {
      console.log(`${CronType.CONFORM}${cronId}: 새로운 컨펌 상품이 없습니다`);
      await this.puppeteerService.closeAllPages();
      return;
    }

    const conformProductCodes = await coupangPage.evaluate(() => {
      return Array.from(document.querySelectorAll('tr.inventory-line'))
        .map((row) => {
          return row.querySelector('.ip-title')?.textContent?.trim().split(' ')[0] || null;
        })
        .filter((code) => code !== null);
    });
    await this.puppeteerService.closeAllPages();

    const coupangProducts = await this.coupangService.fetchCoupangSellerProducts(
      cronId,
      CronType.CONFORM,
    );

    const matchedProducts = coupangProducts.filter((product) =>
      conformProductCodes.some((code) => product.sellerProductName.includes(code)),
    );

    console.log(`${CronType.CONFORM}${cronId}: 컨펌 상품\n`, matchedProducts);

    // 쿠팡에서 중지 및 삭제
    await this.coupangService.stopSaleForMatchedProducts(cronId, CronType.CONFORM, matchedProducts);
    await this.coupangService.deleteProducts(cronId, CronType.CONFORM, matchedProducts);

    // OnChannel 사이트 로그인 후 페이지 열기
    const onchPage = await this.puppeteerService.loginToOnchSite();

    await this.onchService.deleteProducts(cronId, CronType.CONFORM, onchPage, matchedProducts);

    await this.puppeteerService.closeAllPages();
  }

  async conformCron(cronId: string, retryCount = 1) {
    try {
      const nowTime = moment().format('HH:mm:ss');
      console.log(`${CronType.CONFORM}${cronId}-${nowTime}: 시작`);

      await this.deleteConfirmedProducts(cronId);
    } catch (error) {
      console.error(`${CronType.ERROR}${CronType.CONFORM}${cronId}: 오류 발생\n`, error);
      if (retryCount < 10) {
        console.log(`${CronType.CONFORM}${cronId}: ${retryCount + 1}번째 재시도 예정`);
        setTimeout(() => this.conformCron(cronId, retryCount + 1), 3000);
      } else {
        console.error(`${CronType.ERROR}${CronType.CONFORM}${cronId}: 재시도 횟수 초과`);
        await this.mailService.sendErrorMail(
          CronType.CONFORM,
          this.configService.get<string>('STORE'),
          cronId,
        );
      }
    } finally {
      console.log(`${CronType.CONFORM}${cronId}: 종료`);
    }
  }
}
