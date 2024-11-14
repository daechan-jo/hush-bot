import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataService } from '../data/data.service';
import { CoupangService } from '../coupang/coupang.service';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { TaskService } from '../task/task.service';

@Injectable()
export class SoldoutService {
  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly dataService: DataService,
    private readonly coupangService: CoupangService,
    private readonly taskService: TaskService,
  ) {}

  async crawlForNewProducts() {
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

    const lastCronTime = this.dataService.getLastCronTime();
    console.log('마지막 실행 시간:', lastCronTime);

    // 품절 상품 페이지에서 상품코드 추출
    const productCodes = await onchPage.evaluate(
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
      { timeout: 0 },
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
    await this.coupangService.deleteProducts(matchedProducts, '품절');

    // OnChannel에서 각 상품 삭제
    for (const product of matchedProducts) {
      const productCode = product.sellerProductName.match(/CH\d{7}/)?.[0];
      if (!productCode) continue;

      await onchPage.goto(`https://www.onch3.co.kr/admin_mem_prd_list.html?ost=${productCode}`, {
        waitUntil: 'networkidle2',
      });

      // 알럿 창 처리 이벤트 리스너를 먼저 설정
      onchPage.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      // 삭제 버튼 클릭
      await onchPage.evaluate(() => {
        const deleteButton = document.querySelector('a[onclick^="prd_list_del"]') as HTMLElement;
        if (deleteButton) {
          deleteButton.click();
        }
      });
    }

    await this.puppeteerService.closeAllPages();
  }

  @Cron('0 */5 * * * *')
  async soldOutCron() {
    if (await this.taskService.acquireLock()) {
      try {
        const status = await this.taskService.getRunningStatus();
        if (status === false) {
          await this.taskService.setRunningStatus(true);
          console.log(`Running status: ${status}`);

          console.log('품절 상품 크론: 시작');
          await this.crawlForNewProducts();
        } else {
          console.log('품절 상품 크론: 현재 다른 스케쥴이 진행중입니다.');
          return;
        }
      } finally {
        await this.taskService.setRunningStatus(false);
        this.taskService.releaseLock();
        console.log('품절 상품 크론: 종료');
      }
    } else {
      console.log('품절 상품 크론: 현재 다른 작업이 진행 중입니다. 잠금을 획득하지 못했습니다.');
    }
  }
}
