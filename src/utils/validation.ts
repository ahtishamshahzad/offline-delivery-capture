export interface DeliveryFormValues {
  photoUri: string | null;
  supplierName: string;
  poNumber: string;
  note: string;
}

export type DeliveryFormErrors = Partial<Record<keyof DeliveryFormValues, string>>;

export const LIMITS = { supplierName: 100, poNumber: 40, note: 500 } as const;
const PO_PATTERN = /^[A-Za-z0-9\-_/ ]+$/;

export function validateDelivery(values: DeliveryFormValues): DeliveryFormErrors {
  const errors: DeliveryFormErrors = {};
  const supplier = values.supplierName.trim();
  const po = values.poNumber.trim();

  if (!values.photoUri) errors.photoUri = 'Add a photo of the delivery ticket';

  if (!supplier) errors.supplierName = 'Supplier name is required';
  else if (supplier.length > LIMITS.supplierName)
    errors.supplierName = `Max ${LIMITS.supplierName} characters`;

  if (!po) errors.poNumber = 'PO number is required';
  else if (po.length > LIMITS.poNumber) errors.poNumber = `Max ${LIMITS.poNumber} characters`;
  else if (!PO_PATTERN.test(po)) errors.poNumber = 'Use letters, numbers, spaces, - _ or /';

  if (values.note.trim().length > LIMITS.note) errors.note = `Max ${LIMITS.note} characters`;

  return errors;
}

export function hasErrors(errors: DeliveryFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
