import { Injectable } from '@nestjs/common';
import { Page } from 'puppeteer';

@Injectable()
export class OnchService {
  constructor() {}

  async deleteProducts(cronId: string, type: string, onchPage: Page, matchedProducts: any[]) {
    console.log(`${type}${cronId}: 온채널 판매상품 초기화...`);

    onchPage.on('dialog', async (dialog) => {
      try {
        await dialog.accept();
      } catch (err) {
        console.error(`대화상자를 처리하지 못했습니다.: ${err.message}`);
      }
    });

    // OnChannel에서 각 상품 삭제
    for (const product of matchedProducts) {
      const productCode = product.sellerProductName.match(/CH\d{7}/)?.[0];
      if (!productCode) continue;

      await onchPage.goto(`https://www.onch3.co.kr/admin_mem_prd_list.html?ost=${productCode}`, {
        waitUntil: 'networkidle2',
      });

      // 삭제 버튼 클릭
      await onchPage.evaluate(() => {
        const deleteButton = document.querySelector('a[onclick^="prd_list_del"]') as HTMLElement;
        if (deleteButton) {
          deleteButton.click();
        }
      });

      // 잠시 대기 (Dialog 처리 시간 보장)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async crawlingOnchSoldoutProducts(onchPage: Page, lastCronTime: Date) {
    const { stockProductCodes, productDates } = await onchPage.evaluate(
      (lastCronTimeMillis) => {
        const stockProductCodes: string[] = [];
        const productDates: string[] = [];

        const rows = Array.from(document.querySelectorAll('tr')); // 모든 행 가져오기

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

        return { stockProductCodes: Array.from(new Set(stockProductCodes)), productDates };
      },
      lastCronTime ? lastCronTime.getTime() : 0,
    );

    return { stockProductCodes, productDates };
  }
}
