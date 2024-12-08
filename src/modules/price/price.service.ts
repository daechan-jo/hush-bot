import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import moment from 'moment/moment';
import { Page } from 'puppeteer';

import { PriceRepository } from './price.repository';
import { CronType } from '../../types/enum.type';
import { CoupangRepository } from '../coupang/coupang.repository';
import { CoupangService } from '../coupang/coupang.service';
import { MailService } from '../mail/mail.service';
import { OnchRepository } from '../onch/onch.repository';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { UtilService } from '../util/util.service';

@Injectable()
export class PriceService {
  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly coupangService: CoupangService,
    private readonly onchRepository: OnchRepository,
    private readonly coupangRepository: CoupangRepository,
    private readonly priceRepository: PriceRepository,
    private readonly utilService: UtilService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async crawlOnchRegisteredProducts(cronId: string) {
    const onchPage = await this.puppeteerService.loginToOnchSite();

    console.log(`${CronType.PRICE}${cronId}: 온채널 판매상품 리스트업 시작...`);
    const allProductIds = [];
    let currentPage = 1;

    while (true) {
      await onchPage.goto(
        `https://www.onch3.co.kr/admin_mem_prd_list.html?npage=100&page=${currentPage}`,
      );

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
        console.log(`${CronType.PRICE}${cronId}: 크롤링 중지 마지막 페이지-${currentPage}`);
        break;
      }

      allProductIds.push(...productIds);

      currentPage++;
    }

