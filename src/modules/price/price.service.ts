import { Injectable } from '@nestjs/common';
import { PuppeteerService } from '../auth/puppeteer.service';
import { DataService } from '../data/data.service';
import { CoupangService } from '../coupang/coupang.service';
import { Page } from 'puppeteer';

@Injectable()
export class PriceService {
  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly dataService: DataService,
    private readonly coupangService: CoupangService,
  ) {}

  async crawlSaleProducts() {
    const onchPage = await this.puppeteerService.loginToOnchSite();

    onchPage.on('console', (msg) => {
      for (let i = 0; i < msg.args().length; ++i) console.log(`${i}: ${msg.args()[i]}`);
    });

    let allProductIds = [];
    // const currentPage = 1;

    // while (true) {
    //   await onchPage.goto(`https://www.onch3.co.kr/admin_mem_prd_list.html?page=${currentPage}`);
    //
    //   // 현재 페이지에서 상품 고유번호 추출
    //   const productIds = await page.evaluate(() => {
    //     const links = Array.from(
    //       document.querySelectorAll('a[href^="./dbcenter_renewal/dbcenter_view.html?num="]'),
    //     );
    //     return links
    //       .map((link) => {
    //         const match = link.getAttribute('href')?.match(/num=(\d+)/);
    //         return match ? match[1] : null;
    //       })
    //       .filter((id) => id !== null);
    //   });
    //
    //   // 상품 ID가 없으면 크롤링 중지
    //   if (productIds.length === 0) {
    //     console.log(`크롤링 중지 마지막 페이지: ${currentPage}`);
    //     break;
    //   }
    //
    //   allProductIds.push(...productIds);
    //
    //   currentPage++;
    // }

    allProductIds = [
      '9999109',
      '9999106',
      '10469854',
      '11122056',
      '11122152',
      '11122551',
      '11123932',
      '11123930',
      '11126160',
      '11127978',
      '11128632',
      '11129016',
      '11129014',
      '11129119',
      '11129174',
      '11129272',
      '11130011',
      '11129981',
      '11130056',
      '11130055',
      '11130132',
      '11130843',
      '11130874',
      '11133665',
      '11135838',
      '11136140',
      '11136420',
      '11136530',
      '11138815',
      '11138905',
      '11139097',
      '11139096',
      '11139091',
      '11139162',
      '11139160',
      '11139158',
      '11139823',
      '11139821',
      '11141036',
      '11141189',
      '11146051',
      '11146054',
      '11146052',
      '11147109',
      '11147363',
      '11147395',
      '11147636',
      '11148254',
      '11148753',
      '11149277',
      '11149334',
      '11150133',
      '11150131',
      '11176357',
      '9534950',
      '9542129',
      '9542128',
      '9558775',
      '9788986',
      '9827357',
      '9833757',
      '9833990',
      '9834709',
      '9834882',
      '9883333',
      '9897328',
      '10004379',
      '10004589',
      '10004929',
      '10004980',
      '10007800',
      '10007838',
      '10007865',
      '10008499',
      '10008551',
      '10075310',
      '10105584',
      '10115797',
      '10148217',
      '10177927',
      '10178518',
      '10179984',
      '10190676',
      '10303855',
      '10719629',
      '10863047',
      '10995872',
      '10997636',
      '11126816',
      '11129916',
      '11130991',
      '9455775',
      '11123711',
      '11123862',
      '11123851',
      '11123960',
      '11124383',
      '11124440',
      '11124579',
      '11124857',
    ];

    console.log('자동 가격 조절: 온채널 판매상품 리스트업 완료');
    await this.crawlOnchDetailProducts(onchPage, allProductIds);
  }

  async crawlOnchDetailProducts(onchPage: Page, allProductIds: number[]) {
    let onchProductDetails = [];

    // for (const productId of allProductIds) {
    //   await onchPage.goto(
    //     `https://www.onch3.co.kr/dbcenter_renewal/dbcenter_view.html?num=${productId}`,
    //     { timeout: 0 },
    //   );
    //
    //   // 소비자가, 판매가, 일반 배송비 추출
    //   const details = await onchPage.evaluate(() => {
    //     const getTextContent = (selector: string) =>
    //       document
    //         .querySelector(selector)
    //         ?.textContent?.trim()
    //         .replace(/[^0-9]/g, '');

    // const productCodeElement = Array.from(document.querySelectorAll('li')).find((li) =>
    // 	li.querySelector('.prod_detail_title')?.textContent?.includes('제품코드'),
    // );
    // const productCode = productCodeElement?.querySelector('div:nth-child(2)')?.textContent.trim() || null;
    //
    //     // 소비자가
    //     const consumerPrice = getTextContent('.price_info li:nth-child(1) .prod_cus_price') || null;
    //
    //     // 판매사가
    //     const sellerPrice = getTextContent('.price_info li:nth-child(2) div:nth-child(2)') || null;
    //
    //     // 배송비
    //     const shippingCostElement = Array.from(document.querySelectorAll('li')).find((li) =>
    //       li.querySelector('.prod_detail_title')?.textContent?.includes('택배비/택배사'),
    //     );
    //     const shippingCostText =
    //       shippingCostElement?.querySelector('div:nth-child(2)')?.textContent || '';
    //     const shippingCostMatch = shippingCostText.match(/일반\s([\d,]+)원/);
    //     const shippingCost = shippingCostMatch ? shippingCostMatch[1].replace(/,/g, '') : null;
    //
    //     return {
    // productCode,
    //       consumerPrice,
    //       sellerPrice,
    //       shippingCost,
    //     };
    //   });
    //
    //   onchProductDetails.push(details);
    // }

    onchProductDetails = [
      {
        productId: '9999109',
        consumerPrice: '10220',
        sellerPrice: '7900',
        shippingCost: '3000',
      },
      {
        productId: '9999106',
        consumerPrice: '10370',
        sellerPrice: '8010',
        shippingCost: '3000',
      },
    ];

    console.log('자동 가격 조절: 온채널 판매상품 상세정보 크롤링 완료');
    await this.crawlCoupangDetailProducts(onchProductDetails, onchPage);
  }

  async crawlCoupangDetailProducts(onchProductDetails: any[], onchPage: Page) {
    const coupangPage = await this.puppeteerService.loginToCoupangSite(onchPage);

    await coupangPage.goto(
      'https://wing.coupang.com/vendor-inventory/list?searchKeywordType=ALL&searchKeywords=&salesMethod=ALL&productStatus=ALL&stockSearchType=ALL&shippingFeeSearchType=ALL&displayCategoryCodes=&listingStartTime=null&listingEndTime=null&saleEndDateSearchType=ALL&bundledShippingSearchType=ALL&displayDeletedProduct=false&shippingMethod=ALL&exposureStatus=ALL&locale=ko_KR&sortMethod=SORT_BY_ITEM_LEVEL_UNIT_SOLD&countPerPage=50&page=1',
    );

    let isLastPage = false;
    let currentPage = 1;
    const coupangProductDetails = [];

    console.log('자동 가격 조절: 쿠팡 크롤링 시작');

    while (!isLastPage) {
      // 페이지 끝까지 스크롤
      await coupangPage.evaluate(async () => {
        window.scrollBy(0, document.body.scrollHeight);
        await new Promise((resolve) => setTimeout(resolve, 3000)); // 로딩 시간 기다림
      });

      // 상품 정보 크롤링
      const productsOnPage = await coupangPage.evaluate(() => {
        const getPrice = (text: string) => text?.replace(/[^0-9]/g, '') || null;

        return Array.from(document.querySelectorAll('.ip-title')).map((product) => {
          const productCode = product.textContent?.trim().split(' ')[0] || null;

          const isWinner =
            document.querySelector('.ies-top')?.textContent?.includes('아이템위너') || false;

          const priceText = document.querySelector('.isp-top')?.textContent || '';
          const shippingText = document.querySelector('.isp-bottom')?.textContent || '';

          console.log({
            productCode,
            isWinner,
            price: getPrice(priceText),
            shippingCost: getPrice(shippingText),
          });
          return {
            productCode,
            isWinner,
            price: getPrice(priceText),
            shippingCost: getPrice(shippingText),
          };
        });
      });

      coupangProductDetails.push(...productsOnPage);

      // 다음 페이지로 이동 (없다면 종료)
      const nextPageButton = await coupangPage.$(`button[aria-label="Page ${currentPage + 1}"]`);
      if (nextPageButton) {
        await nextPageButton.click();
        await coupangPage.waitForNavigation({ waitUntil: 'networkidle0' });
        currentPage++;
      } else {
        isLastPage = true;
      }
    }

    console.log('모든 상품 상세 정보:', coupangProductDetails);
    await this.puppeteerService.close();
  }

  // @Cron('0 */60 * * * *')
  async autoPriceCron() {
    console.log('자동 가격 조절: 시작');
    await this.puppeteerService.init();
    await this.crawlSaleProducts();
    console.log('자동 가격 조절: 종료');
  }
}
