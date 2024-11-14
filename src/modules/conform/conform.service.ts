import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { DataService } from '../data/data.service';
import { CoupangService } from '../coupang/coupang.service';
import { TaskService } from '../task/task.service';

@Injectable()
export class ConformService {
  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly dataService: DataService,
    private readonly coupangService: CoupangService,
    private readonly taskService: TaskService,
  ) {}

  async deleteConfirmedProducts() {
    const coupangPage = await this.puppeteerService.loginToCoupangSite();

    // 쿠팡 페이지에서 상품 코드 추출
    await coupangPage.goto(
      `https://wing.coupang.com/vendor-inventory/list?searchKeywordType=ALL&searchKeywords=&salesMethod=ALL&productStatus=ALL&stockSearchType=ALL&shippingFeeSearchType=ALL&displayCategoryCodes=&listingStartTime=null&listingEndTime=null&saleEndDateSearchType=ALL&bundledShippingSearchType=ALL&displayDeletedProduct=false&shippingMethod=ALL&exposureStatus=NON_CONFORMING_ATTR&locale=ko_KR&sortMethod=SORT_BY_REGISTRATION_DATE&countPerPage=50&page=1`,
      { timeout: 0 },
    );

    await coupangPage.waitForSelector('tr.inventory-line');

    const productCodes = await coupangPage.evaluate(() => {
      return Array.from(document.querySelectorAll('tr.inventory-line'))
        .map((row) => {
          return row.querySelector('.ip-title')?.textContent?.trim().split(' ')[0] || null;
        })
        .filter((code) => code !== null); // 유효한 코드만 남김
    });
    await this.puppeteerService.closeAllPages();

    const coupangProducts = await this.coupangService.fetchCoupangSellerProducts();
    const matchedProducts = coupangProducts.filter((product) =>
      productCodes.some((code) => product.sellerProductName.includes(code)),
    );

    // 쿠팡에서 중지 및 삭제
    await this.coupangService.stopSaleForMatchedProducts(matchedProducts);
    await this.coupangService.deleteProducts(matchedProducts, '컨펌');

    // OnChannel 사이트 로그인 후 페이지 열기
    const onchPage = await this.puppeteerService.loginToOnchSite();

    // OnChannel에서 각 상품 삭제
    for (const code of productCodes) {
      await onchPage.goto(`https://www.onch3.co.kr/admin_mem_prd_list.html?ost=${code}`, {
        waitUntil: 'networkidle2',
      });

      onchPage.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      // 삭제 버튼 클릭 및 알럿 처리
      await onchPage.evaluate(() => {
        const deleteButton = document.querySelector('a[onclick^="prd_list_del"]') as HTMLElement;
        if (deleteButton) {
          deleteButton.click();
        }
      });
    }

    await this.puppeteerService.closeAllPages();
  }

  @Cron('0 */27 * * * *')
  async conformCron() {
    if (await this.taskService.acquireLock()) {
      try {
        const status = await this.taskService.getRunningStatus();
        if (status === false) {
          await this.taskService.setRunningStatus(true);
          console.log(`Running status: ${status}`);

          console.log('컨펌 삭제 크론: 시작');
          await this.deleteConfirmedProducts();
        } else {
          console.log('컨펌 삭제 크론: 현재 다른 스케쥴이 있습니다. 1분 후에 다시 시도합니다.');
          setTimeout(() => this.conformCron(), 60000);
          return;
        }
      } finally {
        await this.taskService.setRunningStatus(false);
        this.taskService.releaseLock();
        console.log('컨펌 삭제 크론: 종료');
      }
    } else {
      console.log('품절 상품 크론: 현재 다른 작업이 진행 중입니다. 잠금을 획득하지 못했습니다.');
    }
  }
}
