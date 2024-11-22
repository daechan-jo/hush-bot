import { Injectable } from '@nestjs/common';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { CoupangService } from '../coupang/coupang.service';
import { Page } from 'puppeteer';
import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { OnchRepository } from '../onch/onch.repository';
import { CoupangRepository } from '../coupang/coupang.repository';
import { PriceRepository } from './price.repository';

@Injectable()
export class PriceService {
  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly coupangService: CoupangService,
    private readonly onchRepository: OnchRepository,
    private readonly coupangRepository: CoupangRepository,
    private readonly priceRepository: PriceRepository,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async crawlOnchRegisteredProducts() {
    const onchPage = await this.puppeteerService.loginToOnchSite();

    console.log('자동 가격 조절: 온채널 판매상품 리스트업 시작');

    // onchPage.on('console', (msg) => {
    //   for (let i = 0; i < msg.args().length; ++i) console.log(`${i}: ${msg.args()[i]}`);
    // });
    //
    // let currentPage = 1;
    const allProductIds = [];
    //
    // while (true) {
    //   await onchPage.goto(`https://www.onch3.co.kr/admin_mem_prd_list.html?page=${currentPage}`);
    //
    //   // 현재 페이지에서 상품 고유번호 추출
    //   const productIds = await onchPage.evaluate(() => {
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
    //
    // console.log(`자동 가격 조절: 온채널 판매상품 리스트업 완료 (${allProductIds.length} 개)`);
    await this.crawlOnchDetailProducts(onchPage, allProductIds);
  }

  async crawlOnchDetailProducts(onchPage: Page, allProductIds: string[]) {
    const detailsBatch = [];
    console.log('자동 가격 조절: 온채널 판매상품 상세정보 크롤링 시작');
    //
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
    //
    //     const productCodeElement = Array.from(document.querySelectorAll('li')).find((li) =>
    //       li.querySelector('.prod_detail_title')?.textContent?.includes('제품코드'),
    //     );
    //     const productCode =
    //       productCodeElement?.querySelector('div:nth-child(2)')?.textContent.trim() || null;
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
    //       productCode,
    //       consumerPrice,
    //       sellerPrice,
    //       shippingCost,
    //     };
    //   });
    //
    //   detailsBatch.push(details);
    //
    //   // 배치 크기만큼 쌓이면 저장 후 배열 초기화
    //   if (detailsBatch.length >= 50) {
    //     await this.onchRepository.saveOnchProductDetails(detailsBatch);
    //     detailsBatch.length = 0;
    //   }
    // }
    // if (detailsBatch.length > 0) {
    //   await this.onchRepository.saveOnchProductDetails(detailsBatch);
    // }

    console.log('자동 가격 조절: 온채널 판매상품 상세정보 크롤링 완료');
    await this.crawlCoupangDetailProducts(onchPage);
  }

  async crawlCoupangDetailProducts(onchPage: Page) {
    console.log('자동 가격 조절: 쿠팡 크롤링 시작');

    // const coupangPage = await this.puppeteerService.loginToCoupangSite(onchPage);

    // let isLastPage = false;
    // let currentPage = 1;
    //
    // try {
    //   while (!isLastPage) {
    //     console.log('자동 가격 조절: 쿠팡 크롤링 - 페이지', currentPage);
    //
    //     await coupangPage.goto(
    //       `https://wing.coupang.com/vendor-inventory/list?searchKeywordType=ALL&searchKeywords=&salesMethod=ALL&productStatus=ALL&stockSearchType=ALL&shippingFeeSearchType=ALL&displayCategoryCodes=&listingStartTime=null&listingEndTime=null&saleEndDateSearchType=ALL&bundledShippingSearchType=ALL&displayDeletedProduct=false&shippingMethod=ALL&exposureStatus=ALL&locale=ko_KR&sortMethod=SORT_BY_ITEM_LEVEL_UNIT_SOLD&countPerPage=50&page=${currentPage}`,
    //     );
    //     await new Promise((resolve) => setTimeout(resolve, 3000));
    //
    //     await coupangPage.evaluate(async () => {
    //       const scrollStep = 100; // 한 번에 스크롤할 픽셀 수
    //       const scrollDelay = 100; // 스크롤 간 딜레이(ms)
    //
    //       for (let y = 0; y < document.body.scrollHeight; y += scrollStep) {
    //         window.scrollBy(0, scrollStep);
    //         await new Promise((resolve) => setTimeout(resolve, scrollDelay)); // 각 스크롤 간격마다 대기
    //       }
    //     });
    //
    //     await new Promise((resolve) => setTimeout(resolve, 3000));
    //
    //     const productsOnPage = await coupangPage.evaluate(() => {
    //       const getPrice = (text: string) => text?.replace(/[^0-9]/g, '') || null;
    //
    //       // 모든 상품 행을 순회하며 데이터 추출
    //       return Array.from(document.querySelectorAll('tr.inventory-line')).map((row) => {
    //         const ipContentDiv = row.querySelector('.ip-right .ip-content div:nth-child(3)');
    //         const sellerProductId = ipContentDiv
    //           ? ipContentDiv.textContent.replace(/[^0-9]/g, '')
    //           : null;
    //
    //         const productCode =
    //           row.querySelector('.ip-title')?.textContent?.trim().split(' ')[0] || null;
    //
    //         const isWinnerContainer = row.querySelector('.ies-container');
    //         const isWinnerText =
    //           isWinnerContainer
    //             ?.querySelector('.ies-top')
    //             ?.textContent?.trim()
    //             .replace(/\s/g, '') || '';
    //         const isWinner = isWinnerText === 'Itemwinner';
    //
    //         const priceText = row.querySelector('.isp-top')?.textContent || '';
    //         const shippingText = row.querySelector('.isp-bottom')?.textContent || '';
    //
    //         return {
    //           sellerProductId,
    //           productCode,
    //           isWinner,
    //           price: priceText ? parseInt(getPrice(priceText)) : null,
    //           shippingCost: shippingText ? parseInt(getPrice(shippingText)) : null,
    //         };
    //       });
    //     });
    //
    //     console.log(productsOnPage);
    //
    //     await this.coupangRepository.saveCoupangProductDetails(productsOnPage);
    //     // 다음 페이지로 이동 (없다면 종료)
    //     if (productsOnPage.length === 0) {
    //       console.log(`자동 가격 조절: 쿠팡 크롤링 종료`);
    //       isLastPage = true;
    //     } else {
    //       currentPage++;
    //     }
    //   }
    // } finally {
    //   console.log(`자동 가격 조절: 쿠팡 크롤링 종료`);
    // }
    await this.puppeteerService.closeAllPages();

    return await this.calculateMarginAndAdjustPrices();
  }

