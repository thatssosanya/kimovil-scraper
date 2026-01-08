# WebSocket API

Bruno doesn't natively support WebSocket, but here are example payloads for testing with `wscat` or similar tools.

## Connection

```bash
wscat -c ws://localhost:1488/ws
```

## Methods

### health.check
```json
{"id": "1", "method": "health.check", "params": {}}
```

### scrape.search
```json
{"id": "2", "method": "scrape.search", "params": {"query": "samsung galaxy s24"}}
```

### scrape.get
```json
{"id": "3", "method": "scrape.get", "params": {"slug": "samsung-galaxy-s24-ultra"}}
```

### bulk.start
```json
{
  "id": "4",
  "method": "bulk.start",
  "params": {
    "jobType": "scrape",
    "mode": "fast",
    "source": "kimovil",
    "dataKind": "specs",
    "slugs": ["samsung-galaxy-s24-ultra", "iphone-15-pro"],
    "filter": "unscraped"
  }
}
```

### bulk.subscribe
```json
{"id": "5", "method": "bulk.subscribe", "params": {"jobId": "scrape-1234567890-abc123"}}
```

### bulk.unsubscribe
```json
{"id": "6", "method": "bulk.unsubscribe", "params": {"jobId": "scrape-1234567890-abc123"}}
```

### bulk.list
```json
{"id": "7", "method": "bulk.list", "params": {}}
```

### bulk.subscribeList
```json
{"id": "8", "method": "bulk.subscribeList", "params": {}}
```

### bulk.unsubscribeList
```json
{"id": "9", "method": "bulk.unsubscribeList", "params": {}}
```

### bulk.pause
```json
{"id": "10", "method": "bulk.pause", "params": {"jobId": "scrape-1234567890-abc123"}}
```

### bulk.resume
```json
{"id": "11", "method": "bulk.resume", "params": {"jobId": "scrape-1234567890-abc123"}}
```

### bulk.setWorkers
```json
{"id": "12", "method": "bulk.setWorkers", "params": {"jobId": "scrape-1234567890-abc123", "workers": 4}}
```

### yandex.scrape
```json
{
  "id": "13",
  "method": "yandex.scrape",
  "params": {
    "url": "https://market.yandex.ru/product/12345",
    "deviceId": "samsung-galaxy-s24-ultra"
  }
}
```

### yandex.link
```json
{
  "id": "14",
  "method": "yandex.link",
  "params": {
    "url": "https://market.yandex.ru/product/12345",
    "deviceId": "samsung-galaxy-s24-ultra"
  }
}
```

## Response Format

All responses follow this structure:

### Success
```json
{"id": "1", "result": {...}}
```

### Stream Event (during long operations)
```json
{"id": "1", "event": {"type": "log", "level": "info", "message": "Processing..."}}
```

### Error
```json
{"id": "1", "error": {"code": "ERROR_CODE", "message": "Error description"}}
```
