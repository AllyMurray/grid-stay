import '@voidzero-dev/vite-plus-test';
import 'vite-plus/test';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

type JestDomMatchers = TestingLibraryMatchers<any, any>;

declare module '@voidzero-dev/vite-plus-test' {
  interface Assertion<T = any> extends JestDomMatchers {}

  interface AsymmetricMatchersContaining extends JestDomMatchers {}
}

declare module 'vite-plus/test' {
  interface Assertion<T = any> extends JestDomMatchers {}

  interface AsymmetricMatchersContaining extends JestDomMatchers {}
}
