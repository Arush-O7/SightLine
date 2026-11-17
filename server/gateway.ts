// Fake payment gateway for the demo. Checks cards and UPI IDs the way a real
// gateway would and only ever keeps a masked reference.
//
// Test values:
//   UPI   name@bank is approved, anything starting with "fail" is declined
//   Card  any valid number is approved (4111 1111 1111 1111),
//         one ending in 0002 is declined (4000 0000 0000 0002)

export type PaymentInput =
  | { method: 'upi'; upiId: string }
  | { method: 'card'; number: string; expiry: string; cvv: string }
  | { method: 'counter' };

export type ChargeResult =
  | { ok: true; status: 'paid' | 'due'; method: PaymentInput['method']; instrument: string }
  | { ok: false; kind: 'invalid' | 'declined'; message: string; method?: PaymentInput['method']; instrument?: string };

const UPI = /^[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,31}$/i;

function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const maskUpi = (id: string) => {
  const [name, bank] = id.split('@');
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(2, name.length - 2))}@${bank}`;
};

export function charge(raw: unknown): ChargeResult {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const method = p.method;

  if (method === 'counter') return { ok: true, status: 'due', method, instrument: 'Pay at the cinema' };

  if (method === 'upi') {
    const upiId = typeof p.upiId === 'string' ? p.upiId.trim().toLowerCase() : '';
    if (!UPI.test(upiId)) return { ok: false, kind: 'invalid', message: 'Enter a UPI ID like name@bank.' };
    const instrument = maskUpi(upiId);
    if (upiId.startsWith('fail')) {
      return { ok: false, kind: 'declined', method, instrument, message: 'Your bank declined the UPI request. Try another UPI ID or a card.' };
    }
    return { ok: true, status: 'paid', method, instrument };
  }

  if (method === 'card') {
    const number = typeof p.number === 'string' ? p.number.replace(/[\s-]/g, '') : '';
    const expiry = typeof p.expiry === 'string' ? p.expiry.trim() : '';
    const cvv = typeof p.cvv === 'string' ? p.cvv.trim() : '';
    if (!/^\d{13,19}$/.test(number) || !luhn(number)) return { ok: false, kind: 'invalid', message: 'That card number is not valid. Check the digits.' };
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return { ok: false, kind: 'invalid', message: 'Enter the expiry as MM/YY.' };
    const end = new Date(2000 + Number(m[2]), Number(m[1]), 1); // first day of the month after expiry
    if (end.getTime() <= Date.now()) return { ok: false, kind: 'invalid', message: 'That card has expired.' };
    if (!/^\d{3,4}$/.test(cvv)) return { ok: false, kind: 'invalid', message: 'Enter the 3 or 4 digit security code.' };
    const instrument = `Card •••• ${number.slice(-4)}`;
    if (number.endsWith('0002')) {
      return { ok: false, kind: 'declined', method, instrument, message: 'The card was declined. Try another card or UPI.' };
    }
    return { ok: true, status: 'paid', method, instrument };
  }

  return { ok: false, kind: 'invalid', message: 'Choose a payment method.' };
}
