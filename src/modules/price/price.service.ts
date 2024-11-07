import { Injectable } from '@nestjs/common';
import { PuppeteerService } from '../auth/puppeteer.service';
import { DataService } from '../data/data.service';
import { CoupangService } from '../coupang/coupang.service';
import { Page } from 'puppeteer';
import { Cron } from '@nestjs/schedule';
import { TaskService } from '../task/task.service';

@Injectable()
export class PriceService {
  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly dataService: DataService,
    private readonly coupangService: CoupangService,
    private readonly taskService: TaskService,
  ) {}

  async crawlSaleProducts() {
    const onchPage = await this.puppeteerService.loginToOnchSite();

    onchPage.on('console', (msg) => {
      for (let i = 0; i < msg.args().length; ++i) console.log(`${i}: ${msg.args()[i]}`);
    });

    let currentPage = 1;
    const allProductIds = [];

    while (true) {
      await onchPage.goto(`https://www.onch3.co.kr/admin_mem_prd_list.html?page=${currentPage}`);

      // 현재 페이지에서 상품 고유번호 추출
      const productIds = await onchPage.evaluate(() => {
        const links = Array.from(
          document.querySelectorAll('a[href^="./dbcenter_renewal/dbcenter_view.html?num="]'),
        );
        return links
          .map((link) => {
            const match = link.getAttribute('href')?.match(/num=(\d+)/);
            return match ? match[1] : null;
          })
          .filter((id) => id !== null);
      });

      // 상품 ID가 없으면 크롤링 중지
      if (productIds.length === 0) {
        console.log(`크롤링 중지 마지막 페이지: ${currentPage}`);
        break;
      }

      allProductIds.push(...productIds);

      currentPage++;
    }

    console.log('자동 가격 조절: 온채널 판매상품 리스트업 완료');
    await this.crawlOnchDetailProducts(onchPage, allProductIds);
  }

  async crawlOnchDetailProducts(onchPage: Page, allProductIds: string[]) {
    const detailsBatch = [];

    for (const productId of allProductIds) {
      await onchPage.goto(
        `https://www.onch3.co.kr/dbcenter_renewal/dbcenter_view.html?num=${productId}`,
        { timeout: 0 },
      );

      // 소비자가, 판매가, 일반 배송비 추출
      const details = await onchPage.evaluate(() => {
        const getTextContent = (selector: string) =>
          document
            .querySelector(selector)
            ?.textContent?.trim()
            .replace(/[^0-9]/g, '');

        const productCodeElement = Array.from(document.querySelectorAll('li')).find((li) =>
          li.querySelector('.prod_detail_title')?.textContent?.includes('제품코드'),
        );
        const productCode =
          productCodeElement?.querySelector('div:nth-child(2)')?.textContent.trim() || null;

        // 소비자가
        const consumerPrice = getTextContent('.price_info li:nth-child(1) .prod_cus_price') || null;

        // 판매사가
        const sellerPrice = getTextContent('.price_info li:nth-child(2) div:nth-child(2)') || null;

        // 배송비
        const shippingCostElement = Array.from(document.querySelectorAll('li')).find((li) =>
          li.querySelector('.prod_detail_title')?.textContent?.includes('택배비/택배사'),
        );
        const shippingCostText =
          shippingCostElement?.querySelector('div:nth-child(2)')?.textContent || '';
        const shippingCostMatch = shippingCostText.match(/일반\s([\d,]+)원/);
        const shippingCost = shippingCostMatch ? shippingCostMatch[1].replace(/,/g, '') : null;

        return {
          productCode,
          consumerPrice,
          sellerPrice,
          shippingCost,
        };
      });

      detailsBatch.push(details);

      // 배치 크기만큼 쌓이면 저장 후 배열 초기화
      if (detailsBatch.length >= 50) {
        this.dataService.appendToArray('onchProductDetails', [...detailsBatch]);
        detailsBatch.length = 0;
      }
    }
    if (detailsBatch.length > 0) {
      this.dataService.appendToArray('onchProductDetails', [...detailsBatch]);
    }

    console.log('자동 가격 조절: 온채널 판매상품 상세정보 크롤링 완료');
    await this.crawlCoupangDetailProducts(onchPage);
  }

  async crawlCoupangDetailProducts(onchPage: Page) {
    const coupangPage = await this.puppeteerService.loginToCoupangSite(onchPage);

    let isLastPage = false;
    let currentPage = 1;

    while (!isLastPage) {
      console.log('자동 가격 조절: 쿠팡 크롤링 시작 - 페이지', currentPage);

      await coupangPage.goto(
        `https://wing.coupang.com/vendor-inventory/list?searchKeywordType=ALL&searchKeywords=&salesMethod=ALL&productStatus=ALL&stockSearchType=ALL&shippingFeeSearchType=ALL&displayCategoryCodes=&listingStartTime=null&listingEndTime=null&saleEndDateSearchType=ALL&bundledShippingSearchType=ALL&displayDeletedProduct=false&shippingMethod=ALL&exposureStatus=ALL&locale=ko_KR&sortMethod=SORT_BY_ITEM_LEVEL_UNIT_SOLD&countPerPage=50&page=${currentPage}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));

      await coupangPage.evaluate(async () => {
        const scrollStep = 100; // 한 번에 스크롤할 픽셀 수
        const scrollDelay = 100; // 스크롤 간 딜레이(ms)

        for (let y = 0; y < document.body.scrollHeight; y += scrollStep) {
          window.scrollBy(0, scrollStep);
          await new Promise((resolve) => setTimeout(resolve, scrollDelay)); // 각 스크롤 간격마다 대기
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      console.log('모든 상품 로드 대기 중...');
      const productsOnPage = await coupangPage.evaluate(() => {
        const getPrice = (text: string) => text?.replace(/[^0-9]/g, '') || null;

        // 모든 상품 행을 순회하며 데이터 추출
        return Array.from(document.querySelectorAll('tr.inventory-line')).map((row) => {
          const ipContentDiv = row.querySelector('.ip-right .ip-content div:nth-child(3)');
          const sellerProductId = ipContentDiv
            ? ipContentDiv.textContent.replace(/[^0-9]/g, '')
            : null;

          const productCode =
            row.querySelector('.ip-title')?.textContent?.trim().split(' ')[0] || null;

          const isWinnerContainer = row.querySelector('.ies-container');
          const isWinnerText =
            isWinnerContainer?.querySelector('.ies-top')?.textContent?.trim().replace(/\s/g, '') ||
            '';
          const isWinner = isWinnerText === 'Itemwinner';

          const priceText = row.querySelector('.isp-top')?.textContent || '';
          const shippingText = row.querySelector('.isp-bottom')?.textContent || '';

          return {
            sellerProductId,
            productCode,
            isWinner,
            price: getPrice(priceText),
            shippingCost: getPrice(shippingText),
          };
        });
      });

      this.dataService.appendToArray('coupangProductDetails', productsOnPage);
      // 다음 페이지로 이동 (없다면 종료)
      if (productsOnPage.length === 0) {
        console.log('더 이상 상품이 없습니다. 크롤링을 종료합니다.');
        isLastPage = true;
      } else {
        currentPage++;
      }
    }

    await this.puppeteerService.closeAllPages();

    return this.calculateMarginAndAdjustPrices(
      this.dataService.get('onchProductDetails'),
      this.dataService.get('coupangProductDetails'),
    );
  }

  async calculateMarginAndAdjustPrices(onchProductDetails: any[], coupangProductDetails: any[]) {
    const productsBatch = [];

    for (const coupangProduct of coupangProductDetails) {
      const onchProduct = onchProductDetails.find(
        (onch) => onch.productCode === coupangProduct.productCode,
      );

      if (!onchProduct) {
        continue;
      }

      // A: 판매금
      const A = Math.round(
        +coupangProduct.price - +coupangProduct.price / 10.8 + +coupangProduct.shippingCost,
      );

      // B: 도매가격(투자금)
      const B = +onchProduct.sellerPrice + +onchProduct.shippingCost;

      // C: 최종 수익
      const C = A - B;
      // D: 해당 상품을 팔았을 때 목표 마진값(10프로)
      const D = Math.round(B / 10);

      // 가격 조정 조건에 따라 처리
      if (C > D && !coupangProduct.isWinner) {
        const requiredDecreaseInRevenue = C - D;
        const adjustedTotalRevenue = A - requiredDecreaseInRevenue;

        // 수수료와 배송비 고려하여 하향 조정된 판매가 계산
        const newPrice = Math.round(
          ((adjustedTotalRevenue - +coupangProduct.shippingCost) * 10.8) / 9.8,
        );

        // 원래 가격보다 높은 경우, 원래 가격으로 유지
        if (newPrice < +coupangProduct.price) {
          productsBatch.push({
            productCode: coupangProduct.productCode,
            action: 'down',
            newPrice: String(Math.round(newPrice)),
            currentPrice: coupangProduct.price,
          });
        }
      } else if (C < D) {
        // C가 D보다 작은 경우, C가 D 만큼 되도록 가격을 올림
        const requiredIncreaseInRevenue = D - C;

        // 필요한 최종 판매가 계산
        const adjustedTotalRevenue = A + requiredIncreaseInRevenue;

        // 쿠팡 수수료와 배송비를 고려한 newPrice를 계산
        const newPrice = Math.round(
          ((adjustedTotalRevenue - +coupangProduct.shippingCost) * 10.8) / 9.8,
        );

        // 배치 크기만큼 쌓이면 저장 후 배열 초기화

        productsBatch.push({
          productCode: coupangProduct.productCode,
          action: 'up',
          newPrice: String(Math.round(newPrice)),
          currentPrice: coupangProduct.price,
        });
      }
      // C == D 이면 아무것도 하지 않음
      if (productsBatch.length >= 50) {
        this.dataService.appendToArray('updatedProducts', [...productsBatch]);
        productsBatch.length = 0;
      }
    }

    if (productsBatch.length > 0) {
      this.dataService.appendToArray('updatedProducts', [...productsBatch]);
    }

    this.dataService.delete('onchProductDetails');
    this.dataService.delete('coupangProductDetails');
  }

  async sellingPriceControl() {}

  @Cron('0 5 * * *')
  async autoPriceCron() {
    try {
      await this.taskService.setRunningStatus(true);
      console.log('자동 가격 조절: 시작');

      await this.crawlSaleProducts();
    } finally {
      await this.taskService.setRunningStatus(false);
      console.log('자동 가격 조절: 종료');
    }
  }
}
