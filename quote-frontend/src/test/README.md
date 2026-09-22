# Frontend Testing Guide

This directory contains test setup and utilities for the quote-lambda-tf-frontend application.

## Table of Contents

- [Test Framework](#test-framework)
- [Running Tests](#running-tests)
  - [Install Dependencies](#install-dependencies)
  - [Run Tests](#run-tests)
- [Test Structure](#test-structure)
  - [Test File Location](#test-file-location)
  - [App.test.tsx](#apptesttsx)
  - [Test Coverage](#test-coverage)
- [Writing New Tests](#writing-new-tests)
- [Best Practices](#best-practices)
- [Debugging Tests](#debugging-tests)
  - [View Test Output](#view-test-output)
  - [Debug Specific Test](#debug-specific-test)
  - [Use the UI Runner](#use-the-ui-runner)
- [CI/CD Integration](#cicd-integration)
- [Resources](#resources)

## Test Framework

- **Vitest**: Fast unit test framework built on Vite
- **React Testing Library**: Testing utilities for React components
- **Jest DOM**: Custom matchers for DOM assertions

## Running Tests

### Install Dependencies

First, install the testing dependencies:

```bash
npm install
```

### Run Tests

```bash
# Run tests in watch mode (recommended for development)
npm test

# Run tests once
npm test run

# Run tests with UI (visual test runner)
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

### Test File Location

Test files follow the **co-location pattern**, where each test file is placed next to the component it tests:

```
src/
├── App.tsx              ← Component
├── App.test.tsx         ← Test file for App component
├── components/
│   ├── MyComponent.tsx
│   └── MyComponent.test.tsx
└── test/
    ├── setup.ts         ← Global test setup
    └── README.md        ← This file
```

**Why co-location?**
- Easy to find tests for a specific component
- Tests stay in sync with component changes
- Clear 1:1 relationship between component and test
- Standard practice in React projects

The `src/test/` directory contains only:
- Global test configuration (`setup.ts`)
- Test utilities and helpers
- Documentation (this README)

### App.test.tsx

Comprehensive tests for the main App component covering:

- **Initial Load**: Loading states and first quote fetch
- **New Quote Button**: Fetching unique quotes
- **Like Button**: Liking quotes and state management
- **Navigation Buttons**: Previous, Next, First, Last navigation
- **UI Elements**: Logo and component rendering

### Test Coverage

The tests cover:
- ✅ Component rendering
- ✅ User interactions (button clicks)
- ✅ API calls and mocking
- ✅ Loading states
- ✅ Error handling
- ✅ Navigation logic
- ✅ Like functionality
- ✅ Button disabled states

## Writing New Tests

When adding new tests, follow these patterns:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

describe('Component Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', async () => {
    render(<YourComponent />);
    
    // Use screen queries
    const button = screen.getByRole('button', { name: /click me/i });
    
    // Simulate user interaction
    fireEvent.click(button);
    
    // Assert expected behavior
    await waitFor(() => {
      expect(screen.getByText('Expected Text')).toBeInTheDocument();
    });
  });
});
```

## Best Practices

1. **Mock External Dependencies**: Always mock API calls and external modules
2. **Use Semantic Queries**: Prefer `getByRole`, `getByLabelText` over `getByTestId`
3. **Wait for Async Updates**: Use `waitFor` for async state changes
4. **Clear Mocks**: Clear mocks between tests to avoid interference
5. **Test User Behavior**: Focus on what users see and do, not implementation details

## Debugging Tests

### View Test Output
```bash
npm test -- --reporter=verbose
```

### Debug Specific Test
```bash
npm test -- App.test.tsx
```

### Use the UI Runner
```bash
npm run test:ui
```

This opens a browser-based test runner where you can:
- See test results visually
- Debug failing tests
- View component snapshots
- Inspect test execution

## CI/CD Integration

Tests can be run in CI/CD pipelines:

```bash
# Run tests once and exit
npm test run

# Generate coverage report
npm run test:coverage
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
