import * as crypto from 'crypto';
import * as fs from 'fs';
import * as readline from 'node:readline';
import * as path from 'path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cliProgress from 'cli-progress';
import { Page } from 'puppeteer';
import * as XLSX from 'xlsx';

import { CronType } from '../../types/enum.type';
import { MailService } from '../mail/mail.service';
import { PriceRepository } from '../price/price.repository';
import { UtilService } from '../util/util.service';

@Injectable()
export class CoupangService {
  private readonly secretKey: string;
  private readonly accessKey: string;
  private readonly vendorId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly priceRepository: PriceRepository,
    private readonly utilServie: UtilService,
  ) {
    this.secretKey = this.configService.get<string>('COUPANG_SECRET_KEY');
    this.accessKey = this.configService.get<string>('COUPANG_ACCESS_KEY');
    this.vendorId = this.configService.get<string>('COUPANG_VENDOR_ID');
  }

  async createHmacSignature(
    method: string,
    path: string,
    nextToken: string = '',
    useQuery: boolean = true,
  ) {
    const datetime =
      new Date().toISOString().substr(2, 17).replace(/:/gi, '').replace(/-/gi, '') + 'Z';

    const query = useQuery
      ? new URLSearchParams({
          vendorId: this.vendorId,
          nextToken,
          maxPerPage: '100',
          status: 'APPROVED',
        }).toString()
      : '';

    const message = datetime + method + path + query;

    const signature = crypto.createHmac('sha256', this.secretKey).update(message).digest('hex');

    const authorization = `CEA algorithm=HmacSHA256, access-key=${this.accessKey}, signed-date=${datetime}, signature=${signature}`;

    return { authorization, datetime };
  }

  async createParamHmacSignature(method: string, path: string, params: Record<string, any>) {
    const datetime =
      new Date().toISOString().substr(2, 17).replace(/:/gi, '').replace(/-/gi, '') + 'Z';

    const query = new URLSearchParams(params).toString(); // params로 queryString 생성

    const message = datetime + method + path + query;

    const signature = crypto.createHmac('sha256', this.secretKey).update(message).digest('hex');

    const authorization = `CEA algorithm=HmacSHA256, access-key=${this.accessKey}, signed-date=${datetime}, signature=${signature}`;

    return { authorization, datetime };
  }

  async fetchCoupangSellerProducts(cronId: string, type: string) {
    const apiPath = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';

    let nextToken = '';
    const allProducts = [];
    try {
      while (true) {
        const { authorization, datetime } = await this.createHmacSignature(
          'GET',
          apiPath,
          nextToken,
          true,
        );

        const response = await axios.get(`https://api-gateway.coupang.com${apiPath}`, {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json;charset=UTF-8',
            'X-EXTENDED-TIMEOUT': '90000',
            'X-Coupang-Date': datetime,
          },
          params: {
            vendorId: this.vendorId,
            nextToken: nextToken,
            maxPerPage: 100,
            status: 'APPROVED',
          },
        });

        const { data } = response.data;
        allProducts.push(...data);

        nextToken = response.data.nextToken;
        if (!nextToken) break;
      }

      return allProducts;
    } catch (error) {
      console.error(
        `${CronType.ERROR}${type}${cronId}: API 요청 오류:`,
        error.response?.data || error.message,
      );
      throw new Error('쿠팡 API 요청 실패');
    }
  }

  async fetchCoupangProductDetails(cronId: string, type: string, sellerProductId: number) {
    const apiPath = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${sellerProductId}`;

    const { authorization, datetime } = await this.createHmacSignature('GET', apiPath, '', false);

    try {
      const response = await axios.get(`https://api-gateway.coupang.com${apiPath}`, {
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json;charset=UTF-8',
          'X-EXTENDED-TIMEOUT': '90000',
          'X-Coupang-Date': datetime,
        },
      });

      return response.data;
    } catch (error) {
      console.error(
        `${CronType.ERROR}${type}${cronId}: 상품 상세 조회 오류 (sellerProductId-${sellerProductId}):`,
        error.response?.data || error.message,
      );
      throw new Error('쿠팡 상품 상세 조회 실패');
    }
  }

  async getCoupangOrderList(
    cronId: string,
    type: string,
    status: string,
    vendorId: string,
    today: string,
    yesterday: string,
  ) {
    const apiPath = `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/ordersheets`;

    let nextToken = '';
    const allProducts = [];
    try {
      while (true) {
        const { authorization, datetime } = await this.createParamHmacSignature('GET', apiPath, {
          vendorId,
          createdAtFrom: yesterday,
          createdAtTo: today,
          status: status,
          nextToken: nextToken,
          maxPerPage: 50,
        });

        const response = await axios.get(`https://api-gateway.coupang.com${apiPath}`, {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json;charset=UTF-8',
            'X-EXTENDED-TIMEOUT': '90000',
            'X-Coupang-Date': datetime,
          },
          params: {
            vendorId: this.vendorId,
            createdAtFrom: yesterday,
            createdAtTo: today,
            status: status,
            nextToken: nextToken,
            maxPerPage: 50,
          },
        });

        const { data } = response.data;
        allProducts.push(...data);

        nextToken = response.data.nextToken;
        if (!nextToken) break;
      }

      return allProducts;
    } catch (error) {
      console.error(
        `${CronType.ERROR}${type}${cronId}: API 요청 오류:`,
        error.response?.data || error.message,
      );
      throw new Error('쿠팡 API 요청 실패');
    }
  }

  async itemStopSale(cronId: string, type: string, vendorItemId: number) {
    const apiPath = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${vendorItemId}/sales/stop`;

    const { authorization, datetime } = await this.createHmacSignature('PUT', apiPath, '', false);

    try {
      const response = await axios.put(`https://api-gateway.coupang.com${apiPath}`, null, {
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json;charset=UTF-8',
          'X-EXTENDED-TIMEOUT': '90000',
          'X-Coupang-Date': datetime,
        },
      });

      console.log(
        `${type}${cronId}: 아이템 판매 중지 성공 vendorItemId-${vendorItemId}\n`,
        response.data,
      );
    } catch (error) {
      console.error(
        `${CronType.ERROR}${type}${cronId}: 아이템 판매 중지 실패 vendorItemId-${vendorItemId}\n`,
        error.response?.data || error.message,
      );
    }
  }

  async stopSaleForMatchedProducts(cronId: string, type: string, matchedProducts: any[]) {
    console.log(`${type}${cronId}: 쿠팡 아이템 판매 중지 시작...`);

    const detailedProducts = [];
    for (const product of matchedProducts) {
      const details = await this.fetchCoupangProductDetails(cronId, type, product.sellerProductId);
      detailedProducts.push(details);
    }

    for (const productDetail of detailedProducts) {
      if (productDetail && productDetail.data && productDetail.data.items) {
        const items = productDetail.data.items;

        for (const item of items) {
          await this.itemStopSale(cronId, type, item.vendorItemId);
        }
      }
    }
  }

  async deleteProducts(cronId: string, type: string, matchedProducts: any[]) {
    console.log(`${type}${cronId}: 쿠팡 상품 삭제 시작...`);

    const deletedProducts: { sellerProductId: number; productName: string }[] = [];
    for (const product of matchedProducts) {
      const apiPath = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${product.sellerProductId}`;

      const { authorization, datetime } = await this.createHmacSignature(
        'DELETE',
        apiPath,
        '',
        false,
      );

      try {
        const response = await axios.delete(`https://api-gateway.coupang.com${apiPath}`, {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json;charset=UTF-8',
            'X-EXTENDED-TIMEOUT': '90000',
            'X-Coupang-Date': datetime,
          },
        });

        console.log(
          `${type}${cronId}: 상품 삭제 성공 sellerProductId-${product.sellerProductId}\n`,
          response.data,
        );

        deletedProducts.push({
          sellerProductId: product.sellerProductId,
          productName: product.sellerProductName,
        });
      } catch (error) {
        console.error(
          `${CronType.ERROR}${type}${cronId}: 상품 삭제 실패 sellerProductId-${product.sellerProductId})\n`,
          error.response?.data || error.message,
        );
      }
    }
    if (deletedProducts.length > 0) {
      try {
        await this.mailService.sendBatchDeletionEmail(
          deletedProducts,
          type,
          this.configService.get<string>('STORE'),
        );
      } catch (error) {
        console.error(
          `${CronType.ERROR}${type}${cronId}: 삭제 알림 이메일 발송 실패\n`,
          error.message,
        );
      }
    }
  }

  async couPangProductsPriceControl(cronId: string, cronVersionId: number) {
    console.log(`${CronType.PRICE}${cronId}: 새로운 상품 가격 업데이트 시작`);

    let successCount = 0;
    let failedCount = 0;
    const updatedItems = await this.priceRepository.getUpdatedItems(cronVersionId);

    console.log(`${CronType.PRICE}${cronId}: 총 ${updatedItems.length}개의 아이템 업데이트`);
    const progressBar = this.utilServie.initProgressBar();
    progressBar.start(updatedItems.length, 0);

    for (const [index, item] of updatedItems.entries()) {
      const vendorItemId = item.vendorItemId;

      const priceUpdatePath = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${vendorItemId}/prices/${item.newPrice}`;

      const { authorization, datetime } = await this.createHmacSignature(
        'PUT',
        priceUpdatePath,
        '',
        false,
      );

      try {
        await axios.put(`https://api-gateway.coupang.com${priceUpdatePath}`, null, {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json;charset=UTF-8',
            'X-Coupang-Date': datetime,
          },
        });

        successCount++;
      } catch (updateError) {
        failedCount++;

        this.utilServie.resetCursorAboveProgressBar(3);
        console.error(
          `${CronType.ERROR}${CronType.PRICE}${cronId}: 가격 업데이트 오류 vendorItemId-${vendorItemId}\n`,
          updateError.response?.data || updateError.message,
        );
        this.utilServie.moveCursorToProgressBar(3);
      }
      progressBar.update(index + 1);
    }

    progressBar.stop();

    const excelData = updatedItems.map((item) => ({
      'Seller Product ID': item.sellerProductId,
      'Vendor Item ID': item.vendorItemId,
      'Item Name': item.itemName,
      Action: item.action,
      'New Price': item.newPrice,
      'Current Price': item.currentPrice,
      'Current Is Winner': item.currentIsWinner,
      'Created At': item.createdAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'UpdatedProducts');

    const filePath = path.join(__dirname, `updated_products_${cronId}.xlsx`);
    XLSX.writeFile(workbook, filePath);

    setImmediate(() => {
      this.mailService
        .sendUpdateEmail(
          filePath,
          successCount,
          failedCount,
          this.configService.get<string>('STORE'),
        )
        .then(() => {
          console.log(`${CronType.PRICE}${cronId}: 엑셀 파일과 함께 이메일 전송 완료`);
          fs.unlinkSync(filePath);
        })
        .catch((error) => {
          console.error(
            `${CronType.ERROR}${CronType.PRICE}${cronId}: 이메일 전송 실패\n`,
            error.message,
          );
        });
    });

    console.log(`${CronType.PRICE}${cronId}: 상품 가격 업데이트 완료`);
  }

  async shippingCostManagement(cronId: string) {
    console.log(`${CronType.REFEE}${cronId}: 반품 배송비 관리 시작...`);

    const coupangProductDetails = [];
    const coupangProducts = await this.fetchCoupangSellerProducts(cronId, CronType.REFEE);

    for (const product of coupangProducts) {
      const productDetail = await this.fetchCoupangProductDetails(
        cronId,
        CronType.REFEE,
        product.sellerProductId,
      );
      if (productDetail.data.returnCharge !== '5000' || 5000)
        coupangProductDetails.push(productDetail.data);
    }

    let successCount = 0;
    let failedCount = 0;

    if (coupangProductDetails.length === 0) {
      console.log(`${CronType.REFEE}${cronId}: 모든 상품의 반품 배송비가 올바르게 설정되어 있음`);
    }

    console.log(`${CronType.REFEE}${cronId}: ${coupangProductDetails.length}개 수정 시작...`);

    for (const product of coupangProductDetails) {
      const updatePath = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${product.sellerProductId}/partial`;
      const body = { sellerProductId: product.sellerProductId, returnCharge: 7000 };

      try {
        const { authorization, datetime } = await this.createHmacSignature(
          'PUT',
          updatePath,
          '',
          false,
        );

        await axios.put(`https://api-gateway.coupang.com${updatePath}`, body, {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json;charset=UTF-8',
            'X-Coupang-Date': datetime,
          },
        });

        successCount++;
      } catch (updateError) {
        console.error(
          `${CronType.ERROR}${CronType.REFEE}${cronId}: 반품 배송비 업데이트 실패 SellerProductId-${product.sellerProductId}\n`,
          updateError.response?.data || updateError.message,
        );
        failedCount++;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log(
      `${CronType.REFEE}${cronId}: 반품 배송비 관리 완료\n성공 ${successCount}개, 실패 ${failedCount}개`,
    );
  }

  async orderStatusUpdate(coupangPage: Page, cronId: string) {
    await coupangPage.goto('https://wing.coupang.com/tenants/sfl-portal/delivery/management', {
      timeout: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const checkboxSelector =
      '.search-table tbody span[data-wuic-props="name:check"] input[type="checkbox"]';

    const checkboxes = await coupangPage.$$(checkboxSelector);

    if (checkboxes.length === 0) {
      console.log(`${CronType.ORDER}${cronId}: 결제 완료 상품이 없습니다.`);
      return;
    }

    // 각 체크박스를 순회하며 클릭
    for (const checkbox of checkboxes) {
      const isDisabled = await checkbox.evaluate((el) => el.disabled);
      if (isDisabled) {
        await checkbox.evaluate((el) => el.removeAttribute('disabled'));
      }

      // 체크박스 클릭
      await checkbox.evaluate((el) => el.click());
    }
    // 주문 확인 버튼 클릭
    const confirmOrderButtonSelector = '#confirmOrder'; // 버튼 ID로 선택
    await coupangPage.waitForSelector(confirmOrderButtonSelector); // 버튼 요소 기다리기
    await coupangPage.click(confirmOrderButtonSelector);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. `select` 태그 선택 및 값 변경
    await coupangPage.waitForSelector('select[data-v-305197cb]');
    await coupangPage.select('select[data-v-305197cb]', 'CJGLS'); // CJ 대한통운 선택

    // 3. `textarea`에 텍스트 입력
    await coupangPage.waitForSelector('textarea[placeholder="Enter reason in detail"]');
    await coupangPage.type('textarea[placeholder="Enter reason in detail"]', '상품을 준비합니다');

    // 4. `Download` 버튼 클릭
    const downloadButtonSelector =
      'button#submitConfirm[style="float: right; margin: 0px 0px 0px 8px; padding: 6px 16px 8px;"][data-wuic-props*="icon-name:download"]';

    await coupangPage.evaluate((downloadButtonSelector) => {
      const button = document.querySelector(downloadButtonSelector) as HTMLElement;
      if (button) {
        button.click();
      } else {
        console.error('버튼을 찾을 수 없습니다.');
      }
    }, downloadButtonSelector);

    return coupangPage;
  }

  async invoiceUpload(cronId: string, matchedOrders: any[]) {
    console.log(`${CronType.SHIPPING}${cronId}: 송장업로드 시작`);
    const results = [];

    const vendorId = this.configService.get<string>('COUPANG_VENDOR_ID');

    const updatePath = `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/orders/invoices`;

    for (const order of matchedOrders) {
      const body = {
        vendorId: vendorId,
        orderSheetInvoiceApplyDtos: [
          {
            shipmentBoxId: order.shipmentBoxId,
            orderId: order.orderId,
            vendorItemId: order.orderItems[0].vendorItemId,
            deliveryCompanyCode: order.deliveryCompanyCode,
            invoiceNumber: order.courier.trackingNumber,
            splitShipping: false,
            preSplitShipped: false,
            estimatedShippingDate: '',
          },
        ],
      };

      try {
        const { authorization, datetime } = await this.createHmacSignature(
          'POST',
          updatePath,
          '',
          false,
        );

        await axios.post(`https://api-gateway.coupang.com${updatePath}`, body, {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json;charset=UTF-8',
            'X-Coupang-Date': datetime,
          },
        });

        results.push({
          status: 'success',
          orderId: order.orderId,
          vendorItemId: order.orderItems[0].vendorItemId,
          receiverName: order.courier.name,
          deliveryCompanyCode: order.deliveryCompanyCode,
          invoiceNumber: order.courier.trackingNumber,
        });
      } catch (error) {
        results.push({
          status: 'failed',
          orderId: order.orderId,
          vendorItemId: order.orderItems[0].vendorItemId,
          receiverName: order.courier.name,
          deliveryCompanyCode: order.courier.deliveryCompanyCode,
          invoiceNumber: order.courier.trackingNumber,
          error: error,
        });

        console.error(
          `${CronType.ERROR}${CronType.REFEE}${cronId}: 송장 업로드 실패 SellerProductId-${order.sellerProductId}\n`,
          error.response?.data || error.message,
        );
      }
    }

    return results;
  }
}
