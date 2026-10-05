import { expect, test } from 'bun:test';
import { maskCredentialName } from '@/utils/quota/identity';

test('masks credential email while preserving provider and suffix', () => {
  expect(maskCredentialName('claude-tom@lab.dev.json')).toBe('claude-t•••@l•••.dev.json');
  expect(maskCredentialName('service-account.json')).toBe('service-account.json');
  expect(maskCredentialName('claude-tom@lab.dev.json', true)).toBe('claude-tom@lab.dev.json');
  expect(maskCredentialName('devin.json · tom@lab.dev')).toBe('devin.json · t•••@l•••.dev');
});

test('does not expose hyphenated local parts or domain subdomains', () => {
  expect(maskCredentialName('claude-tom-jones@team.lab.dev.json')).toBe(
    'claude-t•••@t•••.dev.json'
  );
  expect(maskCredentialName('tom-jones@lab.dev')).toBe('t•••@l•••.dev');
});
