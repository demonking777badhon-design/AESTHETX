import fs from 'fs';
import path from 'path';

export interface PaymentGatewayAvailability {
  bkashEnabled: boolean;
  nagadEnabled: boolean;
  updatedAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'payment-gateway-state.json');

let cachedState: PaymentGatewayAvailability | null = null;

function readPersistedState(): PaymentGatewayAvailability {
  if (cachedState) {
    return { ...cachedState };
  }

  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      cachedState = {
        bkashEnabled: parsed.bkashEnabled !== false,
        nagadEnabled: parsed.nagadEnabled !== false,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0
      };
      return { ...cachedState };
    }
  } catch (err) {
    console.warn('Could not read persisted payment gateway state:', err);
  }

  cachedState = {
    bkashEnabled: true,
    nagadEnabled: true,
    updatedAt: 0
  };
  return { ...cachedState };
}

export function getGatewayState(): PaymentGatewayAvailability {
  return readPersistedState();
}

export function setGatewayState(
  updates: Partial<Pick<PaymentGatewayAvailability, 'bkashEnabled' | 'nagadEnabled'>>
): PaymentGatewayAvailability {
  const current = readPersistedState();
  const next: PaymentGatewayAvailability = {
    bkashEnabled:
      typeof updates.bkashEnabled === 'boolean' ? updates.bkashEnabled : current.bkashEnabled,
    nagadEnabled:
      typeof updates.nagadEnabled === 'boolean' ? updates.nagadEnabled : current.nagadEnabled,
    updatedAt: Date.now()
  };

  cachedState = next;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist payment gateway state to disk:', err);
  }

  return { ...next };
}