    console.log(
      `${CronType.PRICE}${cronId}: 온채널 판매상품 리스트업 완료 ${allProductIds.length} 개`,
    );
    await this.crawlOnchDetailProducts(cronId, onchPage, allProductIds);
  }

  async crawlOnchDetailProducts(cronId: string, onchPage: Page, allProductIds: string[]) {
    const detailsBatch = [];
    console.log(`${CronType.PRICE}${cronId}: 온채널 판매상품 상세정보 크롤링 시작...`);

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

        const getOptionTextContent = (element: Element, selector: string) =>
          element.querySelector(selector)?.textContent?.trim() || '';

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
        const shippingCost = shippingCostMatch ? shippingCostMatch[1].replace(/,/g, '') : 0;

        const onchItems = Array.from(document.querySelectorAll('ul li'))
          .filter((li) => li.querySelector('.detail_page_name')) // 옵션명이 존재하는 li만 포함
          .map((li) => {
            const optionName = getOptionTextContent(li, '.detail_page_name');
            const consumerPrice = getOptionTextContent(li, '.detail_page_price_2').replace(
              /[^0-9]/g,
              '',
            );
            const sellerPrice = getOptionTextContent(li, '.detail_page_price_3').replace(
              /[^0-9]/g,
              '',
            );
            return {
              itemName: optionName,
              consumerPrice: consumerPrice || null,
              sellerPrice: sellerPrice || null,
            };
          });

        return {
          productCode,
          consumerPrice,
          sellerPrice,
          shippingCost,
          onchItems,
        };
      });

      detailsBatch.push(details);

      // 배치 크기만큼 쌓이면 저장 후 배열 초기화
      if (detailsBatch.length >= 50) {
        await this.onchRepository.saveOnchProductDetails(detailsBatch);
        detailsBatch.length = 0;
      }
    }
    if (detailsBatch.length > 0) {
      await this.onchRepository.saveOnchProductDetails(detailsBatch);
    }

    console.log(`${CronType.PRICE}${cronId}: 온채널 판매상품 상세정보 크롤링 완료`);

    await this.crawlCoupangDetailProducts(cronId, onchPage);
  }

  async crawlCoupangDetailProducts(cronId: string, onchPage: Page) {
    console.log(`${CronType.PRICE}${cronId}: 쿠팡 크롤링 시작...`);

    const coupangPage = await this.puppeteerService.loginToCoupangSite(onchPage);

    let isLastPage = false;
    let currentPage = 1;

    try {
      while (!isLastPage) {
        console.log(`${CronType.PRICE}${cronId}: 쿠팡 크롤링 - 페이지`, currentPage);

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
              isWinnerContainer
                ?.querySelector('.ies-top')
                ?.textContent?.trim()
                .replace(/\s/g, '') || '';
            const isWinner = isWinnerText === 'Itemwinner';

            const priceText = row.querySelector('.isp-top')?.textContent || '';
            const shippingText = row.querySelector('.isp-bottom')?.textContent || '';

            return {
              sellerProductId,
              productCode,
              isWinner,
              price: priceText ? parseInt(getPrice(priceText)) : null,
              shippingCost: shippingText ? parseInt(getPrice(shippingText)) : 0,
            };
          });
        });

        await this.coupangRepository.saveCoupangProductDetails(productsOnPage);
        // 다음 페이지로 이동 (없다면 종료)
        if (productsOnPage.length === 0) {
          console.log(`${CronType.PRICE}${cronId}: 쿠팡 크롤링 종료`);
          isLastPage = true;
        } else {
          currentPage++;
        }
      }
    } finally {
      console.log(`${CronType.PRICE}${cronId}: 쿠팡 크롤링 종료`);
    }
    await this.puppeteerService.closeAllPages();

    return await this.testCalculateMarginAndAdjustPrices(cronId);
  }

  async testCalculateMarginAndAdjustPrices(cronId: string) {
    console.log(`${CronType.PRICE}${cronId}: 새로운 판매가 연산 시작...`);

    const productsBatch = [];
    const seenVendorItemIds = new Set();

    const cronVersionId = await this.priceRepository.createCronVersion(cronId);
    const products: any[] = await this.priceRepository.getProducts();

    // 매치된 상품들에서 각 상품들을 순회
    for (const product of products) {
      // 매치된 상품에 대한 상세정보를 쿠팡에서 가져옴
      const coupangDetail = await this.coupangService.fetchCoupangProductDetails(
        cronId,
        CronType.PRICE,
        product.sellerProductId,
      );

      const coupangItemMap = new Map(
        coupangDetail.data.items.map((item: any) => [item.itemName.trim(), item]),
      );

      // 상품에 포함된 아이템을 가져와서
      for (const onchItem of product.onchItems) {
        // 쿠팡 아이템과 매치시킴
        const matchedCoupangItem = coupangItemMap.get(onchItem.itemName.trim());

        if (!matchedCoupangItem) continue;

        const processedData = this.processProductData(product, onchItem, matchedCoupangItem);

        const { salePrice, wholesalePrice, margin, netProfit } = this.calculatePrices(
          processedData,
          product,
        );

        const adjustment = this.adjustPrice(salePrice, netProfit, margin, processedData);

        if (adjustment && !seenVendorItemIds.has(adjustment.vendorItemId)) {
          seenVendorItemIds.add(adjustment.vendorItemId);
          console.log(adjustment);
          productsBatch.push(adjustment);

          if (productsBatch.length >= 50) {
            await this.priceRepository.saveUpdateItems(productsBatch, cronVersionId);
            productsBatch.length = 0;
          }
        }
      }
    }

    if (productsBatch.length > 0) {
      await this.priceRepository.saveUpdateItems(productsBatch, cronVersionId);
    }
    console.log(`${CronType.PRICE}${cronId}: 연산 종료`);

    await this.coupangService.couPangProductsPriceControl(cronId, cronVersionId);

    try {
      await this.onchRepository.clearOnchProducts();
      await this.coupangRepository.clearCoupangProducts();
      console.log(`${CronType.PRICE}${cronId}: 온채널/쿠팡 크롤링 데이터 삭제`);
    } catch (err) {
      console.error(
        `${CronType.ERROR}${CronType.PRICE}${cronId}: 온채널/쿠팡 크롤링 데이터 삭제 실패\n`,
        err,
      );
    }
  }

  processProductData(product: any, onchItem: any, matchedCoupangItem: any) {
    return {
      sellerProductId: product.sellerProductId,
      vendorItemId: matchedCoupangItem.vendorItemId,
      itemName: onchItem.itemName,
      coupangSalePrice: +matchedCoupangItem.salePrice,
      onchSellerPrice: +onchItem.sellerPrice,
      onchConsumerPrice: +onchItem.consumerPrice,
      coupangShippingCost: +product.coupangShippingCost,
      onchShippingCost: +product.onchShippingCost,
      coupangIsWinner: product.coupangIsWinner,
    };
  }

  calculatePrices(processedData: any, product: any) {
    const salePrice = Math.round(
      processedData.coupangSalePrice -
        processedData.coupangSalePrice / 10.8 +
        processedData.coupangShippingCost,
    );
    const wholesalePrice = processedData.onchSellerPrice + processedData.onchShippingCost;
    const netProfit = salePrice - wholesalePrice;
    const margin = Math.round(wholesalePrice * 0.07); // 최소 마진 7%

    return { salePrice, wholesalePrice, netProfit, margin };
  }

  adjustPrice(salePrice: number, netProfit: number, margin: number, processedData: any) {
    if (netProfit > margin && !processedData.coupangIsWinner) {
      const requiredDecreaseInRevenue = netProfit - margin;
      const adjustedTotalRevenue = salePrice - requiredDecreaseInRevenue;

      const newPrice = Math.round(
        ((adjustedTotalRevenue - processedData.coupangShippingCost) * 10.8) / 9.8,
      );

      const roundedPrice = Math.round(newPrice / 10) * 10;

      if (roundedPrice < processedData.coupangSalePrice) {
        return {
          sellerProductId: processedData.sellerProductId,
          vendorItemId: processedData.vendorItemId,
          itemName: processedData.itemName,
          action: 'down',
          newPrice: roundedPrice,
          currentPrice: processedData.coupangSalePrice,
          currentIsWinner: processedData.coupangIsWinner,
        };
      }
    } else if (netProfit < margin) {
      const requiredIncreaseInRevenue = margin - netProfit;
      const adjustedTotalRevenue = salePrice + requiredIncreaseInRevenue;

      const newPrice = Math.round(
        ((adjustedTotalRevenue - processedData.coupangShippingCost) * 10.8) / 9.8,
      );

      const roundedPrice = Math.round(newPrice / 10) * 10;

      if (roundedPrice > processedData.coupangSalePrice) {
        return {
          vendorItemId: processedData.vendorItemId,
          sellerProductId: processedData.sellerProductId,
          itemName: processedData.itemName,
          action: 'up',
          newPrice: roundedPrice,
          currentPrice: processedData.coupangSalePrice,
          currentIsWinner: processedData.coupangIsWinner,
        };
      }
    }

    return null; // 조정 필요 없음
  }

  @Cron('0 0 3 * * *')
  async autoPriceCron(cronId?: string, retryCount = 0) {
    const lockKey = `lock:${this.configService.get<string>('STORE')}`;
    const lockValue = Date.now().toString();
    const currentCronId = cronId || this.utilService.generateCronId();

    const isLocked = await this.redis.set(lockKey, lockValue, 'NX');

    if (!isLocked) {
      console.log(`${CronType.PRICE}${currentCronId}: 락 획득 실패 - 1분 후 재시도`);
      setTimeout(() => this.autoPriceCron(currentCronId), 60000);
      return;
    }

    try {
      const nowTime = moment().format('HH:mm:ss');
      console.log(`${CronType.PRICE}${currentCronId}-${nowTime}: 시작`);

      await this.crawlOnchRegisteredProducts(currentCronId);
    } catch (error) {
      console.error(`${CronType.ERROR}${CronType.PRICE}${currentCronId}: 오류 발생\n`, error);
      if (retryCount < 10) {
        console.log(`${CronType.PRICE}${currentCronId}: ${retryCount + 1}번째 재시도 예정`);
        setTimeout(() => this.autoPriceCron(cronId, retryCount + 1), 3000);
      } else {
        await this.mailService.sendErrorMail(
          CronType.ORDER,
          this.configService.get<string>('STORE'),
          currentCronId,
        );
        console.error(`${CronType.ERROR}${CronType.PRICE}${currentCronId}: 재시도 횟수 초과`);
      }
    } finally {
      await this.redis.del(`lock:${this.configService.get<string>('STORE')}`);
      console.log(`${CronType.PRICE}${currentCronId}: 종료`);
    }
  }
}
