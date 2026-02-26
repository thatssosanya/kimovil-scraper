# Changelog

## [4.2.0] - 2025-01-03

### ✨ New Features
- **Price.ru Support**: Added full support for Price.ru affiliate link generation with UTM parameters and erid
- **Long Links Display**: Now shows both short and long links with expandable details
- **Page Refresh for Yandex**: Added automatic page refresh button for product URLs to load in card format
- **Commission Retry**: Added retry/refresh button for AliExpress commission checks

### 🔧 Improvements
- **Robust Clid Logic**: 
  - Kick user gets single link with clid `11999773`
  - Other users get two links: site (`2510955`) and telegram (`2913665`)
- **Better URL Parsing**: Improved AliExpress URL parsing to handle direct product IDs
- **Enhanced UX**: 
  - Commission data resets when navigating to new tabs
  - Better error handling for link generation
  - Improved visual feedback with icons and animations

### 🐛 Bug Fixes
- Fixed arrow duplication in expandable long links
- Fixed commission data persistence when switching tabs
- Added fallback for failed URL shortening
- Improved error handling in link generation

### 🧪 Testing
- Removed browser-dependent tests
- Added comprehensive tests for new features
- Added Chrome API mocks for testing environment

### 🏗️ Technical
- Refactored component architecture with better separation of concerns
- Improved TypeScript type safety
- Better state management in React hooks
- Cleaned up unused dependencies and files

### 📚 Documentation
- Updated README with new features
- Added keyboard shortcuts documentation
- Improved installation instructions

## [4.1.0] - Previous Version
- Initial refactored version with modular architecture
- Support for Yandex Market and AliExpress
- Comprehensive testing setup
- Clean, maintainable codebase