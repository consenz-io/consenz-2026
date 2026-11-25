import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Data-access rules are code. A new entity that ships without row-level
 * security is open to every visitor, so this test fails the run instead of
 * waiting for a security review to notice.
 */
const ENTITIES_DIR = path.resolve(import.meta.dirname, '../../base44/entities');

const entityFiles = fs
  .readdirSync(ENTITIES_DIR)
  .filter((file) => file.endsWith('.jsonc'));

function readEntity(file) {
  return JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf8'));
}

test('every entity file is valid JSON and declares a name', () => {
  for (const file of entityFiles) {
    const schema = readEntity(file);
    assert.ok(schema.name, `${file} has no name`);
    assert.equal(`${schema.name}.jsonc`, file, `${file} name does not match its file name`);
  }
});

// User is the platform's built-in entity: the platform owns its security rules,
// so it is not part of the app's own access model.
const PLATFORM_MANAGED = new Set(['User.jsonc']);

test('every entity declares row-level security for all four operations', () => {
  const missing = [];

  for (const file of entityFiles) {
    if (PLATFORM_MANAGED.has(file)) continue;
    const schema = readEntity(file);
    const rls = schema.rls;
    if (!rls || typeof rls !== 'object') {
      missing.push(`${schema.name}: no rls block`);
      continue;
    }
    for (const operation of ['create', 'read', 'update', 'delete']) {
      if (!(operation in rls)) missing.push(`${schema.name}: no ${operation} rule`);
    }
  }

  assert.deepEqual(missing, []);
});

test('personal entities never allow open writes', () => {
  const personal = ['Message', 'Conversation', 'DocumentAgreement', 'GroupInvitation', 'UserPublicProfile'];

  for (const name of personal) {
    const file = `${name}.jsonc`;
    if (!entityFiles.includes(file)) continue;
    const { rls } = readEntity(file);
    for (const operation of ['create', 'update', 'delete']) {
      assert.notEqual(rls?.[operation], null, `${name}.${operation} is open to anyone`);
    }
  }
});

test('an email field on a publicly readable entity is restricted on the field', () => {
  const exposed = [];

  for (const file of entityFiles) {
    const schema = readEntity(file);
    // A restricted entity-level read already hides the whole record; only a
    // public read needs the extra field-level rule.
    if (schema.rls?.read) continue;

    for (const [fieldName, field] of Object.entries(schema.properties || {})) {
      if (field.format !== 'email') continue;
      if (!field.rls?.read) exposed.push(`${schema.name}.${fieldName}`);
    }
  }

  assert.deepEqual(exposed, []);
});