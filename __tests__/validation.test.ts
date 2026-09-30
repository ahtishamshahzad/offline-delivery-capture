import { hasErrors, validateDelivery, type DeliveryFormValues } from '@/utils/validation';

const valid: DeliveryFormValues = {
  photoUri: 'file:///tmp/ticket.jpg',
  supplierName: 'ABC Materials',
  poNumber: 'PO-1024',
  note: '20 bags of cement',
};

test('a complete form is valid', () => {
  expect(hasErrors(validateDelivery(valid))).toBe(false);
});

test('note is optional', () => {
  expect(hasErrors(validateDelivery({ ...valid, note: '' }))).toBe(false);
});

test('photo, supplier and PO are required', () => {
  const errors = validateDelivery({ photoUri: null, supplierName: '  ', poNumber: '', note: '' });
  expect(Object.keys(errors).sort()).toEqual(['photoUri', 'poNumber', 'supplierName']);
});

test('PO number rejects unexpected characters', () => {
  expect(validateDelivery({ ...valid, poNumber: 'PO#1024' }).poNumber).toBeDefined();
  expect(validateDelivery({ ...valid, poNumber: 'PO-1024/A 2' }).poNumber).toBeUndefined();
});

test('length limits are enforced', () => {
  expect(validateDelivery({ ...valid, supplierName: 'x'.repeat(101) }).supplierName).toBeDefined();
  expect(validateDelivery({ ...valid, poNumber: 'P'.repeat(41) }).poNumber).toBeDefined();
  expect(validateDelivery({ ...valid, note: 'n'.repeat(501) }).note).toBeDefined();
});
