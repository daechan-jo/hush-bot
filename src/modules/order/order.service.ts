import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import moment from 'moment';

import { CronType } from '../../types/enum.type';
import { CoupangService } from '../coupang/coupang.service';
import { MailService } from '../mail/mail.service';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { UtilService } from '../util/util.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly coupangService: CoupangService,
    private readonly configService: ConfigService,
    private readonly puppeteerService: PuppeteerService,
    private readonly mailService: MailService,
    private readonly utilService: UtilService,
  ) {}

  async orderManagement(cronId: string) {
    const results = []; // 발주 결과 저장 배열
    const today = moment().format('YYYY-MM-DD');
    const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD');

    const newOrderProducts = await this.coupangService.getCoupangOrderList(
      cronId,
      CronType.ORDER,
      'ACCEPT',
      this.configService.get<string>('COUPANG_VENDOR_ID'),
      today,
      yesterday,
    );

    // 새로운 모든 주문 상품준비중 처리
    const newPage = await this.puppeteerService.loginToCoupangSite();
    const coupangPage = await this.coupangService.orderStatusUpdate(newPage, cronId);

    const onchPage = await this.puppeteerService.loginToOnchSite(coupangPage);

    for (const order of newOrderProducts) {
      for (const item of order.orderItems) {
        const sellerProductName = item.sellerProductName;
        const exposedProductName = `${item.sellerProductName}, ${item.sellerProductItemName}`;

        const searchQuery = sellerProductName.split(' ')[0];
        const vendorItemOption = item.vendorItemName.split(', ')[1];

        try {
          console.log(`${CronType.ORDER}${cronId}: 등록상품명`, exposedProductName);
          console.log(`${CronType.ORDER}${cronId}: 노출상품명`, item.vendorItemName);

          if (exposedProductName !== item.vendorItemName.trim())
            if (!exposedProductName.includes(item.vendorItemName.split(',')[0].trim()))
              throw new Error(
                `${CronType.ERROR}${CronType.ORDER}${cronId}: 노출상품명 확인이 필요합니다. 발주를 보류합니다.`,
              );

          // 상품검색
          await onchPage.type('#prd_sear_txt', searchQuery, { delay: 100 });
          await onchPage.keyboard.press('Enter');
          await onchPage.waitForNavigation({ waitUntil: 'networkidle2' });

          const orderButtonSelector = '.btn_order';
          if (!(await onchPage.$(orderButtonSelector)))
            throw new Error(
              `${CronType.ERROR}${CronType.ORDER}${cronId}: 제품 코드에 대한 주문 버튼을 찾을 수 없습니다: ${searchQuery}`,
            );

          await onchPage.click(orderButtonSelector);
          await onchPage.waitForSelector('.selectOptionList', { timeout: 10000 });

          // 옵션처리
          await onchPage.evaluate((vendorItemOption) => {
            const select = document.querySelector('.selectOptionList') as HTMLSelectElement;

            const option = Array.from(select.options).find(
              (opt) => opt.textContent?.trim() === vendorItemOption,
            );
            if (!option)
              throw new Error(
                `${CronType.ERROR}${CronType.ORDER}${cronId}: 옵션을 찾을 수 없습니다 "${vendorItemOption}"`,
              );

            select.value = option.value; // 값 설정
            select.dispatchEvent(new Event('change')); // 이벤트 트리거
          }, vendorItemOption);

          const optionQuantitySelector = '.optionQuantity';
          await onchPage.waitForSelector(optionQuantitySelector, { timeout: 5000 });

          // 발주 개수 변경
          const shippingCount = item.shippingCount; // 발주 개수
          await onchPage.evaluate(
            (selector, count) => {
              const quantityInput = document.querySelector(selector) as HTMLInputElement;
              if (!quantityInput)
                throw new Error(
                  `${CronType.ERROR}${CronType.ORDER}${cronId}: 옵션 수량 입력을 찾을 수 없습니다.`,
                );
              quantityInput.value = count.toString(); // 값 설정
              quantityInput.dispatchEvent(new Event('input')); // 이벤트 트리거
            },
            optionQuantitySelector,
            shippingCount,
          );

          // 받는 사람 정보 입력
          const receiver = order.receiver;
          if (!receiver.name && receiver.name === '')
            throw new Error(
              `${CronType.ERROR}${CronType.ORDER}${cronId}: 수취인 이름을 찾을 수 없습니다.`,
            );
          if (!receiver.safeNumber && receiver.safeNumber === '')
            throw new Error(
              `${CronType.ERROR}${CronType.ORDER}${cronId}: 수취인 전화번호를 찾을 수 없습니다.`,
            );

          await onchPage.type('input.orderName', receiver.name, { delay: 10 });
          await onchPage.type('input.orderPhone', receiver.safeNumber, { delay: 10 });

          // 주소 입력
          const fullAddress = `${receiver.addr1} ${receiver.addr2}`;
          if (!fullAddress && fullAddress === '')
            throw new Error(
              `${CronType.ERROR}${CronType.ORDER}${cronId}: 수취인 주소를 찾을 수 없습니다.`,
            );

          await onchPage.type('input.postcode', receiver.postCode, { delay: 10 });
          await onchPage.type('input.orderAddress', fullAddress, { delay: 10 });

          // 배송 메시지 입력
          await onchPage.type('textarea.comment', order.parcelPrintMessage || '', { delay: 10 });

          // 결제하기 버튼 클릭
          const completeButtonSelector = '.btnOrderComplete';
          onchPage.once('dialog', async (dialog) => {
            console.log(`Alert message: ${dialog.message()}`);
            await dialog.accept();
          });

          await onchPage.click(completeButtonSelector);
          await onchPage.waitForNavigation({ waitUntil: 'networkidle2' });

          await onchPage.goto('https://www.onch3.co.kr/index.php');

          results.push({
            status: 'success',
            orderId: order.orderId,
            ordererName: order.orderer.name,
            receiverName: receiver.name,
            sellerProductName: item.sellerProductName,
            sellerProductItemName: item.sellerProductItemName,
            shippingCount: item.shippingCount,
          });
        } catch (error) {
          results.push({
            status: 'failed',
            orderId: order.orderId,
            ordererName: order.orderer.name,
            receiverName: order.receiver.name,
            sellerProductName: item.sellerProductName,
            sellerProductItemName: item.sellerProductItemName,
            shippingCount: item.shippingCount,
            error: error,
          });
        }
      }
    }

    await this.puppeteerService.closeAllPages();

    const successOrders = results.filter((result) => result.status === 'success');
    const failedOrders = results.filter((result) => result.status === 'failed');

    if (successOrders.length > 0) {
      setImmediate(() => {
        this.mailService
          .sendSuccessOrders(successOrders, this.configService.get<string>('STORE'))
          .then(() => {
            console.log(`${CronType.ORDER}${cronId}: 성공 이메일 전송 완료`);
          })
          .catch((error) => {
            console.error(
              `${CronType.ERROR}${CronType.ORDER}${cronId}: 성공 이메일 전송 실패\n`,
              error.message,
            );
          });
      });
    }

    if (failedOrders.length > 0) {
      setImmediate(() => {
        this.mailService
          .sendFailedOrders(failedOrders, this.configService.get<string>('STORE'))
          .then(() => {
            console.log(`${CronType.ORDER}${cronId}: 실패 이메일 전송 완료`);
          })
          .catch((error) => {
            console.error(
              `${CronType.ERROR}${CronType.ORDER}${cronId}: 실패 이메일 전송 실패\n`,
              error.message,
            );
          });
      });
    }
  }

  async orderCron(cronId: string, retryCount = 1) {
    try {
      const nowTime = moment().format('HH:mm:ss');
      console.log(`${CronType.ORDER}${cronId}-${nowTime}: 자동 발주 시작`);

      await this.orderManagement(cronId);
    } catch (error) {
      if (retryCount < 10) {
        console.log(`${CronType.ORDER}${cronId}: ${retryCount + 1}번째 재시도 예정`);
        setTimeout(() => this.orderCron(cronId, retryCount + 1), 3000);
      } else {
        console.error(`${CronType.ERROR}${CronType.ORDER}${cronId}: 재시도 횟수 초과`);
        await this.mailService.sendErrorMail(
          CronType.ORDER,
          this.configService.get<string>('STORE'),
          cronId,
        );
      }
    } finally {
      console.log(`${CronType.ORDER}${cronId}: 자동 발주 작업 완료`);
    }
  }
}