  async calculateMarginAndAdjustPrices() {
    console.log(`자동 가격 조절: 연산 시작`);

    // JOIN 쿼리 실행
    const products = await this.priceRepository.getProducts();

    const productsBatch = [];

    // 각 상품에 대한 가격 조정 계산
    for (const product of products) {
      const salePrice = Math.round(
        +product.coupangPrice - +product.coupangPrice / 10.8 + +product.coupangShippingCost,
      ); // 판매수익
      const wholesalePrice = +product.onchSellerPrice + +product.onchShippingCost; // 도매비용
      const netProfit = salePrice - wholesalePrice; // 순수익
      const margin = Math.round(wholesalePrice * 0.05); // 목표마진(최소)

      if (netProfit > margin && !product.coupangIsWinner) {
        const requiredDecreaseInRevenue = netProfit - margin;
        const adjustedTotalRevenue = salePrice - requiredDecreaseInRevenue;

        const newPrice = Math.round(
          ((adjustedTotalRevenue - +product.coupangShippingCost) * 10.8) / 9.8,
        );

        if (newPrice < +product.coupangPrice) {
          productsBatch.push({
            sellerProductId: product.coupangId,
            productCode: product.coupangProductCode,
            action: 'down',
            newPrice: Math.round(newPrice),
            currentPrice: product.coupangPrice,
            currentIsWinner: product.coupangIsWinner,
          });
        }
      }
      // else if (netProfit < margin) {
      //   const requiredIncreaseInRevenue = margin - netProfit;
      //   const adjustedTotalRevenue = salePrice + requiredIncreaseInRevenue;
      //
      //   const newPrice = Math.round(
      //     ((adjustedTotalRevenue - +product.coupangShippingCost) * 10.8) / 9.8,
      //   );
      //
      //   productsBatch.push({
      //     sellerProductId: product.coupangId,
      //     productCode: product.coupangProductCode,
      //     action: 'up',
      //     newPrice: Math.round(newPrice),
      //     currentPrice: product.coupangPrice,
      //     currentIsWinner: product.coupangIsWinner,
      //   });
      // }

      if (productsBatch.length >= 50) {
        await this.priceRepository.saveUpdateProducts(productsBatch);
        productsBatch.length = 0;
      }
    }

    if (productsBatch.length > 0) {
      await this.priceRepository.saveUpdateProducts(productsBatch);
    }

    console.log(`자동 가격 조절: 연산 종료.`);

    // await this.coupangService.couPangProductsPriceControl();
    return;
  }

  // @Cron('0 5 * * *')
  async autoPriceCron() {
    const isLocked = await this.redis.get('lock');

    if (isLocked) {
      console.log('자동 가격 조절: 락을 획득하지 못했습니다. 1분 후에 다시 시도합니다.');
      setTimeout(() => this.autoPriceCron(), 60000);
      return;
    }

    try {
      await this.redis.set('lock', 'locked');
      console.log('자동 가격 조절: 시작');

      await this.crawlOnchRegisteredProducts();
    } catch (error) {
      console.error('크론 작업 중 오류 발생:', error);
    } finally {
      await this.redis.del('lock');
      console.log('자동 가격 조절: 종료');
    }
  }
}
