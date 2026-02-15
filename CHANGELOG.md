# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-02-12

### Major Refactoring
- Complete architecture overhaul using Strategy Pattern
- Modular design with single-responsibility components
- Full TDD+SDD development workflow

### New Features
- **HealthMonitor**: Continuous health monitoring with automatic recovery detection
- **RetryPolicy**: Configurable exponential backoff retry strategy
- **FallbackStrategy**: Automatic fallback to direct Notion API when MCP fails
- **MCPClient**: Robust stdio-based MCP communication with proper protocol handling

### Improvements
- Production-ready error handling
- Comprehensive logging
- Better timeout management
- Support for all Notion MCP tools

### Testing
- Full unit test coverage for all components
- Integration tests for component interactions
- E2E scenarios for complete workflows

### Breaking Changes
- API surface completely redesigned
- Old `lib/notion-mcp-wrapper.js` replaced with modular structure
- New entry point at `lib/index.js`

## [1.0.0] - 2026-02-11

### Initial Release
- Basic MCP wrapper with health check
- Auto-reconnect functionality
- Simple fallback mechanism
- CLI tools for health check and archive
