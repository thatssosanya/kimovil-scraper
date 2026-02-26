import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VidAuthor } from '@src/shared/storages/vidStorage';

// Setup mocks
vi.mock('@src/shared/utils/utils');
vi.mock('@src/shared/storages/linksStorage');

// Import after mocks are set up
import { LinkService } from '../LinkService';
import { Shortio, AliExpressClient, createLink, parseYandexMarketUrl, parseAliExpressUrl, parsePriceRuUrl, createPriceRuLink } from '@src/shared/utils/utils';
import linksStorage from '@src/shared/storages/linksStorage';

// Get mocked functions
const mockedShortio = vi.mocked(Shortio);
const mockedAliExpressClient = vi.mocked(AliExpressClient);
const mockedCreateLink = vi.mocked(createLink);
const mockedParseYandexMarketUrl = vi.mocked(parseYandexMarketUrl);
const mockedParseAliExpressUrl = vi.mocked(parseAliExpressUrl);
const mockedParsePriceRuUrl = vi.mocked(parsePriceRuUrl);
const mockedCreatePriceRuLink = vi.mocked(createPriceRuLink);

describe('LinkService', () => {
  let linkService: LinkService;
  let mockSh: ReturnType<typeof vi.fn>;
  let mockCheckCommission: ReturnType<typeof vi.fn>;
  let mockCreateDeeplink: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock implementations
    mockSh = vi.fn();
    mockCheckCommission = vi.fn();
    mockCreateDeeplink = vi.fn();
    
    mockedShortio.mockImplementation(() => ({
      sh: mockSh,
      expand: vi.fn(),
      getStats: vi.fn(),
      getTitle: vi.fn()
    }) as unknown as InstanceType<typeof Shortio>);
    
    mockedAliExpressClient.mockImplementation(() => ({
      checkCommission: mockCheckCommission,
      createDeeplink: mockCreateDeeplink
    }) as unknown as InstanceType<typeof AliExpressClient>);
    
    linkService = new LinkService();
  });

  describe('parseUrl', () => {
    it('should identify Yandex Market URLs', () => {
      const mockYandexParams = { productId: '123', sku: null, uniqueId: null, doWaremd5: null, isCardFormat: false };
      mockedParseYandexMarketUrl.mockReturnValue(mockYandexParams);
      mockedParseAliExpressUrl.mockReturnValue(null);

      const result = linkService.parseUrl('https://market.yandex.ru/product/123');
      
      expect(result.type).toBe('yandex');
      expect(result.params).toEqual(mockYandexParams);
    });

    it('should identify AliExpress URLs', () => {
      const mockAliExpressParams = { productId: '456', storeId: null, originalUrl: 'https://aliexpress.com/item/456.html' };
      mockedParseYandexMarketUrl.mockReturnValue(null);
      mockedParseAliExpressUrl.mockReturnValue(mockAliExpressParams);
      mockedParsePriceRuUrl.mockReturnValue(null);

      const result = linkService.parseUrl('https://aliexpress.com/item/456.html');
      
      expect(result.type).toBe('aliexpress');
      expect(result.params).toEqual(mockAliExpressParams);
    });

    it('should identify price.ru URLs', () => {
      const mockPriceRuParams = { originalUrl: 'https://price.ru/product/123' };
      mockedParseYandexMarketUrl.mockReturnValue(null);
      mockedParseAliExpressUrl.mockReturnValue(null);
      mockedParsePriceRuUrl.mockReturnValue(mockPriceRuParams);

      const result = linkService.parseUrl('https://price.ru/product/123');
      
      expect(result.type).toBe('priceru');
      expect(result.params).toEqual(mockPriceRuParams);
    });

    it('should return invalid for non-supported URLs', () => {
      mockedParseYandexMarketUrl.mockReturnValue(null);
      mockedParseAliExpressUrl.mockReturnValue(null);
      mockedParsePriceRuUrl.mockReturnValue(null);

      const result = linkService.parseUrl('https://example.com');
      
      expect(result.type).toBe('invalid');
      expect(result.params).toBeNull();
    });
  });

  describe('generateYandexLinks', () => {
    const mockAuthor: VidAuthor = { id: 'test', name: 'Test Author', vid: '123' };
    const mockYandexParams = { productId: '789', sku: null, uniqueId: null, doWaremd5: null, isCardFormat: false };

    it('should generate Yandex links successfully', async () => {
      mockedParseYandexMarketUrl.mockReturnValue(mockYandexParams);
      mockedCreateLink.mockReturnValueOnce('https://market.yandex.ru/site-link')
        .mockReturnValueOnce('https://market.yandex.ru/telegram-link');
      mockSh.mockResolvedValueOnce('https://short.link/site')
        .mockResolvedValueOnce('https://short.link/telegram');

      const result = await linkService.generateYandexLinks('https://market.yandex.ru/product/789', mockAuthor);

      expect(result).toEqual({
        siteLink: 'https://short.link/site',
        siteLinkLong: expect.any(String),
        telegramLink: 'https://short.link/telegram',
        telegramLinkLong: expect.any(String)
      });

      expect(mockedCreateLink).toHaveBeenCalledTimes(2);
      expect(mockedCreateLink).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockYandexParams,
          vid: '123',
          useCardFormat: true
        }),
        'site'
      );
      expect(mockedCreateLink).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockYandexParams,
          vid: '123',
          useCardFormat: true
        }),
        'blogger'
      );
    });

    it('should throw error for invalid Yandex URL', async () => {
      mockedParseYandexMarketUrl.mockReturnValue(null);

      await expect(
        linkService.generateYandexLinks('https://invalid.com', mockAuthor)
      ).rejects.toThrow('Invalid Yandex Market URL');
    });

    it('should throw network error when shortening fails', async () => {
      mockedParseYandexMarketUrl.mockReturnValue(mockYandexParams);
      mockedCreateLink.mockReturnValue('https://market.yandex.ru/link');
      mockSh.mockRejectedValue(new Error('Network error'));

      await expect(
        linkService.generateYandexLinks('https://market.yandex.ru/product/789', mockAuthor)
      ).rejects.toThrow('Failed to generate Yandex links');
    });

    it('should generate single kick link for kick user', async () => {
      const kickAuthor: VidAuthor = { id: 'kick', name: 'Kick', vid: 'kickpersh' };
      mockedParseYandexMarketUrl.mockReturnValue(mockYandexParams);
      mockedCreateLink.mockReturnValue('https://market.yandex.ru/kick-link');
      mockSh.mockResolvedValue('https://short.link/kick');

      const result = await linkService.generateYandexLinks('https://market.yandex.ru/product/789', kickAuthor);

      expect(result).toEqual({
        siteLink: 'https://short.link/kick',
        siteLinkLong: 'https://market.yandex.ru/kick-link'
      });

      expect(mockedCreateLink).toHaveBeenCalledTimes(1);
      expect(mockedCreateLink).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockYandexParams,
          vid: 'kickpersh',
          useCardFormat: true
        }),
        'kick'
      );
    });
  });

  describe('checkAliExpressCommission', () => {
    const mockAliExpressParams = { productId: '456', storeId: null, originalUrl: 'https://aliexpress.com/item/456.html' };

    it('should check commission successfully', async () => {
      mockedParseAliExpressUrl.mockReturnValue(mockAliExpressParams);
      const mockCommission = {
        url: 'https://aliexpress.com/item/456.html',
        product_name: 'Test Product',
        commission_rate: 5.5,
        hot_commission_rate: null,
        is_hot: false
      };
      mockCheckCommission.mockResolvedValue({
        commission_rates: [mockCommission]
      });

      const result = await linkService.checkAliExpressCommission('https://aliexpress.com/item/456.html');

      expect(result).toEqual(mockCommission);
      expect(mockCheckCommission).toHaveBeenCalledWith(['https://aliexpress.com/item/456.html']);
    });

    it('should return null when no commission rates', async () => {
      mockedParseAliExpressUrl.mockReturnValue(mockAliExpressParams);
      mockCheckCommission.mockResolvedValue({
        commission_rates: []
      });

      const result = await linkService.checkAliExpressCommission('https://aliexpress.com/item/456.html');

      expect(result).toBeNull();
    });

    it('should throw error for invalid AliExpress URL', async () => {
      mockedParseAliExpressUrl.mockReturnValue(null);

      await expect(
        linkService.checkAliExpressCommission('https://invalid.com')
      ).rejects.toThrow('Invalid AliExpress URL');
    });

    it('should throw API error when commission check fails', async () => {
      mockedParseAliExpressUrl.mockReturnValue(mockAliExpressParams);
      mockCheckCommission.mockRejectedValue(new Error('API error'));

      await expect(
        linkService.checkAliExpressCommission('https://aliexpress.com/item/456.html')
      ).rejects.toThrow('Failed to check AliExpress commission');
    });
  });

  describe('generateAliExpressLink', () => {
    const mockAliExpressParams = { productId: '456', storeId: null, originalUrl: 'https://aliexpress.com/item/456.html' };

    it('should generate AliExpress link successfully', async () => {
      mockedParseAliExpressUrl.mockReturnValue(mockAliExpressParams);
      mockCreateDeeplink.mockResolvedValue({
        deeplink: 'https://s.click.aliexpress.com/deep_link'
      });
      mockSh.mockResolvedValue('https://short.link/ali');

      const result = await linkService.generateAliExpressLink('https://aliexpress.com/item/456.html');

      expect(result).toEqual({
        link: 'https://short.link/ali',
        linkLong: 'https://s.click.aliexpress.com/deep_link'
      });
      expect(mockCreateDeeplink).toHaveBeenCalledWith('https://aliexpress.com/item/456.html');
      expect(mockSh).toHaveBeenCalledWith('https://s.click.aliexpress.com/deep_link');
    });

    it('should throw error for invalid AliExpress URL', async () => {
      mockedParseAliExpressUrl.mockReturnValue(null);

      await expect(
        linkService.generateAliExpressLink('https://invalid.com')
      ).rejects.toThrow('Invalid AliExpress URL');
    });

    it('should throw network error when link generation fails', async () => {
      mockedParseAliExpressUrl.mockReturnValue(mockAliExpressParams);
      mockCreateDeeplink.mockRejectedValue(new Error('Network error'));

      await expect(
        linkService.generateAliExpressLink('https://aliexpress.com/item/456.html')
      ).rejects.toThrow('Failed to generate AliExpress link');
    });
  });

  describe('cache operations', () => {
    it('should get cached links', async () => {
      const mockCachedLinks = {
        siteLink: 'https://cached.site',
        telegramLink: 'https://cached.telegram',
        timestamp: Date.now(),
        linkType: 'yandex' as const
      };
      vi.mocked(linksStorage.getLinksForTab).mockReturnValue(mockCachedLinks);

      const result = await linkService.getCachedLinks(1, 'author-id');

      expect(result).toEqual(mockCachedLinks);
      expect(linksStorage.getLinksForTab).toHaveBeenCalledWith(1, 'author-id');
    });

    it('should save Yandex links', async () => {
      const links = {
        siteLink: 'https://site.link',
        siteLinkLong: 'https://sitelink.long',
        telegramLink: 'https://telegram.link',
        telegramLinkLong: 'https://telegramlink.long'
      };

      await linkService.saveYandexLinks(1, 'author-id', links);

      expect(linksStorage.saveLinksForTab).toHaveBeenCalledWith(1, 'author-id', {
        siteLink: links.siteLink,
        siteLinkLong: links.siteLinkLong,
        telegramLink: links.telegramLink,
        telegramLinkLong: links.telegramLinkLong,
        timestamp: expect.any(Number),
        linkType: 'yandex'
      });
    });

    it('should save AliExpress link with commission', async () => {
      const commission = {
        url: 'https://aliexpress.com',
        product_name: 'Product',
        commission_rate: 5.5,
        hot_commission_rate: 8.0,
        is_hot: true
      };
      const result = {
        link: 'https://ali.link',
        linkLong: 'https://longlink.com'
      };

      await linkService.saveAliExpressLink(1, result, commission);

      expect(linksStorage.saveLinksForTab).toHaveBeenCalledWith(1, 'aliexpress', {
        siteLink: 'https://ali.link',
        siteLinkLong: 'https://longlink.com',
        telegramLink: 'https://ali.link',
        telegramLinkLong: 'https://longlink.com',
        aliExpressLink: 'https://ali.link',
        aliExpressLinkLong: 'https://longlink.com',
        commissionRate: 5.5,
        hotCommissionRate: 8.0,
        isHot: true,
        productName: 'Product',
        timestamp: expect.any(Number),
        linkType: 'aliexpress'
      });
    });

    it('should save AliExpress link without commission', async () => {
      const result = {
        link: 'https://ali.link',
        linkLong: 'https://longlink.com'
      };
      
      await linkService.saveAliExpressLink(1, result);

      expect(linksStorage.saveLinksForTab).toHaveBeenCalledWith(1, 'aliexpress', {
        siteLink: 'https://ali.link',
        siteLinkLong: 'https://longlink.com',
        telegramLink: 'https://ali.link',
        telegramLinkLong: 'https://longlink.com',
        aliExpressLink: 'https://ali.link',
        aliExpressLinkLong: 'https://longlink.com',
        commissionRate: 0,
        hotCommissionRate: 0,
        isHot: false,
        productName: undefined,
        timestamp: expect.any(Number),
        linkType: 'aliexpress'
      });
    });

    it('should clear cache for tab', async () => {
      await linkService.clearCacheForTab(1);

      expect(linksStorage.clearLinksForTab).toHaveBeenCalledWith(1);
    });
  });

  describe('generatePriceRuLink', () => {
    it('should generate price.ru link successfully', async () => {
      const mockPriceRuParams = { originalUrl: 'https://price.ru/product/123' };
      mockedParsePriceRuUrl.mockReturnValue(mockPriceRuParams);
      mockedCreatePriceRuLink.mockReturnValue('https://price.ru/product/123?utm_medium=cpc&utm_campaign=reflink-81&erid=2W5zFHqRUR6');
      mockSh.mockResolvedValue('https://short.link/price');

      const result = await linkService.generatePriceRuLink('https://price.ru/product/123');

      expect(result).toEqual({
        link: 'https://short.link/price',
        linkLong: 'https://price.ru/product/123?utm_medium=cpc&utm_campaign=reflink-81&erid=2W5zFHqRUR6'
      });
      
      expect(mockedCreatePriceRuLink).toHaveBeenCalledWith('https://price.ru/product/123');
      expect(mockSh).toHaveBeenCalledWith('https://price.ru/product/123?utm_medium=cpc&utm_campaign=reflink-81&erid=2W5zFHqRUR6');
    });

    it('should throw error for invalid price.ru URL', async () => {
      mockedParsePriceRuUrl.mockReturnValue(null);

      await expect(
        linkService.generatePriceRuLink('https://invalid.com')
      ).rejects.toThrow('Invalid price.ru URL');
    });

    it('should throw network error when link generation fails', async () => {
      const mockPriceRuParams = { originalUrl: 'https://price.ru/product/123' };
      mockedParsePriceRuUrl.mockReturnValue(mockPriceRuParams);
      mockedCreatePriceRuLink.mockReturnValue('https://price.ru/product/123?utm_medium=cpc');
      mockSh.mockRejectedValue(new Error('Network error'));

      await expect(
        linkService.generatePriceRuLink('https://price.ru/product/123')
      ).rejects.toThrow('Failed to generate price.ru link');
    });
  });
});