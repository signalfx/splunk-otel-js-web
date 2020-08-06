import * as assert from 'assert';
import {findCookieValue, generateId} from '../src/utils';

describe('generateId', () => {
  it('should generate IDs of 64 and 128 bits', () => {
    const id64 = generateId(64);
    const id128 = generateId(128);
    assert.equal(id64.length, 16);
    assert.equal(id128.length, 32);
    assert.ok(id64.match('^[0-9a-z]+$'));
    assert.ok(id128.match('^[0-9a-z]+$'));
  });
});
describe('findCookieValue', () => {
  it('should not find unset cookie', () => {
    assert.ok(findCookieValue('nosuchCookie') === undefined);
  });
});
