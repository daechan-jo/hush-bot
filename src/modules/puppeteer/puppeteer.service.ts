import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

@Injectable()
export class PuppeteerService {
  private browser: Browser;

  constructor(private readonly configService: ConfigService) {
    puppeteer.use(StealthPlugin());
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: false,
    });
  }

  async loginToOnchSite() {
    const page = await this.browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Safari/537.36',
    );

    // 로그인 페이지
    await page.goto('https://www.onch3.co.kr/login/login_web.php');

    // 이메일과 비밀번호 입력
    await page.type(
      'input[placeholder="온채널 또는 통합계정 아이디"]',
      this.configService.get<string>('ON_CHANNEL_EMAIL'),
    );
    await page.type(
      'input[placeholder="비밀번호 입력"]',
      this.configService.get<string>('ON_CHANNEL_PASSWORD'),
    );

    // 로그인 버튼 클릭
    await page.click('button[name="login"]');
    await page.waitForNavigation();

    return page;
  }

  async loginToCoupangSite(page: Page) {
    // 로그인 페이지
    await page.goto(
      'https://xauth.coupang.com/auth/realms/seller/protocol/openid-connect/auth?response_type=code&client_id=wing&redirect_uri=https%3A%2F%2Fwing.coupang.com%2Fsso%2Flogin?returnUrl%3D%252F&state=ec02db23-2738-48a2-b15e-81d22b32be64&login=true&scope=openid',
      {
        waitUntil: 'networkidle2',
        timeout: 60000,
      },
    );

    // 이메일과 비밀번호 입력
    await page.type('#username', this.configService.get<string>('COUPANG_EMAIL'));
    await page.type('#password', this.configService.get<string>('COUPANG_PASSWORD'));

    // 엔터
    await page.keyboard.press('Enter');

    await page.waitForNavigation();

    return page;
  }

  async closeAllPages() {
    const pages = await this.browser.pages();
    for (const page of pages) {
      await page.close();
    }
  }

  async close() {
    await this.browser.close();
  }
}
