/**
 * COD Analytics - Lightweight event tracking for widget impressions
 * 
 * Usage:
 * 1. Include this script on your page
 * 2. Add data attributes to widgets:
 *    <div data-widget-tracking
 *         data-mapping-id="123"
 *         data-post-id="456"
 *         data-widget-index="0"
 *         data-device-slug="iphone-15-pro">
 *      Widget content
 *    </div>
 * 
 * 3. Optional: Call window.codAnalytics.trackEvent() for custom events
 */
(function() {
  'use strict';

  // Configuration
  var CONFIG = {
    endpoint: window.COD_ANALYTICS_ENDPOINT || 'https://analytics.click-or-die.ru/v1/events',
    siteId: window.COD_ANALYTICS_SITE_ID || null,
    batchSize: 20,
    flushInterval: 5000,
    visibilityThreshold: 0.5,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    cookieExpiry: 365, // days
    debug: window.COD_ANALYTICS_DEBUG || false
  };

  // State
  var queue = [];
  var visitorId = null;
  var sessionId = null;
  var lastActivity = Date.now();
  var flushTimer = null;

  // Utility functions
  function log() {
    if (CONFIG.debug && console && console.log) {
      console.log.apply(console, ['[COD Analytics]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function generateId() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for (var i = 0; i < 20; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  }

  function getCookie(name) {
    var nameEQ = name + '=';
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length));
      }
    }
    return null;
  }

  function getOrCreateVisitorId() {
    var id = getCookie('cod_vid');
    if (!id) {
      id = 'v_' + generateId();
      setCookie('cod_vid', id, CONFIG.cookieExpiry);
      log('Created new visitor ID:', id);
    }
    return id;
  }

  function getOrCreateSessionId() {
    var stored = null;
    try {
      stored = sessionStorage.getItem('cod_sid');
      var lastActivityStored = sessionStorage.getItem('cod_last_activity');
      
      if (stored && lastActivityStored) {
        var elapsed = Date.now() - parseInt(lastActivityStored, 10);
        if (elapsed > CONFIG.sessionTimeout) {
          stored = null; // Session expired
          log('Session expired, creating new one');
        }
      }
    } catch (e) {
      // sessionStorage not available
    }

    if (!stored) {
      stored = 's_' + generateId();
      try {
        sessionStorage.setItem('cod_sid', stored);
      } catch (e) {}
      log('Created new session ID:', stored);
    }

    try {
      sessionStorage.setItem('cod_last_activity', Date.now().toString());
    } catch (e) {}

    return stored;
  }

  function updateActivity() {
    lastActivity = Date.now();
    try {
      sessionStorage.setItem('cod_last_activity', lastActivity.toString());
    } catch (e) {}
  }

  function getPageUrl() {
    // Strip query params that might contain PII
    var url = location.href.split('?')[0].split('#')[0];
    return url;
  }

  function getReferrerDomain() {
    if (!document.referrer) return '';
    try {
      return new URL(document.referrer).hostname;
    } catch (e) {
      return '';
    }
  }

  // Core tracking functions
  function trackEvent(eventType, properties) {
    updateActivity();
    sessionId = getOrCreateSessionId();

    var event = {
      event_type: eventType,
      occurred_at: new Date().toISOString(),
      session_id: sessionId,
      visitor_id: visitorId,
      page_url: getPageUrl(),
      page_path: location.pathname,
      referrer_domain: getReferrerDomain(),
      site_id: CONFIG.siteId,
      properties: properties || {}
    };

    queue.push(event);
    log('Queued event:', eventType, properties);

    if (queue.length >= CONFIG.batchSize) {
      flush();
    }
  }

  function flush() {
    if (queue.length === 0) return;

    var events = queue.slice();
    queue = [];

    var payload = JSON.stringify({ events: events });
    log('Flushing', events.length, 'events');

    // Use sendBeacon for reliability on page unload
    if (navigator.sendBeacon) {
      var blob = new Blob([payload], { type: 'application/json' });
      var sent = navigator.sendBeacon(CONFIG.endpoint, blob);
      if (!sent) {
        // Fallback to fetch if sendBeacon fails
        sendViaFetch(payload);
      }
    } else {
      sendViaFetch(payload);
    }
  }

  function sendViaFetch(payload) {
    try {
      fetch(CONFIG.endpoint, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        mode: 'cors'
      }).catch(function(err) {
        log('Failed to send events:', err);
      });
    } catch (e) {
      log('Fetch error:', e);
    }
  }

  // Widget tracking with IntersectionObserver
  function observeWidgets() {
    if (!('IntersectionObserver' in window)) {
      log('IntersectionObserver not supported, tracking all widgets immediately');
      trackAllWidgetsImmediate();
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= CONFIG.visibilityThreshold) {
          var widget = entry.target;
          
          if (widget.dataset.codTracked) return;
          widget.dataset.codTracked = 'true';

          var mappingId = parseInt(widget.dataset.mappingId, 10);
          var postId = parseInt(widget.dataset.postId, 10);

          if (isNaN(mappingId) || isNaN(postId)) {
            log('Invalid widget data attributes, skipping');
            return;
          }

          trackEvent('widget_impression', {
            mapping_id: mappingId,
            post_id: postId,
            widget_index: parseInt(widget.dataset.widgetIndex, 10) || 0,
            device_slug: widget.dataset.deviceSlug || null,
            raw_model: widget.dataset.rawModel || null,
            viewport_percent: Math.round(entry.intersectionRatio * 100)
          });

          observer.unobserve(widget);
        }
      });
    }, { threshold: [0, 0.5, 1.0] });

    var widgets = document.querySelectorAll('[data-widget-tracking]');
    log('Found', widgets.length, 'widgets to track');
    
    widgets.forEach(function(widget) {
      observer.observe(widget);
    });

    // Also observe dynamically added widgets
    if ('MutationObserver' in window) {
      var mutationObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) {
              if (node.hasAttribute && node.hasAttribute('data-widget-tracking')) {
                observer.observe(node);
              }
              var nestedWidgets = node.querySelectorAll ? node.querySelectorAll('[data-widget-tracking]') : [];
              nestedWidgets.forEach(function(w) {
                observer.observe(w);
              });
            }
          });
        });
      });

      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function trackAllWidgetsImmediate() {
    var widgets = document.querySelectorAll('[data-widget-tracking]');
    widgets.forEach(function(widget) {
      if (widget.dataset.codTracked) return;
      widget.dataset.codTracked = 'true';

      var mappingId = parseInt(widget.dataset.mappingId, 10);
      var postId = parseInt(widget.dataset.postId, 10);

      if (isNaN(mappingId) || isNaN(postId)) return;

      trackEvent('widget_impression', {
        mapping_id: mappingId,
        post_id: postId,
        widget_index: parseInt(widget.dataset.widgetIndex, 10) || 0,
        device_slug: widget.dataset.deviceSlug || null,
        raw_model: widget.dataset.rawModel || null,
        viewport_percent: 100
      });
    });
  }

  // Click tracking for widget links
  function trackClicks() {
    document.addEventListener('click', function(e) {
      var target = e.target;
      
      // Walk up the DOM to find a trackable element
      while (target && target !== document.body) {
        if (target.hasAttribute && target.hasAttribute('data-widget-click')) {
          var mappingId = parseInt(target.dataset.mappingId, 10);
          var postId = parseInt(target.dataset.postId, 10);

          if (!isNaN(mappingId) && !isNaN(postId)) {
            trackEvent('widget_click', {
              mapping_id: mappingId,
              post_id: postId,
              device_slug: target.dataset.deviceSlug || null,
              click_target: target.dataset.clickTarget || 'link',
              destination_url: target.href || null
            });
          }
          break;
        }
        target = target.parentNode;
      }
    }, true);
  }

  // Initialize
  function init() {
    visitorId = getOrCreateVisitorId();
    sessionId = getOrCreateSessionId();

    log('Initialized with visitor:', visitorId, 'session:', sessionId);

    // Start periodic flush
    flushTimer = setInterval(flush, CONFIG.flushInterval);

    // Flush on visibility change
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    });

    // Flush on page unload
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);

    // Start observing widgets
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        observeWidgets();
        trackClicks();
      });
    } else {
      observeWidgets();
      trackClicks();
    }
  }

  // Expose public API
  window.codAnalytics = {
    trackEvent: trackEvent,
    flush: flush,
    getVisitorId: function() { return visitorId; },
    getSessionId: function() { return sessionId; },
    config: CONFIG
  };

  init();
})();
