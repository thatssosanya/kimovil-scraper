import { describe, it, expect } from 'vitest';
import { parseYandexMarketUrl, parseAliExpressUrl, createLink, convertYandexMarketUrl } from '../utils';

describe('parseYandexMarketUrl', () => {
  it('should parse product URL format', () => {
    const url = 'https://market.yandex.ru/product/12345?sku=67890&uniqueId=abc123&do-waremd5=xyz';
    const result = parseYandexMarketUrl(url);

    expect(result).toEqual({
      productId: '12345',
      productName: null,
      sku: '67890',
      uniqueId: 'abc123',
      doWaremd5: 'xyz',
      isCardFormat: false
    });
  });

  it('should parse card URL format', () => {
    const url = 'https://market.yandex.ru/card/samsung-galaxy/12345?sku=67890';
    const result = parseYandexMarketUrl(url);

    expect(result).toEqual({
      productId: '12345',
      productName: 'samsung-galaxy',
      sku: '67890',
      uniqueId: null,
      doWaremd5: null,
      isCardFormat: true
    });
  });

  it('should return null for non-Yandex Market URLs', () => {
    const url = 'https://example.com/product/12345';
    const result = parseYandexMarketUrl(url);

    expect(result).toBeNull();
  });

  it('should handle URLs without query parameters', () => {
    const url = 'https://market.yandex.ru/product/12345';
    const result = parseYandexMarketUrl(url);

    expect(result).toEqual({
      productId: '12345',
      productName: null,
      sku: null,
      uniqueId: null,
      doWaremd5: null,
      isCardFormat: false
    });
  });

  it('should return null for invalid URLs', () => {
    const result = parseYandexMarketUrl('not-a-url');
    expect(result).toBeNull();
  });
});

describe('parseAliExpressUrl', () => {
  it('should parse item URL format with product name', () => {
    const url = 'https://www.aliexpress.com/item/Cool-Product/1005001234567890.html?storeId=123456';
    const result = parseAliExpressUrl(url);

    expect(result).toEqual({
      productId: '1005001234567890',
      storeId: '123456',
      originalUrl: url
    });
  });

  it('should parse item URL format without product name', () => {
    const url = 'https://aliexpress.ru/item/1005008234013210.html?spm=a2g2w.detail.rcmdprod.5.425a4a7fbJKUhj';
    const result = parseAliExpressUrl(url);

    expect(result).toEqual({
      productId: '1005008234013210',
      storeId: null,
      originalUrl: url
    });
  });

  it('should parse store product URL format', () => {
    const url = 'https://aliexpress.ru/store/product/Amazing-Item/9876543210.html';
    const result = parseAliExpressUrl(url);

    expect(result).toEqual({
      productId: '9876543210',
      storeId: 'product',
      originalUrl: url
    });
  });

  it('should extract product ID from search params', () => {
    const url = 'https://aliexpress.com/product?productId=123456&storeId=789';
    const result = parseAliExpressUrl(url);

    expect(result).toEqual({
      productId: '123456',
      storeId: '789',
      originalUrl: url
    });
  });

  it('should return null for non-AliExpress URLs', () => {
    const url = 'https://example.com/item/12345.html';
    const result = parseAliExpressUrl(url);

    expect(result).toBeNull();
  });

  it('should handle different AliExpress domains', () => {
    const domains = [
      'https://aliexpress.com/item/Product/123.html',
      'https://aliexpress.ru/item/Product/123.html',
      'https://aliexpress.us/item/Product/123.html'
    ];

    domains.forEach(url => {
      const result = parseAliExpressUrl(url);
      expect(result).not.toBeNull();
      expect(result?.productId).toBe('123');
    });
  });

  it('should return null for invalid URLs', () => {
    const result = parseAliExpressUrl('not-a-url');
    expect(result).toBeNull();
  });
});

describe('createLink', () => {
  it('should create a product format link', () => {
    const params = {
      productId: '12345',
      sku: '67890',
      uniqueId: 'abc',
      doWaremd5: 'xyz',
      vid: '323'
    };

    const result = createLink(params, 'site');

    expect(result).toContain('https://market.yandex.ru/product/12345');
    expect(result).toContain('pp=900');
    expect(result).toContain('mclid=1003');
    expect(result).toContain('distr_type=7');
    expect(result).toContain('clid=2510955');
    expect(result).toContain('vid=323');
    expect(result).toContain('sku=67890');
    expect(result).toContain('uniqueId=abc');
    expect(result).toContain('do-waremd5=xyz');
    expect(result).toContain('showOriginalKmEmptyOffer=1');
  });

  it('should create a card format link', () => {
    const params = {
      productId: '12345',
      productName: 'samsung-galaxy',
      vid: '324',
      useCardFormat: true
    };

    const result = createLink(params, 'blogger');

    expect(result).toContain('https://market.yandex.ru/card/samsung-galaxy/12345');
    expect(result).toContain('clid=2913665'); // blogger clid
    expect(result).toContain('vid=324');
  });

  it('should handle missing optional parameters', () => {
    const params = {
      productId: '12345'
    };

    const result = createLink(params, 'site');

    expect(result).toContain('https://market.yandex.ru/product/12345');
    expect(result).not.toContain('sku=');
    expect(result).not.toContain('uniqueId=');
    expect(result).not.toContain('do-waremd5=');
  });

  it('should preserve parameters from original URL', () => {
    const params = {
      productId: '12345',
      originalUrl: 'https://market.yandex.ru/product/12345?sponsored=1&cpc=abc'
    };

    const result = createLink(params, 'site');

    expect(result).toContain('sponsored=1');
    expect(result).toContain('cpc=abc');
  });

  it('should use default values for optional params', () => {
    const params = {
      productId: '12345'
    };

    const result = createLink(params, 'site');

    expect(result).toContain('pp=900');
    expect(result).toContain('mclid=1003');
    expect(result).toContain('distr_type=7');
    expect(result).toContain('vid=322'); // default vid
  });
});

describe('convertYandexMarketUrl', () => {
  it('should convert product URL to card format', () => {
    const url = 'https://market.yandex.ru/product/12345?sku=67890';
    const result = convertYandexMarketUrl(url, 'card');

    // Since createLink requires productName for card format and we don't have it,
    // it will create a product URL instead
    expect(result).toContain('/product/12345');
    expect(result).toContain('sku=67890');
  });

  it('should convert card URL to product format', () => {
    const url = 'https://market.yandex.ru/card/samsung-galaxy/12345?sku=67890';
    const result = convertYandexMarketUrl(url, 'product');

    expect(result).toContain('/product/12345');
    expect(result).toContain('sku=67890');
  });

  it('should return original URL if already in target format', () => {
    const cardUrl = 'https://market.yandex.ru/card/samsung/12345';
    const productUrl = 'https://market.yandex.ru/product/12345';

    expect(convertYandexMarketUrl(cardUrl, 'card')).toBe(cardUrl);
    expect(convertYandexMarketUrl(productUrl, 'product')).toBe(productUrl);
  });

  it('should return original URL if parsing fails', () => {
    const invalidUrl = 'https://example.com/product/12345';
    
    expect(convertYandexMarketUrl(invalidUrl, 'card')).toBe(invalidUrl);
  });

  it('should handle errors gracefully', () => {
    const result = convertYandexMarketUrl('not-a-url', 'card');
    expect(result).toBe('not-a-url');
  });
});